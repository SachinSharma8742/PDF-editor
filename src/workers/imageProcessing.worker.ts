/**
 * Image Processing Web Worker
 * 
 * Offloads heavy image analysis from the main thread.
 * Uses OffscreenCanvas for pixel operations.
 * 
 * Messages IN:
 *   { type: 'smart-crop', imageData: ArrayBuffer, width, height }
 *   { type: 'deskew',     imageData: ArrayBuffer, width, height }
 *   { type: 'bg-cleanup', imageData: ArrayBuffer, width, height }
 *   { type: 'color-enhance', imageData: ArrayBuffer, width, height }
 * 
 * Messages OUT:
 *   { type: 'progress', stage, percent }
 *   { type: 'result', action, imageData: ArrayBuffer, width, height }
 *   { type: 'error', message }
 */

const ANALYSIS_MAX_SIZE = 512;
const LUMINANCE_THRESHOLD = 30;
const MAX_ROTATION_DEGREES = 15;

// ─── Shared helpers ────────────────────────────────────────────

function pixelLuminance(r: number, g: number, b: number): number {
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

function toGrayscale(data: Uint8ClampedArray, w: number, h: number): Float32Array {
    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
        const idx = i * 4;
        gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }
    return gray;
}

function detectBgColor(data: Uint8ClampedArray, w: number, h: number) {
    const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1],
    [Math.floor(w / 2), 0], [Math.floor(w / 2), h - 1],
    [0, Math.floor(h / 2)], [w - 1, Math.floor(h / 2)]];
    let rS = 0, gS = 0, bS = 0, c = 0;
    for (const [cx, cy] of corners) {
        const idx = (cy * w + cx) * 4;
        rS += data[idx]; gS += data[idx + 1]; bS += data[idx + 2]; c++;
    }
    return { r: Math.round(rS / c), g: Math.round(gS / c), b: Math.round(bS / c) };
}

// ─── Smart Crop logic ──────────────────────────────────────────

function analyzeSmartCrop(
    imageData: Uint8ClampedArray, origW: number, origH: number
): { cropX: number; cropY: number; cropW: number; cropH: number } | null {
    // Downscale for analysis
    const scale = Math.min(1, ANALYSIS_MAX_SIZE / Math.max(origW, origH));
    const aW = Math.round(origW * scale);
    const aH = Math.round(origH * scale);

    const canvas = new OffscreenCanvas(aW, aH);
    const ctx = canvas.getContext('2d')!;

    // Put original data on a full-size canvas, then draw scaled
    const srcCanvas = new OffscreenCanvas(origW, origH);
    const srcCtx = srcCanvas.getContext('2d')!;
    srcCtx.putImageData(new ImageData(new Uint8ClampedArray(imageData), origW, origH), 0, 0);
    ctx.drawImage(srcCanvas, 0, 0, aW, aH);

    const analysisData = ctx.getImageData(0, 0, aW, aH).data;
    const bg = detectBgColor(analysisData, aW, aH);
    const bgLum = pixelLuminance(bg.r, bg.g, bg.b);

    let top = aH, left = aW, bottom = 0, right = 0;
    let found = false;

    for (let y = 0; y < aH; y++) {
        for (let x = 0; x < aW; x++) {
            const idx = (y * aW + x) * 4;
            if (analysisData[idx + 3] < 10) continue;
            const lum = pixelLuminance(analysisData[idx], analysisData[idx + 1], analysisData[idx + 2]);
            if (Math.abs(lum - bgLum) > LUMINANCE_THRESHOLD) {
                found = true;
                if (y < top) top = y;
                if (y > bottom) bottom = y;
                if (x < left) left = x;
                if (x > right) right = x;
            }
        }
    }

    if (!found) return null;

    const padding = 8;
    const invScale = 1 / scale;
    const cropX = Math.max(0, Math.floor(left * invScale) - padding);
    const cropY = Math.max(0, Math.floor(top * invScale) - padding);
    const cropR = Math.min(origW, Math.ceil(right * invScale) + padding);
    const cropB = Math.min(origH, Math.ceil(bottom * invScale) + padding);
    const cropW = cropR - cropX;
    const cropH = cropB - cropY;

    // Skip if crop is essentially the full image
    if (cropW >= origW - padding * 2 && cropH >= origH - padding * 2) return null;

    return { cropX, cropY, cropW, cropH };
}

function executeSmartCrop(
    imageData: Uint8ClampedArray, origW: number, origH: number,
    crop: { cropX: number; cropY: number; cropW: number; cropH: number }
): { data: ArrayBuffer; width: number; height: number } {
    const srcCanvas = new OffscreenCanvas(origW, origH);
    const srcCtx = srcCanvas.getContext('2d')!;
    srcCtx.putImageData(new ImageData(new Uint8ClampedArray(imageData), origW, origH), 0, 0);

    const outCanvas = new OffscreenCanvas(crop.cropW, crop.cropH);
    const outCtx = outCanvas.getContext('2d')!;
    outCtx.drawImage(srcCanvas, crop.cropX, crop.cropY, crop.cropW, crop.cropH, 0, 0, crop.cropW, crop.cropH);

    const result = outCtx.getImageData(0, 0, crop.cropW, crop.cropH);
    return { data: result.data.buffer as ArrayBuffer, width: crop.cropW, height: crop.cropH };
}

// ─── Deskew logic ──────────────────────────────────────────────

function analyzeDeskew(
    imageData: Uint8ClampedArray, origW: number, origH: number
): number {
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
    const gray = toGrayscale(data, aW, aH);

    // Sobel
    const magnitude = new Float32Array(aW * aH);
    const angle = new Float32Array(aW * aH);
    for (let y = 1; y < aH - 1; y++) {
        for (let x = 1; x < aW - 1; x++) {
            const tl = gray[(y - 1) * aW + (x - 1)];
            const tc = gray[(y - 1) * aW + x];
            const tr = gray[(y - 1) * aW + (x + 1)];
            const ml = gray[y * aW + (x - 1)];
            const mr = gray[y * aW + (x + 1)];
            const bl = gray[(y + 1) * aW + (x - 1)];
            const bc = gray[(y + 1) * aW + x];
            const br = gray[(y + 1) * aW + (x + 1)];
            const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
            const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
            const idx = y * aW + x;
            magnitude[idx] = Math.sqrt(gx * gx + gy * gy);
            angle[idx] = Math.atan2(gy, gx);
        }
    }

    // Threshold top 20% edges
    const sorted = Float32Array.from(magnitude).sort();
    const threshold = sorted[Math.floor(sorted.length * 0.8)] || 1;

    // Angle histogram
    const binCount = 180;
    const binSize = 0.5;
    const histogram = new Float32Array(binCount);

    for (let i = 0; i < magnitude.length; i++) {
        if (magnitude[i] < threshold) continue;
        let lineAngle = angle[i] * (180 / Math.PI) + 90;
        while (lineAngle >= 90) lineAngle -= 180;
        while (lineAngle < -90) lineAngle += 180;
        if (Math.abs(lineAngle) <= 45) {
            const bin = Math.floor((lineAngle + 45) / binSize);
            if (bin >= 0 && bin < binCount) histogram[bin] += magnitude[i];
        }
    }

    let maxVal = 0, maxBin = binCount / 2;
    for (let i = 0; i < binCount; i++) {
        if (histogram[i] > maxVal) { maxVal = histogram[i]; maxBin = i; }
    }

    if (maxVal === 0) return 0;
    const dominantAngle = (maxBin * binSize) - 45;
    return Math.max(-MAX_ROTATION_DEGREES, Math.min(MAX_ROTATION_DEGREES, dominantAngle));
}

function executeDeskew(
    imageData: Uint8ClampedArray, origW: number, origH: number, angleDeg: number
): { data: ArrayBuffer; width: number; height: number } {
    const radians = -angleDeg * (Math.PI / 180);
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    const newW = Math.ceil(origW * cos + origH * sin);
    const newH = Math.ceil(origH * cos + origW * sin);

    const srcCanvas = new OffscreenCanvas(origW, origH);
    const srcCtx = srcCanvas.getContext('2d')!;
    srcCtx.putImageData(new ImageData(new Uint8ClampedArray(imageData), origW, origH), 0, 0);

    // Background color
    const srcData = srcCtx.getImageData(0, 0, origW, origH).data;
    const bg = detectBgColor(srcData, origW, origH);

    const outCanvas = new OffscreenCanvas(newW, newH);
    const outCtx = outCanvas.getContext('2d')!;
    outCtx.fillStyle = `rgb(${bg.r},${bg.g},${bg.b})`;
    outCtx.fillRect(0, 0, newW, newH);
    outCtx.translate(newW / 2, newH / 2);
    outCtx.rotate(radians);
    outCtx.drawImage(srcCanvas, -origW / 2, -origH / 2);

    const result = outCtx.getImageData(0, 0, newW, newH);
    return { data: result.data.buffer as ArrayBuffer, width: newW, height: newH };
}

// ─── Background Cleanup logic ──────────────────────────────────

function boxBlur3x3(channel: Float32Array, w: number, h: number): Float32Array {
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let sum = 0, cnt = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const ny = y + dy, nx = x + dx;
                    if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
                        sum += channel[ny * w + nx]; cnt++;
                    }
                }
            }
            out[y * w + x] = sum / cnt;
        }
    }
    return out;
}

function executeBgCleanup(
    imageData: Uint8ClampedArray, w: number, h: number
): { data: ArrayBuffer; width: number; height: number } {
    const pixelCount = w * h;

    // Luminance histogram
    const histogram = new Float32Array(256);
    for (let i = 0; i < pixelCount; i++) {
        const idx = i * 4;
        const lum = Math.round(0.299 * imageData[idx] + 0.587 * imageData[idx + 1] + 0.114 * imageData[idx + 2]);
        histogram[lum]++;
    }

    // Find background level (dominant peak in upper half)
    let maxCount = 0, bgLevel = 255;
    for (let i = 128; i < 256; i++) {
        if (histogram[i] > maxCount) { maxCount = histogram[i]; bgLevel = i; }
    }
    if (maxCount < pixelCount * 0.05) {
        maxCount = 0;
        for (let i = 0; i < 256; i++) {
            if (histogram[i] > maxCount) { maxCount = histogram[i]; bgLevel = i; }
        }
    }

    // Normalize background
    const scaleFactor = bgLevel > 10 ? 255 / bgLevel : 1;
    const rCh = new Float32Array(pixelCount);
    const gCh = new Float32Array(pixelCount);
    const bCh = new Float32Array(pixelCount);

    for (let i = 0; i < pixelCount; i++) {
        const idx = i * 4;
        rCh[i] = Math.min(255, imageData[idx] * scaleFactor);
        gCh[i] = Math.min(255, imageData[idx + 1] * scaleFactor);
        bCh[i] = Math.min(255, imageData[idx + 2] * scaleFactor);
    }

    // Adaptive threshold — push near-white toward white
    for (let i = 0; i < pixelCount; i++) {
        const lum = 0.299 * rCh[i] + 0.587 * gCh[i] + 0.114 * bCh[i];
        if (lum > 220) {
            const blend = ((lum - 220) / 35);
            const s = blend * blend;
            rCh[i] += (255 - rCh[i]) * s;
            gCh[i] += (255 - gCh[i]) * s;
            bCh[i] += (255 - bCh[i]) * s;
        }
    }

    // Noise reduction on light areas
    const rB = boxBlur3x3(rCh, w, h);
    const gB = boxBlur3x3(gCh, w, h);
    const bB = boxBlur3x3(bCh, w, h);
    for (let i = 0; i < pixelCount; i++) {
        const lum = 0.299 * rCh[i] + 0.587 * gCh[i] + 0.114 * bCh[i];
        if (lum > 180) {
            const t = Math.min(1, (lum - 180) / 75);
            rCh[i] = rCh[i] * (1 - t) + rB[i] * t;
            gCh[i] = gCh[i] * (1 - t) + gB[i] * t;
            bCh[i] = bCh[i] * (1 - t) + bB[i] * t;
        }
    }

    // Edge restoration
    const rB2 = boxBlur3x3(rCh, w, h);
    const gB2 = boxBlur3x3(gCh, w, h);
    const bB2 = boxBlur3x3(bCh, w, h);
    for (let i = 0; i < pixelCount; i++) {
        const lum = 0.299 * rCh[i] + 0.587 * gCh[i] + 0.114 * bCh[i];
        if (lum < 180) {
            rCh[i] = Math.min(255, Math.max(0, rCh[i] + (rCh[i] - rB2[i]) * 0.3));
            gCh[i] = Math.min(255, Math.max(0, gCh[i] + (gCh[i] - gB2[i]) * 0.3));
            bCh[i] = Math.min(255, Math.max(0, bCh[i] + (bCh[i] - bB2[i]) * 0.3));
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

// ─── Color Enhancement logic ──────────────────────────────────

function executeColorEnhance(
    imageData: Uint8ClampedArray, w: number, h: number
): { data: ArrayBuffer; width: number; height: number } {
    const pixelCount = w * h;

    // Luminance histogram
    const histogram = new Float32Array(256);
    for (let i = 0; i < pixelCount; i++) {
        const idx = i * 4;
        const lum = Math.round(0.299 * imageData[idx] + 0.587 * imageData[idx + 1] + 0.114 * imageData[idx + 2]);
        histogram[lum]++;
    }

    // Percentiles for contrast stretch
    let cumulative = 0;
    let lowClip = 0, highClip = 255;
    const lowTarget = pixelCount * 0.01, highTarget = pixelCount * 0.99;
    for (let i = 0; i < 256; i++) {
        cumulative += histogram[i];
        if (cumulative >= lowTarget && lowClip === 0) lowClip = i;
        if (cumulative >= highTarget && highClip === 255) highClip = i;
    }

    // Mean luminance for gamma
    let lumSum = 0;
    for (let i = 0; i < 256; i++) lumSum += i * histogram[i];
    const meanLum = lumSum / pixelCount;

    const range = highClip - lowClip;
    const stretchFactor = range > 10 ? 255 / range : 1;

    // Gamma LUT
    const gamma = meanLum > 5 ? Math.log(128 / 255) / Math.log(meanLum / 255) : 1;
    const clampedGamma = Math.max(0.5, Math.min(2.0, gamma));
    const gammaLUT = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
        gammaLUT[i] = Math.round(255 * Math.pow(i / 255, 1 / clampedGamma));
    }

    // S-curve LUT
    const sCurveLUT = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
        const x = i / 255;
        const c = x - 0.5;
        const s = c >= 0 ? 1 : -1;
        const curved = 0.5 + s * 0.5 * Math.pow(Math.abs(c * 2), 0.85);
        sCurveLUT[i] = Math.round(Math.min(255, Math.max(0, curved * 255)));
    }

    const rCh = new Float32Array(pixelCount);
    const gCh = new Float32Array(pixelCount);
    const bCh = new Float32Array(pixelCount);

    // Contrast stretch + gamma + S-curve
    for (let i = 0; i < pixelCount; i++) {
        const idx = i * 4;
        let r = Math.min(255, Math.max(0, (imageData[idx] - lowClip) * stretchFactor));
        let g = Math.min(255, Math.max(0, (imageData[idx + 1] - lowClip) * stretchFactor));
        let b = Math.min(255, Math.max(0, (imageData[idx + 2] - lowClip) * stretchFactor));
        r = gammaLUT[Math.round(r)];
        g = gammaLUT[Math.round(g)];
        b = gammaLUT[Math.round(b)];
        rCh[i] = sCurveLUT[r];
        gCh[i] = sCurveLUT[g];
        bCh[i] = sCurveLUT[b];
    }

    // Subtle sharpen
    const rB = boxBlur3x3(rCh, w, h);
    const gB = boxBlur3x3(gCh, w, h);
    const bB = boxBlur3x3(bCh, w, h);
    for (let i = 0; i < pixelCount; i++) {
        rCh[i] = Math.min(255, Math.max(0, rCh[i] + (rCh[i] - rB[i]) * 0.25));
        gCh[i] = Math.min(255, Math.max(0, gCh[i] + (gCh[i] - gB[i]) * 0.25));
        bCh[i] = Math.min(255, Math.max(0, bCh[i] + (bCh[i] - bB[i]) * 0.25));
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
            case 'smart-crop': {
                postMessage({ type: 'progress', stage: 'Analyzing image...', percent: 20 });
                const pixels = new Uint8ClampedArray(imageData);
                const crop = analyzeSmartCrop(pixels, width, height);

                if (!crop) {
                    // No crop needed — send back original
                    postMessage({ type: 'result', action: 'smart-crop', imageData: null, width, height });
                    return;
                }

                postMessage({ type: 'progress', stage: 'Cropping...', percent: 60 });
                const result = executeSmartCrop(pixels, width, height, crop);
                postMessage({ type: 'progress', stage: 'Complete', percent: 100 });
                postMessage(
                    { type: 'result', action: 'smart-crop', imageData: result.data, width: result.width, height: result.height },
                    { transfer: [result.data] }
                );
                break;
            }

            case 'deskew': {
                postMessage({ type: 'progress', stage: 'Detecting edges...', percent: 20 });
                const pixels = new Uint8ClampedArray(imageData);
                const skewAngle = analyzeDeskew(pixels, width, height);

                if (Math.abs(skewAngle) < 0.3) {
                    // No correction needed
                    postMessage({ type: 'result', action: 'deskew', imageData: null, width, height });
                    return;
                }

                postMessage({ type: 'progress', stage: `Correcting ${skewAngle.toFixed(1)}°...`, percent: 60 });
                const result = executeDeskew(pixels, width, height, skewAngle);
                postMessage({ type: 'progress', stage: 'Complete', percent: 100 });
                postMessage(
                    { type: 'result', action: 'deskew', imageData: result.data, width: result.width, height: result.height },
                    { transfer: [result.data] }
                );
                break;
            }

            case 'bg-cleanup': {
                postMessage({ type: 'progress', stage: 'Analyzing scan...', percent: 20 });
                const pixels = new Uint8ClampedArray(imageData);
                postMessage({ type: 'progress', stage: 'Cleaning background...', percent: 50 });
                const result = executeBgCleanup(pixels, width, height);
                postMessage({ type: 'progress', stage: 'Complete', percent: 100 });
                postMessage(
                    { type: 'result', action: 'bg-cleanup', imageData: result.data, width: result.width, height: result.height },
                    { transfer: [result.data] }
                );
                break;
            }

            case 'color-enhance': {
                postMessage({ type: 'progress', stage: 'Analyzing colors...', percent: 20 });
                const pixels = new Uint8ClampedArray(imageData);
                postMessage({ type: 'progress', stage: 'Enhancing...', percent: 50 });
                const result = executeColorEnhance(pixels, width, height);
                postMessage({ type: 'progress', stage: 'Complete', percent: 100 });
                postMessage(
                    { type: 'result', action: 'color-enhance', imageData: result.data, width: result.width, height: result.height },
                    { transfer: [result.data] }
                );
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
