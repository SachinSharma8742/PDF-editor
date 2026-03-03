/**
 * Document Comparison Engine
 *
 * Compares two documents (PDF or image) page-by-page using pixel-based diffing.
 * Heavy computation is offloaded to compare.worker.ts.
 *
 * Pipeline:
 *   1. Load both files and render pages to canvas
 *   2. Normalize dimensions to a common size
 *   3. Send pixel data to worker for diff computation
 *   4. Return diff overlay as data URL
 *
 * Non-destructive — never modifies original files.
 */

import * as pdfjsLib from 'pdfjs-dist';

// ─── Types ─────────────────────────────────────────────────────

export interface ComparisonResult {
    /** Page number (1-based) */
    pageNumber: number;
    /** Data URL of page A rendered */
    pageA: string;
    /** Data URL of page B rendered */
    pageB: string;
    /** Data URL of the diff overlay */
    diffOverlay: string;
    /** Number of changed pixels */
    changedPixels: number;
    /** Total pixels compared */
    totalPixels: number;
    /** Percentage of change (0-100) */
    changePercent: number;
}

export interface ComparisonProgress {
    stage: string;
    pageNumber: number;
    totalPages: number;
    /** Worker-level progress for current page (0-100) */
    workerPercent?: number;
}

export interface DocumentInput {
    /** The raw file (PDF or image) */
    file: File;
    /** Number of pages (populated after loading) */
    pageCount?: number;
}

// ─── Worker management ─────────────────────────────────────────

let workerInstance: Worker | null = null;

function getWorker(): Worker {
    if (!workerInstance) {
        workerInstance = new Worker(
            new URL('../workers/compare.worker.ts', import.meta.url),
            { type: 'module' }
        );
    }
    return workerInstance;
}

export function disposeCompareWorker(): void {
    if (workerInstance) {
        workerInstance.terminate();
        workerInstance = null;
    }
}

// ─── Page rendering ────────────────────────────────────────────

const RENDER_SCALE = 1; // Balance between quality and memory

/**
 * Render a specific page of a PDF file to ImageData.
 */
async function renderPdfPage(
    file: File,
    pageNum: number,
    targetWidth?: number,
    targetHeight?: number
): Promise<{ imageData: ImageData; width: number; height: number; dataUrl: string }> {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: RENDER_SCALE });

    const canvas = document.createElement('canvas');
    const width = targetWidth || Math.round(viewport.width);
    const height = targetHeight || Math.round(viewport.height);
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d')!;

    // If we need to match target dimensions, scale the viewport
    if (targetWidth && targetHeight) {
        const scaleX = targetWidth / viewport.width;
        const scaleY = targetHeight / viewport.height;
        const scale = Math.min(scaleX, scaleY);
        const adjustedViewport = page.getViewport({ scale: RENDER_SCALE * scale });

        // Center on canvas
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);

        const offsetX = (width - adjustedViewport.width) / 2;
        const offsetY = (height - adjustedViewport.height) / 2;
        ctx.translate(offsetX, offsetY);

        await page.render({ canvasContext: ctx, viewport: adjustedViewport }).promise;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        await page.render({ canvasContext: ctx, viewport }).promise;
    }

    const imageData = ctx.getImageData(0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/png');

    // Dispose
    canvas.width = 0;
    canvas.height = 0;
    pdfDoc.destroy();

    return { imageData, width, height, dataUrl };
}

/**
 * Render an image file to ImageData.
 */
async function renderImageFile(
    file: File,
    targetWidth?: number,
    targetHeight?: number
): Promise<{ imageData: ImageData; width: number; height: number; dataUrl: string }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            const width = targetWidth || img.naturalWidth;
            const height = targetHeight || img.naturalHeight;

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d')!;

            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            const imageData = ctx.getImageData(0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/png');

            canvas.width = 0;
            canvas.height = 0;
            URL.revokeObjectURL(url);

            resolve({ imageData, width, height, dataUrl });
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image file'));
        };

        img.src = url;
    });
}

/**
 * Determine the type of file (PDF or image).
 */
function getFileType(file: File): 'pdf' | 'image' {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        return 'pdf';
    }
    return 'image';
}

/**
 * Get the number of pages in a file.
 */
export async function getPageCount(file: File): Promise<number> {
    if (getFileType(file) === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdfDoc = await loadingTask.promise;
        const count = pdfDoc.numPages;
        pdfDoc.destroy();
        return count;
    }
    return 1; // Images are single page
}

/**
 * Render a specific page from a file.
 */
async function renderPage(
    file: File,
    pageNum: number,
    targetWidth?: number,
    targetHeight?: number
): Promise<{ imageData: ImageData; width: number; height: number; dataUrl: string }> {
    if (getFileType(file) === 'pdf') {
        return renderPdfPage(file, pageNum, targetWidth, targetHeight);
    }
    return renderImageFile(file, targetWidth, targetHeight);
}

// ─── Worker-based diff ─────────────────────────────────────────

/**
 * Send two ImageData buffers to the worker for pixel-diff computation.
 */
function runPixelDiff(
    imageDataA: ImageData,
    imageDataB: ImageData,
    width: number,
    height: number,
    threshold: number,
    onProgress?: (percent: number) => void
): Promise<{ diffDataUrl: string; changedPixels: number; totalPixels: number }> {
    return new Promise((resolve, reject) => {
        const worker = getWorker();

        const handleMessage = (e: MessageEvent) => {
            const msg = e.data;

            if (msg.type === 'progress') {
                onProgress?.(msg.percent);
            } else if (msg.type === 'result' && msg.action === 'pixel-diff') {
                worker.removeEventListener('message', handleMessage);
                worker.removeEventListener('error', handleError);

                // Convert diff mask to data URL
                const diffPixels = new Uint8ClampedArray(msg.diffData);
                const canvas = document.createElement('canvas');
                canvas.width = msg.width;
                canvas.height = msg.height;
                const ctx = canvas.getContext('2d')!;
                ctx.putImageData(new ImageData(diffPixels, msg.width, msg.height), 0, 0);
                const diffDataUrl = canvas.toDataURL('image/png');

                canvas.width = 0;
                canvas.height = 0;

                resolve({
                    diffDataUrl,
                    changedPixels: msg.changedPixels,
                    totalPixels: msg.totalPixels,
                });
            } else if (msg.type === 'error') {
                worker.removeEventListener('message', handleMessage);
                worker.removeEventListener('error', handleError);
                reject(new Error(msg.message));
            }
        };

        const handleError = (err: ErrorEvent) => {
            worker.removeEventListener('message', handleMessage);
            worker.removeEventListener('error', handleError);
            reject(new Error(err.message || 'Compare worker error'));
        };

        worker.addEventListener('message', handleMessage);
        worker.addEventListener('error', handleError);

        // Clone buffers for transfer
        const bufferA = imageDataA.data.buffer.slice(0) as ArrayBuffer;
        const bufferB = imageDataB.data.buffer.slice(0) as ArrayBuffer;

        worker.postMessage(
            {
                type: 'pixel-diff',
                imageDataA: bufferA,
                imageDataB: bufferB,
                width,
                height,
                threshold,
            },
            [bufferA, bufferB]
        );
    });
}

// ─── Main API ──────────────────────────────────────────────────

/**
 * Compare two documents page by page.
 *
 * @param fileA       - First document file
 * @param fileB       - Second document file
 * @param threshold   - Pixel difference threshold (0-255, default 30)
 * @param onProgress  - Progress callback
 * @returns Array of comparison results, one per page pair
 */
export async function compareDocuments(
    fileA: File,
    fileB: File,
    threshold = 30,
    onProgress?: (progress: ComparisonProgress) => void
): Promise<ComparisonResult[]> {
    const results: ComparisonResult[] = [];

    // Get page counts
    const countA = await getPageCount(fileA);
    const countB = await getPageCount(fileB);
    const totalPages = Math.max(countA, countB);

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        onProgress?.({
            stage: `Rendering page ${pageNum}`,
            pageNumber: pageNum,
            totalPages,
        });

        // Render pages — if one doc has fewer pages, render a blank white page
        let renderA: { imageData: ImageData; width: number; height: number; dataUrl: string };
        let renderB: { imageData: ImageData; width: number; height: number; dataUrl: string };

        if (pageNum <= countA) {
            renderA = await renderPage(fileA, pageNum);
        } else {
            // Create blank white image matching doc B dimensions
            renderA = createBlankPage(800, 1100);
        }

        // Normalize B to match A's dimensions
        const targetWidth = renderA.width;
        const targetHeight = renderA.height;

        if (pageNum <= countB) {
            renderB = await renderPage(fileB, pageNum, targetWidth, targetHeight);
        } else {
            renderB = createBlankPage(targetWidth, targetHeight);
        }

        // Ensure both have same dimensions (renderB should already match due to target params)
        // But if renderA was an image, renderB might not match exactly
        if (renderB.width !== targetWidth || renderB.height !== targetHeight) {
            renderB = resizeImageData(renderB, targetWidth, targetHeight);
        }

        onProgress?.({
            stage: `Comparing page ${pageNum}`,
            pageNumber: pageNum,
            totalPages,
        });

        // Run pixel diff
        const diff = await runPixelDiff(
            renderA.imageData,
            renderB.imageData,
            targetWidth,
            targetHeight,
            threshold,
            (percent) => {
                onProgress?.({
                    stage: `Comparing page ${pageNum}`,
                    pageNumber: pageNum,
                    totalPages,
                    workerPercent: percent,
                });
            }
        );

        results.push({
            pageNumber: pageNum,
            pageA: renderA.dataUrl,
            pageB: renderB.dataUrl,
            diffOverlay: diff.diffDataUrl,
            changedPixels: diff.changedPixels,
            totalPixels: diff.totalPixels,
            changePercent: diff.totalPixels > 0
                ? Math.round((diff.changedPixels / diff.totalPixels) * 10000) / 100
                : 0,
        });
    }

    return results;
}

// ─── Helpers ───────────────────────────────────────────────────

function createBlankPage(
    width: number,
    height: number
): { imageData: ImageData; width: number; height: number; dataUrl: string } {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/png');
    canvas.width = 0;
    canvas.height = 0;
    return { imageData, width, height, dataUrl };
}

function resizeImageData(
    source: { imageData: ImageData; width: number; height: number; dataUrl: string },
    targetWidth: number,
    targetHeight: number
): { imageData: ImageData; width: number; height: number; dataUrl: string } {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d')!;

    // Draw source imageData to a temp canvas first
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = source.width;
    tempCanvas.height = source.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(source.imageData, 0, 0);

    // Scale to target
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);

    const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    const dataUrl = canvas.toDataURL('image/png');

    // Dispose
    canvas.width = 0;
    canvas.height = 0;
    tempCanvas.width = 0;
    tempCanvas.height = 0;

    return { imageData, width: targetWidth, height: targetHeight, dataUrl };
}
