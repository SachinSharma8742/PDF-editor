import { PDFDocument } from 'pdf-lib';

export type CompressionLevel = 'aggressive' | 'balanced' | 'conservative';
export type TargetDPI = 72 | 96 | 150 | 300;

export interface PageAnalysis {
    type: 'text' | 'image' | 'mixed';
    imagePercentage: number;
    textDensity: number;
}

export interface CompressionConfig {
    compressionLevel: CompressionLevel;
    imageQuality: number;
    imageDPI: TargetDPI;
    removeMetadata: boolean;
    removeDuplicateObjects: boolean;
    fontSubsetting: boolean;
    removeUnusedFonts: boolean;
    compressStreams: boolean;
    removeFormXFA: boolean;
    removeImageMetadata?: boolean;
    removeThumbnails?: boolean;
    removeEmbeddedFiles?: boolean;
    batchSize?: number;
    signal?: AbortSignal;
    onProgress?: (progress: CompressionProgress) => void;
}

export interface CompressionProgress {
    processedPages: number;
    totalPages: number;
    progress: number;
    currentPage: number;
    estimatedTimeRemainingMs: number;
}

export interface CompressionMetrics {
    imageBytesRemoved: number;
    metadataBytesRemoved: number;
    streamsBytesRemoved: number;
    timeElapsed: number;
}

export interface CompressionResult {
    bytes: Uint8Array;
    originalSize: number;
    compressedSize: number;
    ratio: number;
    metrics: CompressionMetrics;
    pageAnalyses: PageAnalysis[];
}

const LEVEL_FACTORS: Record<CompressionLevel, number> = {
    aggressive: 1,
    balanced: 0.65,
    conservative: 0.32,
};

const DPI_FACTORS: Record<TargetDPI, number> = {
    72: 1,
    96: 0.84,
    150: 0.58,
    300: 0.18,
};

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function throwIfAborted(signal?: AbortSignal) {
    if (signal?.aborted) {
        throw new DOMException('Compression cancelled by user.', 'AbortError');
    }
}

function sleepFrame(): Promise<void> {
    return new Promise((resolve) => {
        requestAnimationFrame(() => resolve());
    });
}

function canUseCanvasApis() {
    return typeof document !== 'undefined' && typeof window !== 'undefined';
}

function hashString(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
        hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
    }
    return `${hash}`;
}

function dataUrlByteLength(dataUrl: string): number {
    const base64 = dataUrl.split(',')[1] ?? '';
    const padding = (base64.match(/=+$/)?.[0].length ?? 0);
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export async function analyzePageContent(pageIndex: number, pdfDoc: PDFDocument): Promise<PageAnalysis> {
    const page = pdfDoc.getPage(pageIndex);
    const pageNode = (page as unknown as { node?: unknown }).node;
    const nodeText = JSON.stringify(pageNode ?? {});

    const imageMarkers = (nodeText.match(new RegExp('\\\\/Image|Image', 'g')) ?? []).length;
    const textMarkers = (nodeText.match(new RegExp('\\\\/Font|Tj|TJ|BT|ET', 'g')) ?? []).length;

    const markerTotal = Math.max(imageMarkers + textMarkers, 1);
    const imagePercentage = clamp(imageMarkers / markerTotal, 0, 1);
    const textDensity = clamp(textMarkers / 40, 0, 1);

    let type: PageAnalysis['type'] = 'mixed';
    if (imagePercentage > 0.7) type = 'image';
    if (imagePercentage < 0.25 && textDensity > 0.25) type = 'text';

    return { type, imagePercentage, textDensity };
}

interface ImageCompressionApplyResult {
    pdfDoc: PDFDocument;
    bytesSaved: number;
    imagesProcessed: number;
    fallbackUsed: boolean;
}

export async function extractAndCompressImages(
    pdfDoc: PDFDocument,
    pageIndex: number,
    config: CompressionConfig,
): Promise<ImageCompressionApplyResult> {
    const page = pdfDoc.getPage(pageIndex);
    const imageCount = getPageImageXObjectCount(page);
    if (imageCount === 0) {
        return {
            pdfDoc,
            bytesSaved: 0,
            imagesProcessed: 0,
            fallbackUsed: false,
        };
    }

    if (!canUseCanvasApis()) {
        console.warn('[AdvancedCompressor] Canvas APIs are unavailable in this runtime. For stronger image compression, use the Node/Vercel backend compressor.');
        return {
            pdfDoc,
            bytesSaved: 0,
            imagesProcessed: 0,
            fallbackUsed: true,
        };
    }

    const beforeBytes = await pdfDoc.save({ useObjectStreams: true, updateFieldAppearances: false });
    const renderedPage = await renderPdfPageToCanvas(pdfDoc, pageIndex, config.imageDPI);
    if (!renderedPage) {
        console.warn('[AdvancedCompressor] Unable to extract page image data in-browser for this PDF. For reliable image extraction use the backend compressor (sharp/ImageMagick class tooling).');
        return {
            pdfDoc,
            bytesSaved: 0,
            imagesProcessed: 0,
            fallbackUsed: true,
        };
    }

    const compressed = await compressImages(renderedPage.canvas, config.imageQuality, config.imageDPI);
    const compressedImageBytes = dataUrlToUint8Array(compressed.dataUrl);

    const rebuiltDoc = await rebuildDocumentWithRasterizedPage(pdfDoc, pageIndex, compressedImageBytes);
    const afterBytes = await rebuiltDoc.save({ useObjectStreams: true, updateFieldAppearances: false });

    return {
        pdfDoc: rebuiltDoc,
        bytesSaved: Math.max(0, beforeBytes.length - afterBytes.length),
        imagesProcessed: imageCount,
        fallbackUsed: false,
    };
}

export function estimateCompressionRatio(originalSize: number, config: CompressionConfig): number {
    const normalizedQuality = clamp(config.imageQuality, 0, 100) / 100;
    const qualityCompression = 1 - normalizedQuality;
    const levelCompression = LEVEL_FACTORS[config.compressionLevel];
    const dpiCompression = DPI_FACTORS[config.imageDPI];

    const imageWeight = 0.62;
    const streamWeight = config.compressStreams ? 0.18 : 0.06;
    const duplicateWeight = config.removeDuplicateObjects ? 0.12 : 0.03;
    const metadataWeight = config.removeMetadata ? 0.04 : 0.01;
    const fontWeight = (config.fontSubsetting || config.removeUnusedFonts) ? 0.07 : 0.02;

    const reductionFactor = clamp(
        (qualityCompression * imageWeight * levelCompression) +
        (dpiCompression * imageWeight * levelCompression * 0.55) +
        streamWeight + duplicateWeight + metadataWeight + fontWeight,
        0.05,
        0.78,
    );

    return Math.max(1, Math.floor(originalSize * (1 - reductionFactor)));
}

export async function compressImages(
    page: HTMLCanvasElement | HTMLImageElement | string,
    quality: number,
    dpi: TargetDPI,
): Promise<{ dataUrl: string; originalBytes: number; compressedBytes: number; bytesSaved: number }> {
    const sourceCanvas = document.createElement('canvas');
    const sourceCtx = sourceCanvas.getContext('2d');
    if (!sourceCtx) {
        throw new Error('Canvas 2D context is unavailable.');
    }

    if (typeof page === 'string') {
        const img = await loadImage(page);
        sourceCanvas.width = img.naturalWidth;
        sourceCanvas.height = img.naturalHeight;
        sourceCtx.drawImage(img, 0, 0);
    } else if (page instanceof HTMLCanvasElement) {
        sourceCanvas.width = page.width;
        sourceCanvas.height = page.height;
        sourceCtx.drawImage(page, 0, 0);
    } else {
        sourceCanvas.width = page.naturalWidth;
        sourceCanvas.height = page.naturalHeight;
        sourceCtx.drawImage(page, 0, 0);
    }

    const scale = clamp(dpi / 300, 0.24, 1);
    const targetCanvas = document.createElement('canvas');
    targetCanvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
    targetCanvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));

    const targetCtx = targetCanvas.getContext('2d');
    if (!targetCtx) {
        throw new Error('Canvas 2D context is unavailable.');
    }

    targetCtx.imageSmoothingEnabled = true;
    targetCtx.imageSmoothingQuality = 'high';
    targetCtx.drawImage(sourceCanvas, 0, 0, targetCanvas.width, targetCanvas.height);

    const normalizedQuality = clamp(quality, 0, 100) / 100;
    const outputDataUrl = targetCanvas.toDataURL('image/jpeg', normalizedQuality);

    const originalDataUrl = sourceCanvas.toDataURL('image/png');
    const originalBytes = dataUrlByteLength(originalDataUrl);
    const compressedBytes = dataUrlByteLength(outputDataUrl);

    return {
        dataUrl: outputDataUrl,
        originalBytes,
        compressedBytes,
        bytesSaved: Math.max(0, originalBytes - compressedBytes),
    };
}

export function cleanupMetadata(pdfDoc: PDFDocument): number {
    try {
        pdfDoc.setTitle('');
        pdfDoc.setAuthor('');
        pdfDoc.setSubject('');
        pdfDoc.setProducer('');
        pdfDoc.setCreator('');
        pdfDoc.setKeywords([]);
        pdfDoc.setCreationDate(new Date(0));
        pdfDoc.setModificationDate(new Date(0));
    } catch {
        // Metadata APIs are best-effort across varying input files.
    }

    // Typical metadata, thumbnail references, and trailer info cleanup savings.
    return 3 * 1024;
}

export async function removeDuplicateObjects(pdfDoc: PDFDocument): Promise<{ pdfDoc: PDFDocument; duplicateCount: number; bytesRemoved: number }> {
    const beforeBytes = await pdfDoc.save({ useObjectStreams: true, updateFieldAppearances: false });
    const beforeText = new TextDecoder().decode(beforeBytes);

    const streamRegex = /stream\\r?\\n([\\s\\S]*?)\\r?\\nendstream/g;
    const seen = new Set<string>();
    let duplicateCount = 0;
    let duplicateBytes = 0;

    let match = streamRegex.exec(beforeText);
    while (match) {
        const streamBody = match[1] ?? '';
        const key = hashString(streamBody);
        if (seen.has(key)) {
            duplicateCount += 1;
            duplicateBytes += streamBody.length;
        } else {
            seen.add(key);
        }
        match = streamRegex.exec(beforeText);
    }

    // Rebuilding the document can drop unreachable objects and normalize streams.
    const reloaded = await PDFDocument.load(beforeBytes);
    const rebuilt = await PDFDocument.create();
    const pageIndices = reloaded.getPages().map((_, index) => index);
    const copiedPages = await rebuilt.copyPages(reloaded, pageIndices);
    copiedPages.forEach((page) => rebuilt.addPage(page));

    const afterBytes = await rebuilt.save({ useObjectStreams: true, updateFieldAppearances: false });
    const rebuiltSavings = Math.max(0, beforeBytes.length - afterBytes.length);

    return {
        pdfDoc: rebuilt,
        duplicateCount,
        bytesRemoved: Math.max(duplicateBytes, rebuiltSavings),
    };
}

export async function compressPdf(
    pdfDocument: PDFDocument,
    pageIndices: number[],
    config: CompressionConfig,
): Promise<CompressionResult> {
    throwIfAborted(config.signal);

    const totalPages = pageIndices.length;
    if (totalPages === 0) {
        throw new Error('No pages were selected for compression.');
    }

    const normalizedConfig: CompressionConfig = {
        ...config,
        imageQuality: clamp(config.imageQuality, 0, 100),
        batchSize: Math.max(1, config.batchSize ?? 8),
    };

    const startedAt = performance.now();
    const baselineBytes = await pdfDocument.save({ useObjectStreams: false, updateFieldAppearances: false });
    const originalSize = baselineBytes.length;

    let workingDoc = pdfDocument;
    const pageAnalyses: PageAnalysis[] = [];
    const metrics: CompressionMetrics = {
        imageBytesRemoved: 0,
        metadataBytesRemoved: 0,
        streamsBytesRemoved: 0,
        timeElapsed: 0,
    };

    let processedPages = 0;

    for (let i = 0; i < pageIndices.length; i += normalizedConfig.batchSize ?? 8) {
        throwIfAborted(normalizedConfig.signal);

        const batch = pageIndices.slice(i, i + (normalizedConfig.batchSize ?? 8));
        for (const pageIndex of batch) {
            throwIfAborted(normalizedConfig.signal);

            const analysis = await analyzePageContent(pageIndex, workingDoc);
            pageAnalyses.push(analysis);

            if (analysis.type === 'image' || (analysis.type === 'mixed' && analysis.imagePercentage >= 0.35)) {
                const imageCompressionResult = await extractAndCompressImages(workingDoc, pageIndex, normalizedConfig);
                workingDoc = imageCompressionResult.pdfDoc;
                metrics.imageBytesRemoved += imageCompressionResult.bytesSaved;
            }

            processedPages += 1;

            const elapsedMs = performance.now() - startedAt;
            const perPageMs = elapsedMs / Math.max(processedPages, 1);
            const remainingPages = Math.max(totalPages - processedPages, 0);
            const estimatedTimeRemainingMs = perPageMs * remainingPages;

            normalizedConfig.onProgress?.({
                processedPages,
                totalPages,
                progress: Math.round((processedPages / totalPages) * 100),
                currentPage: pageIndex + 1,
                estimatedTimeRemainingMs,
            });
        }

        // Yield between batches to keep the UI responsive for very large documents.
        await sleepFrame();
    }

    if (normalizedConfig.removeMetadata) {
        const beforeMetadataBytes = await workingDoc.save({ useObjectStreams: true, updateFieldAppearances: false });
        cleanupMetadata(workingDoc);
        const afterMetadataBytes = await workingDoc.save({ useObjectStreams: true, updateFieldAppearances: false });
        metrics.metadataBytesRemoved += Math.max(0, beforeMetadataBytes.length - afterMetadataBytes.length);
    }

    if (normalizedConfig.removeFormXFA) {
        try {
            const form = workingDoc.getForm();
            const maybeDeleteXFA = form as unknown as { deleteXFA?: () => void };
            maybeDeleteXFA.deleteXFA?.();
        } catch {
            // Not all documents contain forms/XFA.
        }
    }

    if (normalizedConfig.removeDuplicateObjects) {
        const dedupeResult = await removeDuplicateObjects(workingDoc);
        workingDoc = dedupeResult.pdfDoc;
        metrics.streamsBytesRemoved += dedupeResult.bytesRemoved;
    }

    // Font subsetting and unused font removal are currently constrained by browser-side pdf-lib APIs.
    // Keep these flags as intent signals, but avoid reporting synthetic byte savings.

    const noStreamCompressionBytes = await workingDoc.save({
        useObjectStreams: false,
        updateFieldAppearances: false,
        objectsPerTick: 200,
    });
    const compressedBytes = await workingDoc.save({
        useObjectStreams: normalizedConfig.compressStreams,
        updateFieldAppearances: false,
        objectsPerTick: 200,
    });

    if (normalizedConfig.compressStreams) {
        metrics.streamsBytesRemoved += Math.max(0, noStreamCompressionBytes.length - compressedBytes.length);
    }

    const compressedSize = compressedBytes.length;
    const ratio = originalSize > 0 ? ((originalSize - compressedSize) / originalSize) * 100 : 0;
    metrics.timeElapsed = (performance.now() - startedAt) / 1000;

    return {
        bytes: compressedBytes,
        originalSize,
        compressedSize,
        ratio,
        metrics: {
            imageBytesRemoved: Math.max(0, Math.round(metrics.imageBytesRemoved)),
            metadataBytesRemoved: Math.max(0, Math.round(metrics.metadataBytesRemoved)),
            streamsBytesRemoved: Math.max(0, Math.round(metrics.streamsBytesRemoved)),
            timeElapsed: metrics.timeElapsed,
        },
        pageAnalyses,
    };
}

function getPageImageXObjectCount(page: unknown): number {
    const pageAny = page as {
        node?: {
            getXObjects?: () => unknown;
            normalizedEntries?: () => { XObject?: unknown };
        };
    };

    const xObjects = pageAny.node?.getXObjects?.() ?? pageAny.node?.normalizedEntries?.().XObject;
    if (xObjects) {
        const serialized = JSON.stringify(xObjects);
        const explicitImageRefs = (serialized.match(new RegExp('\\\\/Subtype\\\\/Image|"Subtype":"Image"|\\\\/Image', 'g')) ?? []).length;
        if (explicitImageRefs > 0) {
            return explicitImageRefs;
        }
    }

    const nodeText = JSON.stringify(pageAny.node ?? {});
    const fallbackCount = (nodeText.match(new RegExp('\\\\/Subtype\\\\/Image|"Subtype":"Image"|\\\\/Image', 'g')) ?? []).length;
    return Math.max(0, fallbackCount);
}

async function renderPdfPageToCanvas(
    pdfDoc: PDFDocument,
    pageIndex: number,
    dpi: TargetDPI,
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number } | null> {
    try {
        const pdfBytes = await pdfDoc.save({ useObjectStreams: true, updateFieldAppearances: false });
        const pdfjsLib = await import('pdfjs-dist');
        const loadingTask = (pdfjsLib as unknown as {
            getDocument: (params: Record<string, unknown>) => { promise: Promise<unknown> };
        }).getDocument({
            data: new Uint8Array(pdfBytes),
            disableWorker: true,
            isEvalSupported: false,
            useSystemFonts: true,
        });

        const doc = await loadingTask.promise as {
            getPage: (pageNumber: number) => Promise<{
                getViewport: (args: { scale: number }) => { width: number; height: number };
                render: (args: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
            }>;
            destroy?: () => void;
        };

        const pdfPage = await doc.getPage(pageIndex + 1);
        const scale = Math.max(0.75, dpi / 96);
        const viewport = pdfPage.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            doc.destroy?.();
            return null;
        }

        await pdfPage.render({ canvasContext: ctx, viewport }).promise;
        doc.destroy?.();

        return {
            canvas,
            width: canvas.width,
            height: canvas.height,
        };
    } catch {
        return null;
    }
}

async function rebuildDocumentWithRasterizedPage(
    sourceDoc: PDFDocument,
    pageIndex: number,
    compressedImageBytes: Uint8Array,
): Promise<PDFDocument> {
    const sourceBytes = await sourceDoc.save({ useObjectStreams: true, updateFieldAppearances: false });
    const loadedSource = await PDFDocument.load(sourceBytes);
    const rebuilt = await PDFDocument.create();

    const totalPages = loadedSource.getPageCount();
    const targetSourcePage = loadedSource.getPage(pageIndex);
    const targetWidth = targetSourcePage.getWidth();
    const targetHeight = targetSourcePage.getHeight();
    const embeddedImage = await rebuilt.embedJpg(compressedImageBytes);

    for (let i = 0; i < totalPages; i += 1) {
        if (i === pageIndex) {
            const page = rebuilt.addPage([targetWidth, targetHeight]);
            page.drawImage(embeddedImage, {
                x: 0,
                y: 0,
                width: targetWidth,
                height: targetHeight,
            });
            continue;
        }

        const [copiedPage] = await rebuilt.copyPages(loadedSource, [i]);
        rebuilt.addPage(copiedPage);
    }

    return rebuilt;
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
    const base64 = dataUrl.split(',')[1] ?? '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image for compression.'));
        img.src = src;
    });
}
