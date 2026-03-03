/**
 * Refinement Web Worker
 *
 * Offloads heavy mask pixel operations from the main thread.
 * Uses OffscreenCanvas for pixel manipulation.
 *
 * Messages IN:
 *   { type: 'refine-mask', maskData: ArrayBuffer, width, height, params }
 *
 * Messages OUT:
 *   { type: 'progress', stage, percent }
 *   { type: 'result', action, maskData: ArrayBuffer, width, height }
 *   { type: 'error', message }
 */

export interface RefinementParams {
    /** 0–100: Gaussian blur radius on mask edges */
    feather: number;
    /** 0–255: Binary threshold for mask */
    threshold: number;
    /** -50 to +50: Expand (positive) or contract (negative) mask in pixels */
    expand: number;
    /** 0–100: Soft edge smoothing intensity */
    softEdge: number;
}

// ─── Kernel helpers ────────────────────────────────────────────

function gaussianKernel(radius: number): Float32Array {
    if (radius <= 0) return new Float32Array([1]);
    const size = radius * 2 + 1;
    const kernel = new Float32Array(size);
    const sigma = radius / 3;
    const s2 = 2 * sigma * sigma;
    let sum = 0;
    for (let i = 0; i < size; i++) {
        const x = i - radius;
        kernel[i] = Math.exp(-(x * x) / s2);
        sum += kernel[i];
    }
    // Normalize
    for (let i = 0; i < size; i++) kernel[i] /= sum;
    return kernel;
}

/**
 * Separable horizontal + vertical Gaussian blur on a single-channel buffer.
 */
function blurChannel(
    data: Float32Array, w: number, h: number, radius: number
): Float32Array {
    if (radius <= 0) return data;
    const kernel = gaussianKernel(radius);
    const kSize = kernel.length;
    const kHalf = Math.floor(kSize / 2);

    // Horizontal pass
    const hPass = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let sum = 0;
            for (let k = 0; k < kSize; k++) {
                const sx = Math.min(w - 1, Math.max(0, x + k - kHalf));
                sum += data[y * w + sx] * kernel[k];
            }
            hPass[y * w + x] = sum;
        }
    }

    // Vertical pass
    const vPass = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let sum = 0;
            for (let k = 0; k < kSize; k++) {
                const sy = Math.min(h - 1, Math.max(0, y + k - kHalf));
                sum += hPass[sy * w + x] * kernel[k];
            }
            vPass[y * w + x] = sum;
        }
    }

    return vPass;
}

/**
 * Morphological dilate (expand mask) by `radius` pixels.
 * Works on a binary 0/255 alpha channel stored as Float32Array.
 */
function dilate(data: Float32Array, w: number, h: number, radius: number): Float32Array {
    if (radius <= 0) return data;
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let maxVal = 0;
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    // Circle structuring element
                    if (dx * dx + dy * dy > radius * radius) continue;
                    const ny = y + dy, nx = x + dx;
                    if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
                        maxVal = Math.max(maxVal, data[ny * w + nx]);
                    }
                }
            }
            out[y * w + x] = maxVal;
        }
    }
    return out;
}

/**
 * Morphological erode (contract mask) by `radius` pixels.
 */
function erode(data: Float32Array, w: number, h: number, radius: number): Float32Array {
    if (radius <= 0) return data;
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let minVal = 255;
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    if (dx * dx + dy * dy > radius * radius) continue;
                    const ny = y + dy, nx = x + dx;
                    if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
                        minVal = Math.min(minVal, data[ny * w + nx]);
                    }
                }
            }
            out[y * w + x] = minVal;
        }
    }
    return out;
}

// ─── Main refinement pipeline ──────────────────────────────────

function refineMask(
    maskData: Uint8ClampedArray,
    w: number,
    h: number,
    params: RefinementParams
): { data: ArrayBuffer; width: number; height: number } {
    const pixelCount = w * h;

    // Step 1: Extract alpha channel as Float32
    let alpha = new Float32Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
        alpha[i] = maskData[i * 4 + 3]; // Alpha channel
    }

    // Step 2: Threshold binarization
    postMessage({ type: 'progress', stage: 'Applying threshold...', percent: 20 });
    const thresh = params.threshold;
    for (let i = 0; i < pixelCount; i++) {
        alpha[i] = alpha[i] >= thresh ? 255 : 0;
    }

    // Step 3: Expand / contract via morphological ops
    postMessage({ type: 'progress', stage: 'Adjusting mask boundary...', percent: 40 });
    const expandPx = Math.round(params.expand * (Math.min(w, h) / 200)); // Scale to image size
    if (expandPx > 0) {
        alpha = dilate(alpha, w, h, Math.min(expandPx, 20)) as Float32Array<ArrayBuffer>;
    } else if (expandPx < 0) {
        alpha = erode(alpha, w, h, Math.min(Math.abs(expandPx), 20)) as Float32Array<ArrayBuffer>;
    }

    // Step 4: Feather via Gaussian blur on alpha
    postMessage({ type: 'progress', stage: 'Feathering edges...', percent: 60 });
    const featherRadius = Math.round(params.feather * (Math.min(w, h) / 400));
    if (featherRadius > 0) {
        alpha = blurChannel(alpha, w, h, Math.min(featherRadius, 30)) as Float32Array<ArrayBuffer>;
    }

    // Step 5: Soft edge smoothing
    postMessage({ type: 'progress', stage: 'Smoothing edges...', percent: 80 });
    if (params.softEdge > 0) {
        const smoothRadius = Math.round(params.softEdge * 0.15);
        if (smoothRadius > 0) {
            alpha = blurChannel(alpha, w, h, Math.min(smoothRadius, 15)) as Float32Array<ArrayBuffer>;
        }
    }

    // Write back to RGBA
    postMessage({ type: 'progress', stage: 'Finalizing...', percent: 95 });
    const outData = new Uint8ClampedArray(pixelCount * 4);
    for (let i = 0; i < pixelCount; i++) {
        const idx = i * 4;
        outData[idx] = maskData[idx];
        outData[idx + 1] = maskData[idx + 1];
        outData[idx + 2] = maskData[idx + 2];
        outData[idx + 3] = Math.round(Math.max(0, Math.min(255, alpha[i])));
    }

    return { data: outData.buffer as ArrayBuffer, width: w, height: h };
}

// ─── Message handler ───────────────────────────────────────────

self.onmessage = (e: MessageEvent) => {
    const { type, maskData, width, height, params } = e.data;

    try {
        switch (type) {
            case 'refine-mask': {
                postMessage({ type: 'progress', stage: 'Starting refinement...', percent: 5 });
                const pixels = new Uint8ClampedArray(maskData);
                const result = refineMask(pixels, width, height, params);
                postMessage({ type: 'progress', stage: 'Complete', percent: 100 });
                postMessage(
                    { type: 'result', action: 'refine-mask', maskData: result.data, width: result.width, height: result.height },
                    { transfer: [result.data] }
                );
                break;
            }

            default:
                postMessage({ type: 'error', message: `Unknown message type: ${type}` });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Refinement worker error';
        postMessage({ type: 'error', message });
    }
};
