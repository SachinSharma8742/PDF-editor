/**
 * Document Analysis Web Worker
 * 
 * Handles structural analysis of document images.
 * - OCR Region Assist: Text block detection via dense edge clustering.
 * - Page Segmentation: Header/Footer/Body/Column detection via projection profiles.
 */

export type RegionType = 'text' | 'image' | 'header' | 'footer' | 'body' | 'ocr';

export interface AnalysisRegion {
    x: number;
    y: number;
    width: number;
    height: number;
    type: RegionType;
}

// ─── Helpers ─────────────────────────────────────────────

function downscaleForAnalysis(
    imageData: Uint8ClampedArray, width: number, height: number, maxSize: number = 800
) {
    const scale = Math.min(1, maxSize / Math.max(width, height));
    const dw = Math.round(width * scale);
    const dh = Math.round(height * scale);

    const canvas = new OffscreenCanvas(dw, dh);
    const ctx = canvas.getContext('2d')!;
    const srcCanvas = new OffscreenCanvas(width, height);
    const srcCtx = srcCanvas.getContext('2d')!;
    // Cast to satisfy type checker if needed, but standard ImageData works
    srcCtx.putImageData(new ImageData(new Uint8ClampedArray(imageData) as any, width, height), 0, 0);
    ctx.drawImage(srcCanvas, 0, 0, dw, dh);

    return { ctx, scale, dw, dh };
}

function getGrayscale(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number): Uint8ClampedArray {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const gray = new Uint8ClampedArray(w * h);
    for (let i = 0; i < w * h; i++) {
        gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    }
    return gray;
}

// ─── OCR Region Assist ─────────────────────────────────────────────

function executeOCRRegionAssist(
    imageData: Uint8ClampedArray, width: number, height: number
): AnalysisRegion[] {
    const { ctx, scale, dw, dh } = downscaleForAnalysis(imageData, width, height, 600);
    const gray = getGrayscale(ctx, dw, dh);

    // 1. Edge Detection (Sobel)
    const edges = new Uint8ClampedArray(dw * dh);
    const threshold = 30;

    for (let y = 1; y < dh - 1; y++) {
        for (let x = 1; x < dw - 1; x++) {
            const idx = y * dw + x;
            const gx = -gray[idx - 1 - dw] + gray[idx + 1 - dw]
                - 2 * gray[idx - 1] + 2 * gray[idx + 1]
                - gray[idx - 1 + dw] + gray[idx + 1 + dw];
            const gy = -gray[idx - 1 - dw] - 2 * gray[idx - dw] - gray[idx + 1 - dw]
                + gray[idx - 1 + dw] + 2 * gray[idx + dw] + gray[idx + 1 + dw];

            const mag = Math.sqrt(gx * gx + gy * gy);
            edges[idx] = mag > threshold ? 255 : 0;
        }
    }

    // 2. Morphological Closing (Smear)
    const dilated = new Uint8ClampedArray(dw * dh);
    const buffer = new Uint8ClampedArray(dw * dh); // Temp buffer

    // Horizontal Smear (connect chars into words/lines)
    const smearX = 12;
    for (let y = 0; y < dh; y++) {
        let run = 0;
        for (let x = 0; x < dw; x++) {
            if (edges[y * dw + x] === 255) {
                if (run > 0 && run < smearX) {
                    for (let k = 1; k <= run; k++) buffer[y * dw + (x - k)] = 255;
                }
                run = 0;
                buffer[y * dw + x] = 255;
            } else run++;
        }
    }

    // Vertical Dilation (connect lines into blocks)
    const dR = 3;
    for (let y = dR; y < dh - dR; y++) {
        for (let x = dR; x < dw - dR; x++) {
            if (buffer[y * dw + x] === 255) {
                for (let dy = -dR; dy <= dR; dy++) {
                    for (let dx = -dR; dx <= dR; dx++) {
                        dilated[(y + dy) * dw + (x + dx)] = 255;
                    }
                }
            }
        }
    }

    // 3. Connected Components
    const visited = new Uint8ClampedArray(dw * dh);
    const regions: AnalysisRegion[] = [];
    const minArea = (dw * dh) * 0.0005;

    for (let i = 0; i < dw * dh; i++) {
        if (dilated[i] === 255 && visited[i] === 0) {
            const stack = [i];
            visited[i] = 1;
            let minX = i % dw, maxX = minX, minY = Math.floor(i / dw), maxY = minY;
            let count = 0;

            while (stack.length) {
                const curr = stack.pop()!;
                const cx = curr % dw;
                const cy = Math.floor(curr / dw);
                count++;

                if (cx < minX) minX = cx;
                if (cx > maxX) maxX = cx;
                if (cy < minY) minY = cy;
                if (cy > maxY) maxY = cy;

                const nbs = [curr - 1, curr + 1, curr - dw, curr + dw];
                for (const n of nbs) {
                    if (n >= 0 && n < dw * dh && dilated[n] === 255 && visited[n] === 0) {
                        visited[n] = 1;
                        stack.push(n);
                    }
                }
            }

            if (count > minArea) {
                regions.push({
                    x: Math.round(minX / scale),
                    y: Math.round(minY / scale),
                    width: Math.round((maxX - minX) / scale),
                    height: Math.round((maxY - minY) / scale),
                    type: 'ocr'
                });
            }
        }
    }

    return regions;
}

// ─── Page Segmentation ─────────────────────────────────────────────

function executePageSegmentation(
    imageData: Uint8ClampedArray, width: number, height: number
): AnalysisRegion[] {
    const { ctx, scale, dw, dh } = downscaleForAnalysis(imageData, width, height, 512);
    const gray = getGrayscale(ctx, dw, dh);

    // Horizontal Projection Profile
    // Binarize first (simple threshold)
    const binary = new Uint8Array(dw * dh);
    for (let i = 0; i < dw * dh; i++) binary[i] = gray[i] < 200 ? 1 : 0; // Dark pixels = 1

    const hpp = new Uint32Array(dh);
    for (let y = 0; y < dh; y++) {
        let sum = 0;
        for (let x = 0; x < dw; x++) sum += binary[y * dw + x];
        hpp[y] = sum;
    }

    // Smooth HPP
    const smoothed = new Float32Array(dh);
    for (let y = 2; y < dh - 2; y++) {
        let s = 0;
        for (let k = -2; k <= 2; k++) s += hpp[y + k];
        smoothed[y] = s / 5;
    }

    // Isolate significant regions
    const thresh = dw * 0.05;
    const blocks: { y1: number, y2: number }[] = [];
    let start = -1;

    for (let y = 0; y < dh; y++) {
        if (smoothed[y] > thresh) {
            if (start === -1) start = y;
        } else {
            if (start !== -1) {
                if (y - start > 10) blocks.push({ y1: start, y2: y }); // Filter tiny/noise lines
                start = -1;
            }
        }
    }
    if (start !== -1) blocks.push({ y1: start, y2: dh });

    // Classify
    const regions: AnalysisRegion[] = [];
    const headerLimit = dh * 0.15;
    const footerLimit = dh * 0.85;

    blocks.forEach(b => {
        const mid = (b.y1 + b.y2) / 2;
        let type: RegionType = 'body';
        if (mid < headerLimit) type = 'header';
        else if (mid > footerLimit) type = 'footer';

        regions.push({
            x: 0,
            y: Math.round(b.y1 / scale),
            width: width,
            height: Math.round((b.y2 - b.y1) / scale),
            type: type
        });
    });

    return regions;
}

// ─── Handler ─────────────────────────────────────────────

self.onmessage = async (e: MessageEvent) => {
    const { type, imageData, width, height } = e.data;
    try {
        if (type === 'ocr-region-assist') {
            postMessage({ type: 'progress', stage: 'Scanning text density...', percent: 20 });
            const regions = executeOCRRegionAssist(new Uint8ClampedArray(imageData), width, height);
            postMessage({ type: 'progress', stage: 'Complete', percent: 100 });
            postMessage({ type: 'result', action: 'ocr-region-assist', regions });
        } else if (type === 'segment-page') {
            postMessage({ type: 'progress', stage: 'Analyzing page structure...', percent: 30 });
            const regions = executePageSegmentation(new Uint8ClampedArray(imageData), width, height);
            postMessage({ type: 'progress', stage: 'Complete', percent: 100 });
            postMessage({ type: 'result', action: 'segment-page', regions });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Analysis Error';
        postMessage({ type: 'error', message });
    }
};
