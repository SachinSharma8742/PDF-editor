/**
 * Background Removal Utility
 * Main-thread orchestration for background removal pipeline.
 * 
 * This module:
 * - Creates and manages the Web Worker
 * - Handles image loading/preprocessing on main thread
 * - Applies alpha mask with optional feather/threshold refinement
 * - Returns transparent PNG data URLs
 * 
 * Never returns raw tensors — only HTMLCanvasElement data URLs.
 */

// Worker instance (persistent, loaded once per session)
let worker: Worker | null = null;
let workerReady = false;

// Removed cachedRawMask since refineMask reconstructs from data URL

const MAX_INFERENCE_SIZE = 2048;

type ProgressCallback = (stage: string, percent: number) => void;

/**
 * Get or create the background removal worker.
 */
function getWorker(): Worker {
    if (!worker) {
        worker = new Worker(
            new URL('../workers/bgRemoval.worker.ts', import.meta.url),
            { type: 'module' }
        );
    }
    return worker;
}

/**
 * Load an image from a src URL into pixel data.
 */
function loadImageData(src: string): Promise<{ imageData: Uint8ClampedArray; width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            let { width, height } = img;

            // Downscale if exceeding safe resolution
            if (width > MAX_INFERENCE_SIZE || height > MAX_INFERENCE_SIZE) {
                const scale = MAX_INFERENCE_SIZE / Math.max(width, height);
                width = Math.round(width * scale);
                height = Math.round(height * scale);
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, width, height);
            const data = ctx.getImageData(0, 0, width, height);

            // Clean up
            canvas.width = 0;
            canvas.height = 0;

            resolve({ imageData: data.data, width, height });
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = src;
    });
}

/**
 * Initialize the worker and pre-load the model.
 */
export function initBackgroundRemoval(): void {
    const w = getWorker();
    if (!workerReady) {
        w.postMessage({ type: 'init' });
    }
}

/**
 * Run background removal on an image.
 * Returns a data URL of the transparent-background result.
 */
export function removeBackground(
    imageSrc: string,
    onProgress?: ProgressCallback
): Promise<{ maskedSrc: string; rawMaskDataUrl: string }> {
    return new Promise((resolve, reject) => {
        const w = getWorker();

        const handleMessage = (e: MessageEvent) => {
            const { type } = e.data;

            switch (type) {
                case 'progress':
                    onProgress?.(e.data.stage, e.data.percent);
                    break;

                case 'model-loaded':
                    workerReady = true;
                    break;

                case 'result': {
                    w.removeEventListener('message', handleMessage);

                    const maskData = new Uint8ClampedArray(e.data.maskData);
                    const maskW = e.data.width;
                    const maskH = e.data.height;

                    // Cache the raw mask
                    // Apply mask with default settings
                    applyMaskToImage(imageSrc, maskData, maskW, maskH, 0, 128)
                        .then(({ maskedSrc, rawMaskDataUrl }) => {
                            resolve({ maskedSrc, rawMaskDataUrl });
                        })
                        .catch(reject);
                    break;
                }

                case 'error':
                    w.removeEventListener('message', handleMessage);
                    reject(new Error(e.data.message));
                    break;
            }
        };

        w.addEventListener('message', handleMessage);

        // Load image and send to worker
        loadImageData(imageSrc)
            .then(({ imageData, width, height }) => {
                // Transfer the buffer to the worker
                w.postMessage(
                    { type: 'infer', imageData: imageData.buffer, width, height },
                    [imageData.buffer]
                );
            })
            .catch((err) => {
                w.removeEventListener('message', handleMessage);
                reject(err);
            });
    });
}

/**
 * Apply a mask to the original image with feather and threshold refinement.
 * This does NOT re-run inference — it uses cached mask data.
 */
async function applyMaskToImage(
    imageSrc: string,
    maskData: Uint8ClampedArray,
    maskWidth: number,
    maskHeight: number,
    feather: number,
    threshold: number
): Promise<{ maskedSrc: string; rawMaskDataUrl: string }> {
    // Load the original image at full resolution
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = imageSrc;
    });

    const origW = img.naturalWidth;
    const origH = img.naturalHeight;

    // Create raw mask data URL for caching
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = maskWidth;
    maskCanvas.height = maskHeight;
    const maskCtx = maskCanvas.getContext('2d')!;
    const maskImageData = maskCtx.createImageData(maskWidth, maskHeight);

    for (let i = 0; i < maskData.length; i++) {
        const val = maskData[i];
        maskImageData.data[i * 4] = val;
        maskImageData.data[i * 4 + 1] = val;
        maskImageData.data[i * 4 + 2] = val;
        maskImageData.data[i * 4 + 3] = 255;
    }
    maskCtx.putImageData(maskImageData, 0, 0);

    // Apply feather (blur) to mask if needed
    if (feather > 0) {
        maskCtx.filter = `blur(${feather}px)`;
        maskCtx.drawImage(maskCanvas, 0, 0);
        maskCtx.filter = 'none';
    }

    const rawMaskDataUrl = maskCanvas.toDataURL('image/png');

    // Upscale mask to original resolution if needed
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = origW;
    resultCanvas.height = origH;
    const resultCtx = resultCanvas.getContext('2d')!;

    // Draw original image
    resultCtx.drawImage(img, 0, 0);

    // Get original pixels
    const origPixels = resultCtx.getImageData(0, 0, origW, origH);

    // Get upscaled mask
    const upscaledMaskCanvas = document.createElement('canvas');
    upscaledMaskCanvas.width = origW;
    upscaledMaskCanvas.height = origH;
    const upscaledMaskCtx = upscaledMaskCanvas.getContext('2d')!;
    upscaledMaskCtx.imageSmoothingEnabled = true;
    upscaledMaskCtx.imageSmoothingQuality = 'high';
    upscaledMaskCtx.drawImage(maskCanvas, 0, 0, origW, origH);
    const upscaledMaskData = upscaledMaskCtx.getImageData(0, 0, origW, origH).data;

    // Apply threshold and alpha
    for (let i = 0; i < origW * origH; i++) {
        const maskVal = upscaledMaskData[i * 4]; // R channel
        const alpha = maskVal >= threshold ? maskVal : 0;
        origPixels.data[i * 4 + 3] = alpha; // Set alpha channel
    }

    resultCtx.putImageData(origPixels, 0, 0);
    const maskedSrc = resultCanvas.toDataURL('image/png');

    // Clean up
    maskCanvas.width = 0;
    maskCanvas.height = 0;
    upscaledMaskCanvas.width = 0;
    upscaledMaskCanvas.height = 0;
    resultCanvas.width = 0;
    resultCanvas.height = 0;

    return { maskedSrc, rawMaskDataUrl };
}

/**
 * Re-apply mask refinement with updated feather/threshold.
 * Uses cached raw mask — does NOT re-run the model.
 */
export async function refineMask(
    imageSrc: string,
    rawMaskDataUrl: string,
    feather: number,
    threshold: number
): Promise<string> {
    // Reconstruct mask data from data URL
    const maskImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = rawMaskDataUrl;
    });

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = maskImg.naturalWidth;
    maskCanvas.height = maskImg.naturalHeight;
    const maskCtx = maskCanvas.getContext('2d')!;
    maskCtx.drawImage(maskImg, 0, 0);

    // Apply feather
    if (feather > 0) {
        maskCtx.filter = `blur(${feather}px)`;
        maskCtx.drawImage(maskCanvas, 0, 0);
        maskCtx.filter = 'none';
    }

    // Load original image
    const origImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = imageSrc;
    });

    const origW = origImg.naturalWidth;
    const origH = origImg.naturalHeight;

    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = origW;
    resultCanvas.height = origH;
    const resultCtx = resultCanvas.getContext('2d')!;
    resultCtx.drawImage(origImg, 0, 0);

    const origPixels = resultCtx.getImageData(0, 0, origW, origH);

    // Upscale mask
    const upCanvas = document.createElement('canvas');
    upCanvas.width = origW;
    upCanvas.height = origH;
    const upCtx = upCanvas.getContext('2d')!;
    upCtx.imageSmoothingEnabled = true;
    upCtx.imageSmoothingQuality = 'high';
    upCtx.drawImage(maskCanvas, 0, 0, origW, origH);
    const upMask = upCtx.getImageData(0, 0, origW, origH).data;

    for (let i = 0; i < origW * origH; i++) {
        const maskVal = upMask[i * 4];
        const alpha = maskVal >= threshold ? maskVal : 0;
        origPixels.data[i * 4 + 3] = alpha;
    }

    resultCtx.putImageData(origPixels, 0, 0);
    const maskedSrc = resultCanvas.toDataURL('image/png');

    // Clean up
    maskCanvas.width = 0;
    maskCanvas.height = 0;
    upCanvas.width = 0;
    upCanvas.height = 0;
    resultCanvas.width = 0;
    resultCanvas.height = 0;

    return maskedSrc;
}

/**
 * Dispose the worker. Call when no longer needed.
 */
export function disposeBackgroundRemoval(): void {
    if (worker) {
        worker.terminate();
        worker = null;
        workerReady = false;
    }
}
