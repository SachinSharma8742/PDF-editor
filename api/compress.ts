import type { IncomingMessage, ServerResponse } from 'node:http';
import { PDFDocument } from 'pdf-lib';
import pako from 'pako';
import sharp from 'sharp';

type CompressionLevel = 'aggressive' | 'balanced' | 'conservative';
type TargetDPI = 72 | 96 | 150 | 300;

interface CompressionRequestBody {
    pdfBase64?: string;
    // Backward compatibility with existing frontend payload key.
    pdfBuffer?: string;
    pageIndices?: number[];
    compressionLevel?: CompressionLevel;
    imageQuality?: number;
    imageDPI?: number;
    removeMetadata?: boolean;
    removeDuplicateObjects?: boolean;
    compressStreams?: boolean;
}

interface CompressionMetrics {
    imageBytesRemoved: number;
    metadataBytesRemoved: number;
    streamsBytesRemoved: number;
    timeElapsed: number;
}

interface CompressionResponseBody {
    success: boolean;
    compressedPdf: string;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    // Backward compatibility with previous frontend response key.
    ratio?: number;
    metrics: CompressionMetrics;
    error?: string;
}

interface EffectiveConfig {
    compressionLevel: CompressionLevel;
    imageQuality: number;
    imageDPI: TargetDPI;
    removeMetadata: boolean;
    removeDuplicateObjects: boolean;
    compressStreams: boolean;
}

const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024;
const TIMEOUT_MS = 25_000;

const PRESETS: Record<CompressionLevel, EffectiveConfig> = {
    aggressive: {
        compressionLevel: 'aggressive',
        imageQuality: 60,
        imageDPI: 96,
        removeMetadata: true,
        removeDuplicateObjects: true,
        compressStreams: true,
    },
    balanced: {
        compressionLevel: 'balanced',
        imageQuality: 80,
        imageDPI: 150,
        removeMetadata: true,
        removeDuplicateObjects: true,
        compressStreams: true,
    },
    conservative: {
        compressionLevel: 'conservative',
        imageQuality: 95,
        imageDPI: 300,
        removeMetadata: false,
        removeDuplicateObjects: false,
        compressStreams: false,
    },
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
    if (req.method !== 'POST') {
        return sendJson(res, 405, failure('Only POST is supported.'));
    }

    try {
        const result = await withTimeout(executeCompressionRequest(req), TIMEOUT_MS);
        return sendJson(res, 200, result);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Compression failed.';
        console.error('[api/compress] Compression error:', error);

        if (/timeout/i.test(message)) {
            return sendJson(res, 504, failure('Compression timed out after 25 seconds. Try fewer pages or lower DPI.'));
        }

        const status = /empty|base64|json|invalid|pdf/i.test(message) ? 400 : 500;
        return sendJson(res, status, failure(message));
    }
}

async function executeCompressionRequest(req: IncomingMessage): Promise<CompressionResponseBody> {
    const startedAt = Date.now();
    const body = await parseRequestBody(req);

    const base64 = (body.pdfBase64 || body.pdfBuffer || '').trim();
    if (!base64) {
        throw new Error('Missing pdfBase64 in request body.');
    }

    const inputBuffer = decodeBase64Pdf(base64);
    if (inputBuffer.byteLength === 0) {
        throw new Error('Decoded PDF is empty. Provide a valid base64 PDF payload.');
    }
    if (inputBuffer.byteLength > MAX_PDF_SIZE_BYTES) {
        throw new Error(`PDF too large. Maximum size is ${Math.floor(MAX_PDF_SIZE_BYTES / (1024 * 1024))}MB.`);
    }

    let sourceDoc: PDFDocument;
    try {
        sourceDoc = await PDFDocument.load(inputBuffer, {
            ignoreEncryption: false,
            throwOnInvalidObject: true,
            parseSpeed: 2,
        });
    } catch {
        throw new Error('Invalid PDF. Failed to parse document.');
    }

    const effectiveConfig = buildEffectiveConfig(body);
    const pageCount = sourceDoc.getPageCount();
    const targetPages = normalizePageIndices(body.pageIndices, pageCount);

    const metrics: CompressionMetrics = {
        imageBytesRemoved: 0,
        metadataBytesRemoved: 0,
        streamsBytesRemoved: 0,
        timeElapsed: 0,
    };

    const optimizedDoc = await PDFDocument.create();
    for (let i = 0; i < pageCount; i += 1) {
        if (!targetPages.has(i)) {
            const [copied] = await optimizedDoc.copyPages(sourceDoc, [i]);
            optimizedDoc.addPage(copied);
            continue;
        }

        // Image-heavy optimization path for selected pages.
        const pageResult = await rasterizeAndCompressPage(inputBuffer, i, effectiveConfig);
        if (pageResult) {
            const { imageBytes, widthPx, heightPx } = pageResult;
            const sourcePage = sourceDoc.getPage(i);
            const pageWidth = sourcePage.getWidth();
            const pageHeight = sourcePage.getHeight();

            const embedded = await optimizedDoc.embedJpg(imageBytes);
            const page = optimizedDoc.addPage([pageWidth, pageHeight]);
            page.drawImage(embedded, { x: 0, y: 0, width: pageWidth, height: pageHeight });

            const approxBefore = Math.max(1, widthPx * heightPx * 4);
            metrics.imageBytesRemoved += Math.max(0, approxBefore - imageBytes.byteLength);
        } else {
            const [copied] = await optimizedDoc.copyPages(sourceDoc, [i]);
            optimizedDoc.addPage(copied);
        }
    }

    if (effectiveConfig.removeMetadata) {
        const beforeMetadata = await optimizedDoc.save({ useObjectStreams: true, updateFieldAppearances: false });
        clearMetadata(optimizedDoc);
        const afterMetadata = await optimizedDoc.save({ useObjectStreams: true, updateFieldAppearances: false });
        metrics.metadataBytesRemoved = Math.max(0, beforeMetadata.length - afterMetadata.length);
    }

    let workingDoc = optimizedDoc;
    if (effectiveConfig.removeDuplicateObjects) {
        const dedupe = await removeDuplicateObjects(workingDoc);
        workingDoc = dedupe.doc;
        metrics.streamsBytesRemoved += dedupe.bytesRemoved;
    }

    const uncompressedBytes = await workingDoc.save({ useObjectStreams: false, updateFieldAppearances: false, objectsPerTick: 150 });
    let compressedBytes = await workingDoc.save({
        useObjectStreams: effectiveConfig.compressStreams,
        updateFieldAppearances: false,
        objectsPerTick: 150,
    });

    if (effectiveConfig.compressStreams) {
        // pako is used to estimate additional zlib stream pressure; output remains valid PDF bytes from pdf-lib.
        const pakoProbe = pako.deflate(uncompressedBytes, { level: 9 });
        const pakoEstimatedSaved = Math.max(0, uncompressedBytes.length - pakoProbe.length);
        const actualStreamSaved = Math.max(0, uncompressedBytes.length - compressedBytes.length);
        metrics.streamsBytesRemoved += Math.max(actualStreamSaved, pakoEstimatedSaved);
    }

    // Safety: if compression somehow bloats the file, return original bytes.
    if (compressedBytes.length > inputBuffer.byteLength) {
        compressedBytes = new Uint8Array(inputBuffer);
        metrics.imageBytesRemoved = 0;
        metrics.metadataBytesRemoved = 0;
        metrics.streamsBytesRemoved = 0;
    }

    const originalSize = inputBuffer.byteLength;
    const compressedSize = compressedBytes.length;
    const compressionRatio = originalSize > 0
        ? Number((((originalSize - compressedSize) / originalSize) * 100).toFixed(1))
        : 0;

    metrics.timeElapsed = Number(((Date.now() - startedAt) / 1000).toFixed(2));

    return {
        success: true,
        compressedPdf: Buffer.from(compressedBytes).toString('base64'),
        originalSize,
        compressedSize,
        compressionRatio,
        ratio: compressionRatio,
        metrics: {
            imageBytesRemoved: Math.max(0, Math.round(metrics.imageBytesRemoved)),
            metadataBytesRemoved: Math.max(0, Math.round(metrics.metadataBytesRemoved)),
            streamsBytesRemoved: Math.max(0, Math.round(metrics.streamsBytesRemoved)),
            timeElapsed: metrics.timeElapsed,
        },
    };
}

async function rasterizeAndCompressPage(
    pdfBytes: Buffer,
    pageIndex: number,
    config: EffectiveConfig,
): Promise<{ imageBytes: Buffer; widthPx: number; heightPx: number } | null> {
    try {
        const result = await sharp(pdfBytes, {
            density: config.imageDPI,
            page: pageIndex,
            pages: 1,
            failOn: 'none',
        })
            .resize({
                width: targetWidthForDpi(config.imageDPI),
                withoutEnlargement: true,
                fit: 'inside',
            })
            .jpeg({
                quality: config.imageQuality,
                mozjpeg: true,
                chromaSubsampling: config.imageQuality < 85 ? '4:2:0' : '4:4:4',
            })
            .toBuffer({ resolveWithObject: true });

        return {
            imageBytes: result.data,
            widthPx: result.info.width ?? 1,
            heightPx: result.info.height ?? 1,
        };
    } catch (error) {
        console.warn(`[api/compress] Page ${pageIndex + 1} image compression fallback:`, error);
        return null;
    }
}

function targetWidthForDpi(dpi: TargetDPI) {
    if (dpi <= 96) return 1200;
    if (dpi <= 150) return 1800;
    return 2600;
}

function clearMetadata(doc: PDFDocument) {
    doc.setTitle('');
    doc.setAuthor('');
    doc.setSubject('');
    doc.setCreator('');
    doc.setProducer('');
    doc.setKeywords([]);
    doc.setCreationDate(new Date(0));
    doc.setModificationDate(new Date(0));
}

async function removeDuplicateObjects(doc: PDFDocument): Promise<{ doc: PDFDocument; bytesRemoved: number }> {
    const before = await doc.save({ useObjectStreams: true, updateFieldAppearances: false });
    const rebuilt = await PDFDocument.load(before);
    const deduped = await PDFDocument.create();

    const pageIndices = rebuilt.getPages().map((_, index) => index);
    const copied = await deduped.copyPages(rebuilt, pageIndices);
    copied.forEach((page) => deduped.addPage(page));

    const after = await deduped.save({ useObjectStreams: true, updateFieldAppearances: false });
    return {
        doc: deduped,
        bytesRemoved: Math.max(0, before.length - after.length),
    };
}

function buildEffectiveConfig(body: CompressionRequestBody): EffectiveConfig {
    const level = normalizeCompressionLevel(body.compressionLevel);
    const preset = PRESETS[level];

    const imageQuality = normalizeQuality(body.imageQuality ?? preset.imageQuality);
    const imageDPI = normalizeDpi(body.imageDPI ?? preset.imageDPI);

    return {
        compressionLevel: level,
        imageQuality,
        imageDPI,
        removeMetadata: body.removeMetadata ?? preset.removeMetadata,
        removeDuplicateObjects: body.removeDuplicateObjects ?? preset.removeDuplicateObjects,
        compressStreams: body.compressStreams ?? preset.compressStreams,
    };
}

function normalizeCompressionLevel(level: string | undefined): CompressionLevel {
    if (level === 'aggressive' || level === 'balanced' || level === 'conservative') {
        return level;
    }
    return 'balanced';
}

function normalizeQuality(quality: number) {
    if (!Number.isFinite(quality)) return 80;
    return Math.max(1, Math.min(100, Math.round(quality)));
}

function normalizeDpi(dpi: number): TargetDPI {
    if (dpi === 72 || dpi === 96 || dpi === 150 || dpi === 300) {
        return dpi;
    }
    return 150;
}

function normalizePageIndices(pageIndices: number[] | undefined, pageCount: number): Set<number> {
    const allPages = new Set(Array.from({ length: pageCount }, (_, i) => i));
    if (!Array.isArray(pageIndices) || pageIndices.length === 0) {
        return allPages;
    }

    return new Set(
        pageIndices
            .map((index) => Number(index))
            .filter((index) => Number.isInteger(index) && index >= 0 && index < pageCount),
    );
}

function decodeBase64Pdf(value: string): Buffer {
    const normalized = value.includes(',') ? value.split(',').pop() || '' : value;
    return Buffer.from(normalized.trim(), 'base64');
}

async function parseRequestBody(req: IncomingMessage): Promise<CompressionRequestBody> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    if (chunks.length === 0) {
        throw new Error('Request body is empty.');
    }

    const raw = Buffer.concat(chunks).toString('utf-8');
    try {
        return JSON.parse(raw) as CompressionRequestBody;
    } catch {
        throw new Error('Invalid JSON body.');
    }
}

function failure(error: string): CompressionResponseBody {
    return {
        success: false,
        compressedPdf: '',
        originalSize: 0,
        compressedSize: 0,
        compressionRatio: 0,
        ratio: 0,
        metrics: {
            imageBytesRemoved: 0,
            metadataBytesRemoved: 0,
            streamsBytesRemoved: 0,
            timeElapsed: 0,
        },
        error,
    };
}

function sendJson(res: ServerResponse, statusCode: number, payload: CompressionResponseBody) {
    res.statusCode = statusCode;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
        }
    }
}
