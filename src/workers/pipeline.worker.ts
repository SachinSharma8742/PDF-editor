/**
 * Pipeline Web Worker
 *
 * Handles heavy pixel operations for the scan repair pipeline:
 * noise reduction (box blur) and edge sharpening (unsharp mask).
 *
 * Messages IN:
 *   { type: 'noise-reduce', imageData: ArrayBuffer, width, height }
 *   { type: 'sharpen',      imageData: ArrayBuffer, width, height }
 *
 * Messages OUT:
 *   { type: 'progress', stage, percent }
 *   { type: 'result', action, imageData: ArrayBuffer, width, height }
 *   { type: 'error', message }
 */

// ─── Kernel helpers ────────────────────────────────────────────

function boxBlur3x3(
    channel: Float32Array, w: number, h: number
): Float32Array {
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let sum = 0;
            let count = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const ny = y + dy, nx = x + dx;
                    if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
                        sum += channel[ny * w + nx];
                        count++;
                    }
                }
            }
            out[y * w + x] = sum / count;
        }
    }
    return out;
}

// ─── Noise Reduction ───────────────────────────────────────────

function executeNoiseReduce(
    imageData: Uint8ClampedArray, w: number, h: number
): { data: ArrayBuffer; width: number; height: number } {
    const pixelCount = w * h;

    // Extract channels
    const rCh = new Float32Array(pixelCount);
    const gCh = new Float32Array(pixelCount);
    const bCh = new Float32Array(pixelCount);

    for (let i = 0; i < pixelCount; i++) {
        const idx = i * 4;
        rCh[i] = imageData[idx];
        gCh[i] = imageData[idx + 1];
        bCh[i] = imageData[idx + 2];
    }

    // Selective blur: only smooth light areas (background noise)
    // preserve dark areas (text/content)
    const rBlurred = boxBlur3x3(rCh, w, h);
    const gBlurred = boxBlur3x3(gCh, w, h);
    const bBlurred = boxBlur3x3(bCh, w, h);

    for (let i = 0; i < pixelCount; i++) {
        const lum = 0.299 * rCh[i] + 0.587 * gCh[i] + 0.114 * bCh[i];
        // Blend factor: more blur for lighter pixels (noise in background)
        if (lum > 160) {
            const t = Math.min(1, (lum - 160) / 95);
            rCh[i] = rCh[i] * (1 - t) + rBlurred[i] * t;
            gCh[i] = gCh[i] * (1 - t) + gBlurred[i] * t;
            bCh[i] = bCh[i] * (1 - t) + bBlurred[i] * t;
        }
    }

    // Write back
    const outData = new Uint8ClampedArray(pixelCount * 4);
    for (let i = 0; i < pixelCount; i++) {
        const idx = i * 4;
        outData[idx] = Math.round(rCh[i]);
        outData[idx + 1] = Math.round(gCh[i]);
        outData[idx + 2] = Math.round(bCh[i]);
        outData[idx + 3] = imageData[idx + 3];
    }

    return { data: outData.buffer as ArrayBuffer, width: w, height: h };
}

// ─── Edge Sharpening ───────────────────────────────────────────

function executeSharpen(
    imageData: Uint8ClampedArray, w: number, h: number
): { data: ArrayBuffer; width: number; height: number } {
    const pixelCount = w * h;

    const rCh = new Float32Array(pixelCount);
    const gCh = new Float32Array(pixelCount);
    const bCh = new Float32Array(pixelCount);

    for (let i = 0; i < pixelCount; i++) {
        const idx = i * 4;
        rCh[i] = imageData[idx];
        gCh[i] = imageData[idx + 1];
        bCh[i] = imageData[idx + 2];
    }

    // Unsharp mask: sharpen = original + amount * (original - blurred)
    const rBlurred = boxBlur3x3(rCh, w, h);
    const gBlurred = boxBlur3x3(gCh, w, h);
    const bBlurred = boxBlur3x3(bCh, w, h);

    const sharpenAmount = 0.4; // Moderate sharpening
    for (let i = 0; i < pixelCount; i++) {
        const lum = 0.299 * rCh[i] + 0.587 * gCh[i] + 0.114 * bCh[i];
        // Only sharpen dark content areas (text, lines), not background
        if (lum < 200) {
            rCh[i] = Math.min(255, Math.max(0, rCh[i] + (rCh[i] - rBlurred[i]) * sharpenAmount));
            gCh[i] = Math.min(255, Math.max(0, gCh[i] + (gCh[i] - gBlurred[i]) * sharpenAmount));
            bCh[i] = Math.min(255, Math.max(0, bCh[i] + (bCh[i] - bBlurred[i]) * sharpenAmount));
        }
    }

    const outData = new Uint8ClampedArray(pixelCount * 4);
    for (let i = 0; i < pixelCount; i++) {
        const idx = i * 4;
        outData[idx] = Math.round(rCh[i]);
        outData[idx + 1] = Math.round(gCh[i]);
        outData[idx + 2] = Math.round(bCh[i]);
        outData[idx + 3] = imageData[idx + 3];
    }

    return { data: outData.buffer as ArrayBuffer, width: w, height: h };
}

// ─── Message handler ───────────────────────────────────────────

self.onmessage = (e: MessageEvent) => {
    const { type, imageData, width, height } = e.data;

    try {
        switch (type) {
            case 'noise-reduce': {
                postMessage({ type: 'progress', stage: 'Reducing noise...', percent: 30 });
                const pixels = new Uint8ClampedArray(imageData);
                const result = executeNoiseReduce(pixels, width, height);
                postMessage({ type: 'progress', stage: 'Complete', percent: 100 });
                postMessage(
                    { type: 'result', action: 'noise-reduce', imageData: result.data, width: result.width, height: result.height },
                    { transfer: [result.data] }
                );
                break;
            }

            case 'sharpen': {
                postMessage({ type: 'progress', stage: 'Sharpening edges...', percent: 30 });
                const pixels = new Uint8ClampedArray(imageData);
                const result = executeSharpen(pixels, width, height);
                postMessage({ type: 'progress', stage: 'Complete', percent: 100 });
                postMessage(
                    { type: 'result', action: 'sharpen', imageData: result.data, width: result.width, height: result.height },
                    { transfer: [result.data] }
                );
                break;
            }

            default:
                postMessage({ type: 'error', message: `Unknown message type: ${type}` });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Pipeline worker error';
        postMessage({ type: 'error', message });
    }
};
