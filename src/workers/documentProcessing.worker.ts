/**
 * Document Processing Web Worker
 * 
 * Handles document-specific image enhancements and analysis.
 * Uses OffscreenCanvas for pixel manipulation.
 * 
 * Messages IN:
 *   { type: 'auto-cleanup', imageData: ArrayBuffer, width, height }
 *   { type: 'detect-layout', imageData: ArrayBuffer, width, height }
 * 
 * Messages OUT:
 *   { type: 'progress', stage, percent }
 *   { type: 'result', action: 'auto-cleanup', imageData: ArrayBuffer, width, height }
 *   { type: 'result', action: 'detect-layout', regions: Array<{ x, y, width, height, type: 'text'|'image' }> }
 *   { type: 'error', message }
 */

// ─── Document Cleanup ─────────────────────────────────────────────

function adaptiveThreshold(
    imageData: Uint8ClampedArray, width: number, height: number, blockSize: number = 31, C: number = 10
): Uint8ClampedArray {
    // 1. Grayscale
    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0; i < width * height; i++) {
        gray[i] = 0.299 * imageData[i * 4] + 0.587 * imageData[i * 4 + 1] + 0.114 * imageData[i * 4 + 2];
    }

    // 2. Integral Image for fast local mean
    const integral = new Float64Array(width * height);
    for (let y = 0; y < height; y++) {
        let sum = 0;
        for (let x = 0; x < width; x++) {
            sum += gray[y * width + x];
            if (y === 0) {
                integral[y * width + x] = sum;
            } else {
                integral[y * width + x] = sum + integral[(y - 1) * width + x];
            }
        }
    }

    function getSum(x1: number, y1: number, x2: number, y2: number) {
        let res = integral[y2 * width + x2];
        if (y1 > 0) res -= integral[(y1 - 1) * width + x2];
        if (x1 > 0) res -= integral[y2 * width + (x1 - 1)];
        if (x1 > 0 && y1 > 0) res += integral[(y1 - 1) * width + (x1 - 1)];
        return res;
    }

    // 3. Adaptive filter
    const result = new Uint8ClampedArray(imageData.length);
    const half = Math.floor(blockSize / 2);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const x1 = Math.max(0, x - half);
            const y1 = Math.max(0, y - half);
            const x2 = Math.min(width - 1, x + half);
            const y2 = Math.min(height - 1, y + half);

            const count = (x2 - x1 + 1) * (y2 - y1 + 1);
            const sum = getSum(x1, y1, x2, y2);
            const mean = sum / count;

            const idx = (y * width + x) * 4;
            const val = gray[y * width + x];

            // If pixel is significantly darker than local mean -> text (black)
            // Else -> background (white)
            // But we want "cleanup", not binarization. So we normalize.
            // Simplified approach: Background subtraction or Division
            // Let's implement background division for uniform illumination

            // This is "division normalization": Pixel / Mean * 255
            // But usually we just want to remove shadows.
            // Let's use a simpler heuristic for cleanup:
            // if (val < mean - C) keep as is (darker), else push towards white.
            // Or use the adaptive mean as the "white point".

            // "Digital document look": High contrast, white background.
            // Let's blend towards white if close to local mean.

            const diff = mean - val;
            let outputVal = val;

            if (diff < C) {
                // Background region: boost to white
                // Smooth falloff from C to 0
                outputVal = 255;
                // Or: outputVal = val + (255 - val) * 0.8; // lighten
            } else {
                // Text region: boost contrast
                // outputVal = val * 0.8; // darken
                outputVal = Math.max(0, val - 30);
            }

            result[idx] = outputVal;
            result[idx + 1] = outputVal;
            result[idx + 2] = outputVal; // Force grayscale
            result[idx + 3] = imageData[idx + 3]; // Alpha
        }
    }
    return result;
}

function executeCleanup(imageData: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    // Resize for analysis (if needed) but we operate on full res for final output
    // Step 1: Adaptive Threshold / Normalization
    // Use a large block size to estimate background illumination
    const blockSize = Math.max(width, height) / 20; // e.g. 50-100px window
    return adaptiveThreshold(imageData, width, height, blockSize, 15);
}

// ─── Layout Detection ─────────────────────────────────────────────

function executeLayoutDetection(
    imageData: Uint8ClampedArray, width: number, height: number
): Array<{ x: number, y: number, width: number, height: number, type: 'text' | 'image' }> {
    // 1. Downscale for speed
    const scale = Math.min(1, 512 / Math.max(width, height));
    const dw = Math.round(width * scale);
    const dh = Math.round(height * scale);

    const canvas = new OffscreenCanvas(dw, dh);
    const ctx = canvas.getContext('2d')!;
    const srcCanvas = new OffscreenCanvas(width, height);
    const srcCtx = srcCanvas.getContext('2d')!;
    srcCtx.putImageData(new ImageData(new Uint8ClampedArray(imageData) as any, width, height), 0, 0);
    ctx.drawImage(srcCanvas, 0, 0, dw, dh);

    // 2. Edge Detection (Sobel)
    const imgData = ctx.getImageData(0, 0, dw, dh);
    const data = imgData.data;
    const edges = new Uint8ClampedArray(dw * dh);

    const grayscale = new Uint8ClampedArray(dw * dh);
    for (let i = 0; i < dw * dh; i++) {
        grayscale[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    }

    for (let y = 1; y < dh - 1; y++) {
        for (let x = 1; x < dw - 1; x++) {
            const idx = y * dw + x;
            // Horizontal Gradient
            const gx = -grayscale[idx - 1 - dw] + grayscale[idx + 1 - dw]
                - 2 * grayscale[idx - 1] + 2 * grayscale[idx + 1]
                - grayscale[idx - 1 + dw] + grayscale[idx + 1 + dw];
            // Vertical Gradient
            const gy = -grayscale[idx - 1 - dw] - 2 * grayscale[idx - dw] - grayscale[idx + 1 - dw]
                + grayscale[idx - 1 + dw] + 2 * grayscale[idx + dw] + grayscale[idx + 1 + dw];

            const mag = Math.sqrt(gx * gx + gy * gy);
            edges[idx] = mag > 50 ? 255 : 0; // Binarize edges
        }
    }

    // 3. Morphological Dilation (Smear edges to form blocks)
    // Run multiple passes or use larger kernel
    const dilated = new Uint8ClampedArray(dw * dh);
    const kernelRadius = 4; // Smear text lines together

    for (let y = kernelRadius; y < dh - kernelRadius; y++) {
        for (let x = kernelRadius; x < dw - kernelRadius; x++) {
            // Check if any pixel in window is edge
            let found = false;
            // Horizontal smear more than vertical to link words
            for (let dy = -2; dy <= 2; dy++) {
                for (let dx = -kernelRadius; dx <= kernelRadius; dx++) {
                    if (edges[(y + dy) * dw + (x + dx)] === 255) {
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
            if (found) dilated[y * dw + x] = 255;
        }
    }

    // 4. Connected Components (Simple Bounding Box finding)
    // Identify distinct blobs in 'dilated'
    const visited = new Uint8ClampedArray(dw * dh);
    const regions: Array<{ x: number, y: number, width: number, height: number, type: 'text' | 'image' }> = [];
    const minArea = (dw * dh) * 0.005; // Ignore tiny specks

    for (let y = 0; y < dh; y++) {
        for (let x = 0; x < dw; x++) {
            const idx = y * dw + x;
            if (dilated[idx] === 255 && visited[idx] === 0) {
                // New component found
                let minX = x, maxX = x, minY = y, maxY = y;
                let area = 0;
                const stack = [idx];
                visited[idx] = 1;

                while (stack.length > 0) {
                    const curr = stack.pop()!;
                    const cx = curr % dw;
                    const cy = Math.floor(curr / dw);

                    if (cx < minX) minX = cx;
                    if (cx > maxX) maxX = cx;
                    if (cy < minY) minY = cy;
                    if (cy > maxY) maxY = cy;
                    area++;

                    // 4-connectivity
                    const neighbors = [curr - 1, curr + 1, curr - dw, curr + dw];
                    for (const n of neighbors) {
                        if (n >= 0 && n < dw * dh && dilated[n] === 255 && visited[n] === 0) {
                            visited[n] = 1;
                            stack.push(n);
                        }
                    }
                }

                if (area > minArea) {
                    // Map back to original coordinates
                    regions.push({
                        x: Math.round(minX / scale),
                        y: Math.round(minY / scale),
                        width: Math.round((maxX - minX) / scale),
                        height: Math.round((maxY - minY) / scale),
                        type: 'text' // Heuristic: assume text for now
                    });
                }
            }
        }
    }

    return regions;
}


// ─── Message Handler ─────────────────────────────────────────────

self.onmessage = async (e: MessageEvent) => {
    const { type, imageData, width, height } = e.data;

    try {
        switch (type) {
            case 'auto-cleanup': {
                postMessage({ type: 'progress', stage: 'Analyzing illumination...', percent: 20 });
                const pixels = new Uint8ClampedArray(imageData);
                const cleaned = executeCleanup(pixels, width, height);
                postMessage({ type: 'progress', stage: 'Complete', percent: 100 });
                postMessage(
                    { type: 'result', action: 'auto-cleanup', imageData: cleaned.buffer, width, height },
                    { transfer: [cleaned.buffer] }
                );
                break;
            }

            case 'detect-layout': {
                postMessage({ type: 'progress', stage: 'Scanning structure...', percent: 30 });
                const pixels = new Uint8ClampedArray(imageData);
                const regions = executeLayoutDetection(pixels, width, height);
                postMessage({ type: 'progress', stage: 'Complete', percent: 100 });
                postMessage({ type: 'result', action: 'detect-layout', regions });
                break;
            }

            default:
                postMessage({ type: 'error', message: `Unknown message type: ${type}` });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Worker error';
        postMessage({ type: 'error', message });
    }
};
