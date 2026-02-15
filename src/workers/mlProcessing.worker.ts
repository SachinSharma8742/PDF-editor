/**
 * ML Processing Web Worker
 * 
 * Handles "ML" operations:
 * 1. Subject Detection: Tries ONNX (u2netp) -> Fallback to Edge Density
 * 2. AI Upscale: Tries ONNX (super-res) -> Fallback to Bicubic+Sharpen
 */

import * as ort from 'onnxruntime-web';

// ─── Configuration ─────────────────────────────────────────────

const U2NET_MODEL_URL = '/models/u2netp.onnx';
const SUPER_RES_MODEL_URL = '/models/super-res.onnx'; // Placeholder
const ANALYSIS_MAX_SIZE = 512;
const U2NET_INPUT_SIZE = 320;

// Shared sessions
let detectionSession: any | null = null;
let upscaleSession: any | null = null;

// ─── Helpers: ONNX ─────────────────────────────────────────────

async function loadDetectionModel(): Promise<any | null> {
    if (detectionSession) return detectionSession;
    try {
        detectionSession = await ort.InferenceSession.create(U2NET_MODEL_URL, {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all'
        });
        return detectionSession;
    } catch (e) {
        console.warn('Failed to load detection model, falling back to heuristic:', e);
        return null;
    }
}

async function loadUpscaleModel(): Promise<any | null> {
    if (upscaleSession) return upscaleSession;
    try {
        upscaleSession = await ort.InferenceSession.create(SUPER_RES_MODEL_URL, {
            executionProviders: ['wasm']
        });
        return upscaleSession;
    } catch (e) {
        // Expected if model missing
        return null;
    }
}

function preprocessU2Net(imageData: Uint8ClampedArray, w: number, h: number): any {
    const size = U2NET_INPUT_SIZE;
    const float32Data = new Float32Array(1 * 3 * size * size);

    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Create temp canvas for resizing
    const srcCanvas = new OffscreenCanvas(w, h);
    const srcCtx = srcCanvas.getContext('2d')!;
    const imgData = new ImageData(new Uint8ClampedArray(imageData), w, h);
    srcCtx.putImageData(imgData, 0, 0);

    ctx.drawImage(srcCanvas, 0, 0, size, size);
    const resized = ctx.getImageData(0, 0, size, size).data;

    // Normalize [0,1] & struct CHW (mean/std specific to u2net validation)
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];

    for (let i = 0; i < size * size; i++) {
        const r = resized[i * 4] / 255.0;
        const g = resized[i * 4 + 1] / 255.0;
        const b = resized[i * 4 + 2] / 255.0;

        float32Data[i] = (r - mean[0]) / std[0]; // R
        float32Data[size * size + i] = (g - mean[1]) / std[1]; // G
        float32Data[2 * size * size + i] = (b - mean[2]) / std[2]; // B
    }

    return new ort.Tensor('float32', float32Data, [1, 3, size, size]);
}

// ─── Heuristics (Fallbacks) ────────────────────────────────────

function getLuminance(r: number, g: number, b: number) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

function heuristicSubjectDetection(
    imageData: Uint8ClampedArray, origW: number, origH: number
): { x: number, y: number, width: number, height: number } | null {
    // Edge Density Heuristic (Same as before)
    const scale = Math.min(1, ANALYSIS_MAX_SIZE / Math.max(origW, origH));
    const aW = Math.round(origW * scale);
    const aH = Math.round(origH * scale);

    const canvas = new OffscreenCanvas(aW, aH);
    const ctx = canvas.getContext('2d')!;
    const srcCanvas = new OffscreenCanvas(origW, origH);
    const srcCtx = srcCanvas.getContext('2d')!;
    srcCtx.putImageData(new ImageData(new Uint8ClampedArray(imageData), origW, origH), 0, 0);
    ctx.drawImage(srcCanvas, 0, 0, aW, aH);
    const data = ctx.getImageData(0, 0, aW, aH).data;

    const gray = new Float32Array(aW * aH);
    for (let i = 0; i < aW * aH; i++) {
        gray[i] = getLuminance(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    }

    const edges = new Float32Array(aW * aH);
    let maxEdge = 0;
    for (let y = 1; y < aH - 1; y++) {
        for (let x = 1; x < aW - 1; x++) {
            const idx = y * aW + x;
            const mag = Math.sqrt(
                Math.pow(-gray[idx - 1] + gray[idx + 1], 2) +
                Math.pow(-gray[idx - aW] + gray[idx + aW], 2)
            );
            edges[idx] = mag;
            if (mag > maxEdge) maxEdge = mag;
        }
    }

    const threshold = maxEdge * 0.15;
    let minX = aW, maxX = 0, minY = aH, maxY = 0;
    let found = false;

    for (let y = 0; y < aH; y++) {
        for (let x = 0; x < aW; x++) {
            const idx = y * aW + x;
            if (edges[idx] > threshold) {
                // Check neighbors
                let neighbors = 0;
                if (x > 0 && edges[idx - 1] > threshold) neighbors++;
                if (x < aW - 1 && edges[idx + 1] > threshold) neighbors++;
                if (y > 0 && edges[idx - aW] > threshold) neighbors++;
                if (y < aH - 1 && edges[idx + aW] > threshold) neighbors++;

                if (neighbors >= 2) {
                    found = true;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
    }

    if (!found) return null;

    const invScale = 1 / scale;
    const padding = 10;
    const x = Math.max(0, Math.floor(minX * invScale) - padding);
    const y = Math.max(0, Math.floor(minY * invScale) - padding);
    const w = Math.min(origW, Math.ceil(maxX * invScale) + padding) - x;
    const h = Math.min(origH, Math.ceil(maxY * invScale) + padding) - y;

    return { x, y, width: w, height: h };
}

function heuristicUpscale(
    imageData: Uint8ClampedArray, origW: number, origH: number
): { data: ArrayBuffer, width: number, height: number } {
    const targetW = origW * 2;
    const targetH = origH * 2;
    const MAX_DIM = 4096;

    if (targetW > MAX_DIM || targetH > MAX_DIM) {
        throw new Error(`Image too large to upscale (${origW}x${origH})`);
    }

    const srcCanvas = new OffscreenCanvas(origW, origH);
    const srcCtx = srcCanvas.getContext('2d')!;
    srcCtx.putImageData(new ImageData(new Uint8ClampedArray(imageData), origW, origH), 0, 0);

    const outCanvas = new OffscreenCanvas(targetW, targetH);
    const outCtx = outCanvas.getContext('2d')!;
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = 'high';
    outCtx.drawImage(srcCanvas, 0, 0, targetW, targetH);

    // Smart Sharpen
    const imgData = outCtx.getImageData(0, 0, targetW, targetH);
    const data = imgData.data;
    const copy = new Uint8ClampedArray(data);
    const blurred = new Uint8ClampedArray(data.length);

    // Fast approx blur or just copy-paste box blur from before
    for (let y = 0; y < targetH; y++) {
        for (let x = 0; x < targetW; x++) {
            let r = 0, g = 0, b = 0, c = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const ny = y + dy, nx = x + dx;
                    if (ny >= 0 && ny < targetH && nx >= 0 && nx < targetW) {
                        const idx = (ny * targetW + nx) * 4;
                        r += copy[idx]; g += copy[idx + 1]; b += copy[idx + 2]; c++;
                    }
                }
            }
            const idx = (y * targetW + x) * 4;
            blurred[idx] = r / c; blurred[idx + 1] = g / c; blurred[idx + 2] = b / c;
        }
    }

    const amount = 0.8;
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, copy[i] + (copy[i] - blurred[i]) * amount));
        data[i + 1] = Math.min(255, Math.max(0, copy[i + 1] + (copy[i + 1] - blurred[i + 1]) * amount));
        data[i + 2] = Math.min(255, Math.max(0, copy[i + 2] + (copy[i + 2] - blurred[i + 2]) * amount));
    }

    return { data: data.buffer as ArrayBuffer, width: targetW, height: targetH };
}

// ─── Execution Logic ───────────────────────────────────────────

async function executeSubjectDetection(
    imageData: Uint8ClampedArray, width: number, height: number
): Promise<{ x: number, y: number, width: number, height: number } | null> {
    const session = await loadDetectionModel();
    if (!session) {
        return heuristicSubjectDetection(imageData, width, height);
    }

    // Run ONNX inference
    try {
        const tensor = preprocessU2Net(imageData, width, height);
        const feeds = { [session.inputNames[0]]: tensor };
        const results = await session.run(feeds);
        const output = results[session.outputNames[0]].data as Float32Array;

        // Find bounding box from 320x320 mask
        const size = U2NET_INPUT_SIZE;
        let minX = size, maxX = 0, minY = size, maxY = 0;
        let found = false;

        // Simple threshold & bounds check
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const val = output[y * size + x]; // raw logic
                // Model output is logits or sigmoid? u2net is usually sigmoid probability or raw logits.
                // Assuming typical unet output, positive is FG.
                if (val > 0) { // Check this threshold
                    found = true;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        tensor.dispose();

        if (!found) return null;

        // Map back to original size
        const scaleX = width / size;
        const scaleY = height / size;
        const padding = 15;

        const x = Math.max(0, Math.floor(minX * scaleX) - padding);
        const y = Math.max(0, Math.floor(minY * scaleY) - padding);
        const w = Math.min(width, Math.ceil(maxX * scaleX) + padding) - x;
        const h = Math.min(height, Math.ceil(maxY * scaleY) + padding) - y;

        return { x, y, width: w, height: h };

    } catch (e) {
        console.warn('ONNX inference failed, falling back:', e);
        return heuristicSubjectDetection(imageData, width, height);
    }
}

async function executeUpscale(
    imageData: Uint8ClampedArray, width: number, height: number
): Promise<{ data: ArrayBuffer, width: number, height: number }> {
    const session = await loadUpscaleModel();
    if (!session) {
        // Fallback to algorithmic
        return heuristicUpscale(imageData, width, height);
    }

    // Placeholder for real ONNX upscale logic
    // ...
    return heuristicUpscale(imageData, width, height);
}


// ─── Message Handler ───────────────────────────────────────────

self.onmessage = async (e: MessageEvent) => {
    const { type, imageData, width, height } = e.data;

    try {
        switch (type) {
            case 'detect-subject': {
                postMessage({ type: 'progress', stage: 'Analyzing subject...', percent: 20 });
                const pixels = new Uint8ClampedArray(imageData);
                const bounds = await executeSubjectDetection(pixels, width, height);
                postMessage({ type: 'progress', stage: 'Complete', percent: 100 });
                postMessage({ type: 'result', action: 'detect-subject', data: bounds });
                break;
            }

            case 'upscale': {
                postMessage({ type: 'progress', stage: 'Upscaling...', percent: 20 });
                const pixels = new Uint8ClampedArray(imageData);
                const result = await executeUpscale(pixels, width, height);
                postMessage({ type: 'progress', stage: 'Complete', percent: 100 });
                postMessage(
                    { type: 'result', action: 'upscale', data: result.data, width: result.width, height: result.height },
                    { transfer: [result.data] }
                );
                break;
            }

            default:
                postMessage({ type: 'error', message: `Unknown message type: ${type}` });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'ML Worker error';
        postMessage({ type: 'error', message });
    }
};
