/**
 * Mask Refinement Studio — Main-thread API
 *
 * Provides manual refinement for ML-generated masks:
 *   • Feather edge
 *   • Threshold adjust
 *   • Expand / contract mask
 *   • Soft edge smoothing
 *
 * Heavy pixel operations run in refinement.worker.ts.
 * This module handles worker lifecycle, preview, and compositing.
 */

// ─── Types ─────────────────────────────────────────────────────

export interface MaskRefinementParams {
    /** 0–100: Feather (Gaussian blur) on mask edges */
    feather: number;
    /** 0–255: Threshold for binarizing the mask */
    threshold: number;
    /** -50 to +50: Expand (positive) or contract (negative) mask boundary */
    expand: number;
    /** 0–100: Soft edge smoothing intensity */
    softEdge: number;
}

export const DEFAULT_MASK_PARAMS: MaskRefinementParams = {
    feather: 0,
    threshold: 128,
    expand: 0,
    softEdge: 0,
};

export interface RefinementProgress {
    stage: string;
    percent: number;
}

// ─── Worker management ─────────────────────────────────────────

let workerInstance: Worker | null = null;

function getWorker(): Worker {
    if (!workerInstance) {
        workerInstance = new Worker(
            new URL('../workers/refinement.worker.ts', import.meta.url),
            { type: 'module' }
        );
    }
    return workerInstance;
}

export function disposeRefinementWorker(): void {
    if (workerInstance) {
        workerInstance.terminate();
        workerInstance = null;
    }
}

// ─── Core API ──────────────────────────────────────────────────

/**
 * Load a mask from a data-URL into raw ImageData.
 */
async function loadMaskBuffer(
    maskDataUrl: string
): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            resolve({
                data: imageData.data,
                width: canvas.width,
                height: canvas.height,
            });
            // Dispose canvas
            canvas.width = 0;
            canvas.height = 0;
        };
        img.onerror = () => reject(new Error('Failed to load mask image'));
        img.src = maskDataUrl;
    });
}

/**
 * Run the refinement pipeline on a mask via the worker.
 *
 * @param maskDataUrl  – data-URL of the raw ML mask
 * @param params       – refinement parameters
 * @param onProgress   – optional progress callback
 * @returns refined mask as a data-URL (RGBA PNG)
 */
export async function refineMaskBuffer(
    maskDataUrl: string,
    params: MaskRefinementParams,
    onProgress?: (p: RefinementProgress) => void
): Promise<string> {
    const { data, width, height } = await loadMaskBuffer(maskDataUrl);

    return new Promise<string>((resolve, reject) => {
        const worker = getWorker();

        const handleMessage = (e: MessageEvent) => {
            const msg = e.data;
            switch (msg.type) {
                case 'progress':
                    onProgress?.({ stage: msg.stage, percent: msg.percent });
                    break;
                case 'result': {
                    worker.removeEventListener('message', handleMessage);
                    worker.removeEventListener('error', handleError);
                    // Convert result back to data-URL
                    const refined = new Uint8ClampedArray(msg.maskData);
                    const canvas = document.createElement('canvas');
                    canvas.width = msg.width;
                    canvas.height = msg.height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
                    ctx.putImageData(new ImageData(refined, msg.width, msg.height), 0, 0);
                    const dataUrl = canvas.toDataURL('image/png');
                    // Dispose
                    canvas.width = 0;
                    canvas.height = 0;
                    resolve(dataUrl);
                    break;
                }
                case 'error':
                    worker.removeEventListener('message', handleMessage);
                    worker.removeEventListener('error', handleError);
                    reject(new Error(msg.message));
                    break;
            }
        };

        const handleError = (err: ErrorEvent) => {
            worker.removeEventListener('message', handleMessage);
            worker.removeEventListener('error', handleError);
            reject(new Error(err.message || 'Worker error'));
        };

        worker.addEventListener('message', handleMessage);
        worker.addEventListener('error', handleError);

        // Transfer the buffer to avoid copying
        const buffer = data.buffer.slice(0) as ArrayBuffer;
        worker.postMessage(
            { type: 'refine-mask', maskData: buffer, width, height, params },
            [buffer]
        );
    });
}

/**
 * Composite a refined mask onto the original source image.
 * Returns a data-URL of the masked image.
 */
export async function applyRefinedMask(
    originalSrc: string,
    refinedMaskDataUrl: string
): Promise<string> {
    return new Promise((resolve, reject) => {
        const srcImg = new Image();
        const maskImg = new Image();

        let srcLoaded = false;
        let maskLoaded = false;

        const tryComposite = () => {
            if (!srcLoaded || !maskLoaded) return;

            const w = srcImg.naturalWidth;
            const h = srcImg.naturalHeight;

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error('Canvas context unavailable')); return; }

            // Draw the mask first
            ctx.drawImage(maskImg, 0, 0, w, h);
            // Use 'source-in' to keep only the masked area
            ctx.globalCompositeOperation = 'source-in';
            ctx.drawImage(srcImg, 0, 0, w, h);
            ctx.globalCompositeOperation = 'source-over';

            const result = canvas.toDataURL('image/png');
            // Dispose
            canvas.width = 0;
            canvas.height = 0;
            resolve(result);
        };

        srcImg.onload = () => { srcLoaded = true; tryComposite(); };
        maskImg.onload = () => { maskLoaded = true; tryComposite(); };
        srcImg.onerror = () => reject(new Error('Failed to load source image'));
        maskImg.onerror = () => reject(new Error('Failed to load mask image'));

        srcImg.src = originalSrc;
        maskImg.src = refinedMaskDataUrl;
    });
}
