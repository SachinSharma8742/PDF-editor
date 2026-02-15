/**
 * Smart Color Enhancement Utility
 * 
 * Auto-enhances image clarity and readability via adaptive contrast,
 * gamma correction, midtone boost, and subtle sharpening.
 * Returns a new data URL — never mutates the original image.
 */

/**
 * Load an image source into an HTMLImageElement.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image for color enhancement'));
        img.src = src;
    });
}

/**
 * Build a luminance histogram.
 */
function buildLuminanceHistogram(data: Uint8ClampedArray, pixelCount: number): Float32Array {
    const histogram = new Float32Array(256);
    for (let i = 0; i < pixelCount; i++) {
        const idx = i * 4;
        const lum = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
        histogram[lum]++;
    }
    return histogram;
}

/**
 * Find percentile value from histogram.
 */
function histogramPercentile(histogram: Float32Array, pixelCount: number, percentile: number): number {
    const target = pixelCount * percentile;
    let cumulative = 0;

    for (let i = 0; i < 256; i++) {
        cumulative += histogram[i];
        if (cumulative >= target) return i;
    }
    return 255;
}

/**
 * Apply a fast 3x3 box blur to a channel.
 */
function boxBlur3x3(
    channel: Float32Array,
    width: number,
    height: number
): Float32Array {
    const out = new Float32Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0;
            let count = 0;

            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const ny = y + dy;
                    const nx = x + dx;
                    if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                        sum += channel[ny * width + nx];
                        count++;
                    }
                }
            }

            out[y * width + x] = sum / count;
        }
    }

    return out;
}

/**
 * Smart Color Enhancement: adaptive contrast, gamma, midtone boost, sharpening.
 *
 * @param imageSrc - The source image (data URL or URL)
 * @returns A new data URL of the enhanced image
 */
export async function colorEnhance(imageSrc: string): Promise<string> {
    const img = await loadImage(imageSrc);
    const origW = img.naturalWidth;
    const origH = img.naturalHeight;

    if (origW === 0 || origH === 0) {
        throw new Error('Image has zero dimensions');
    }

    // --- Step 1: Draw to canvas ---
    const canvas = document.createElement('canvas');
    canvas.width = origW;
    canvas.height = origH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, origW, origH);
    const data = imageData.data;
    const pixelCount = origW * origH;

    // --- Step 2: Analyze luminance distribution ---
    const histogram = buildLuminanceHistogram(data, pixelCount);

    // Find 1st and 99th percentile for contrast stretch (avoids clipping outliers)
    const lowClip = histogramPercentile(histogram, pixelCount, 0.01);
    const highClip = histogramPercentile(histogram, pixelCount, 0.99);

    // Calculate mean luminance for gamma estimation
    let lumSum = 0;
    for (let i = 0; i < 256; i++) {
        lumSum += i * histogram[i];
    }
    const meanLum = lumSum / pixelCount;

    // --- Step 3: Adaptive contrast stretch ---
    // Map [lowClip, highClip] → [0, 255] preserving ratios per channel
    const range = highClip - lowClip;
    const stretchFactor = range > 10 ? 255 / range : 1;

    const rCh = new Float32Array(pixelCount);
    const gCh = new Float32Array(pixelCount);
    const bCh = new Float32Array(pixelCount);

    for (let i = 0; i < pixelCount; i++) {
        const idx = i * 4;
        rCh[i] = Math.min(255, Math.max(0, (data[idx] - lowClip) * stretchFactor));
        gCh[i] = Math.min(255, Math.max(0, (data[idx + 1] - lowClip) * stretchFactor));
        bCh[i] = Math.min(255, Math.max(0, (data[idx + 2] - lowClip) * stretchFactor));
    }

    // --- Step 4: Gamma correction ---
    // If mean is dark, brighten; if bright, darken slightly
    // Target midpoint around 128
    const targetMean = 128;
    // Guard against log(0) or log(1) -> divide by zero
    let gamma = 1.0;
    if (meanLum > 1 && Math.abs(meanLum - 255) > 1) {
        gamma = Math.log(targetMean / 255) / Math.log(meanLum / 255);
    }

    // Clamp gamma to reasonable range to avoid extreme corrections
    const clampedGamma = Math.max(0.5, Math.min(2.0, gamma));

    // Build gamma LUT for speed
    const gammaLUT = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
        gammaLUT[i] = Math.round(255 * Math.pow(i / 255, 1 / clampedGamma));
    }

    for (let i = 0; i < pixelCount; i++) {
        rCh[i] = gammaLUT[Math.round(rCh[i])];
        gCh[i] = gammaLUT[Math.round(gCh[i])];
        bCh[i] = gammaLUT[Math.round(bCh[i])];
    }

    // --- Step 5: Midtone enhancement ---
    // Boost contrast in the midtone range using an S-curve
    // S-curve: f(x) = 0.5 * (1 + sign(x - 0.5) * |2(x - 0.5)|^p) where p < 1 for subtle
    const sCurveLUT = new Uint8Array(256);
    const curvePower = 0.85; // Subtle S-curve (< 1 = mild enhancement)

    for (let i = 0; i < 256; i++) {
        const x = i / 255;
        const centered = x - 0.5;
        const sign = centered >= 0 ? 1 : -1;
        const curved = 0.5 + sign * 0.5 * Math.pow(Math.abs(centered * 2), curvePower);
        sCurveLUT[i] = Math.round(Math.min(255, Math.max(0, curved * 255)));
    }

    for (let i = 0; i < pixelCount; i++) {
        rCh[i] = sCurveLUT[Math.round(rCh[i])];
        gCh[i] = sCurveLUT[Math.round(gCh[i])];
        bCh[i] = sCurveLUT[Math.round(bCh[i])];
    }

    // --- Step 6: Subtle sharpening (unsharp mask) ---
    const rBlurred = boxBlur3x3(rCh, origW, origH);
    const gBlurred = boxBlur3x3(gCh, origW, origH);
    const bBlurred = boxBlur3x3(bCh, origW, origH);

    const sharpenAmount = 0.25; // Subtle
    for (let i = 0; i < pixelCount; i++) {
        rCh[i] = Math.min(255, Math.max(0, rCh[i] + (rCh[i] - rBlurred[i]) * sharpenAmount));
        gCh[i] = Math.min(255, Math.max(0, gCh[i] + (gCh[i] - gBlurred[i]) * sharpenAmount));
        bCh[i] = Math.min(255, Math.max(0, bCh[i] + (bCh[i] - bBlurred[i]) * sharpenAmount));
    }

    // --- Step 7: Write back ---
    for (let i = 0; i < pixelCount; i++) {
        const idx = i * 4;
        data[idx] = Math.round(rCh[i]);
        data[idx + 1] = Math.round(gCh[i]);
        data[idx + 2] = Math.round(bCh[i]);
        // Alpha unchanged
    }

    ctx.putImageData(imageData, 0, 0);
    const result = canvas.toDataURL('image/png');

    // Cleanup
    canvas.width = 0;
    canvas.height = 0;

    return result;
}
