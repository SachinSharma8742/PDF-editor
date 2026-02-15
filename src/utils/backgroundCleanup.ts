/**
 * Smart Background Cleanup Utility
 * 
 * Removes scan artifacts: gray paper tone, shadow gradients, background noise.
 * Returns a new data URL — never mutates the original image.
 */

const ANALYSIS_MAX_SIZE = 512;

/**
 * Load an image source into an HTMLImageElement.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image for background cleanup'));
        img.src = src;
    });
}

/**
 * Build a luminance histogram from RGBA pixel data.
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
 * Find the background luminance level.
 * For scanned documents, the background is typically the highest peak above midtones.
 */
function findBackgroundLevel(histogram: Float32Array, pixelCount: number): number {
    // Look for the dominant peak in the upper half (typical paper/background)
    let maxCount = 0;
    let bgLevel = 255;

    for (let i = 128; i < 256; i++) {
        if (histogram[i] > maxCount) {
            maxCount = histogram[i];
            bgLevel = i;
        }
    }

    // If top-half peak is not significant (< 5% of pixels), fall back to overall peak
    if (maxCount < pixelCount * 0.05) {
        maxCount = 0;
        for (let i = 0; i < 256; i++) {
            if (histogram[i] > maxCount) {
                maxCount = histogram[i];
                bgLevel = i;
            }
        }
    }

    return bgLevel;
}

/**
 * Apply a fast box blur (3x3) to a single-channel array.
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
 * Smart Background Cleanup: normalize background, reduce noise, restore edges.
 *
 * @param imageSrc - The source image (data URL or URL)
 * @returns A new data URL of the cleaned image
 */
export async function backgroundCleanup(imageSrc: string): Promise<string> {
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

    // --- Step 2: Analyze luminance histogram ---
    const histogram = buildLuminanceHistogram(data, pixelCount);
    const bgLevel = findBackgroundLevel(histogram, pixelCount);

    // --- Step 3: Normalize background levels ---
    // Map background level → 255 (white), scaling everything proportionally
    const targetBg = 255;
    const scaleFactor = bgLevel > 10 ? targetBg / bgLevel : 1;

    // Extract channels as floats for processing
    const rCh = new Float32Array(pixelCount);
    const gCh = new Float32Array(pixelCount);
    const bCh = new Float32Array(pixelCount);

    for (let i = 0; i < pixelCount; i++) {
        const idx = i * 4;
        // Apply normalization with soft clipping
        rCh[i] = Math.min(255, data[idx] * scaleFactor);
        gCh[i] = Math.min(255, data[idx + 1] * scaleFactor);
        bCh[i] = Math.min(255, data[idx + 2] * scaleFactor);
    }

    // --- Step 4: Adaptive threshold smoothing ---
    // For near-white pixels, push them toward pure white
    // For dark pixels (content), preserve them
    const whiteThreshold = 220;
    for (let i = 0; i < pixelCount; i++) {
        const lum = 0.299 * rCh[i] + 0.587 * gCh[i] + 0.114 * bCh[i];

        if (lum > whiteThreshold) {
            // Blend toward white — the closer to white, the more we push
            const blend = (lum - whiteThreshold) / (255 - whiteThreshold);
            const smoothBlend = blend * blend; // Quadratic for smoother transition
            rCh[i] = rCh[i] + (255 - rCh[i]) * smoothBlend;
            gCh[i] = gCh[i] + (255 - gCh[i]) * smoothBlend;
            bCh[i] = bCh[i] + (255 - bCh[i]) * smoothBlend;
        }
    }

    // --- Step 5: Noise reduction via box blur on light areas ---
    const rBlurred = boxBlur3x3(rCh, origW, origH);
    const gBlurred = boxBlur3x3(gCh, origW, origH);
    const bBlurred = boxBlur3x3(bCh, origW, origH);

    // Blend: use blurred version for light areas (noise), original for dark (content)
    for (let i = 0; i < pixelCount; i++) {
        const lum = 0.299 * rCh[i] + 0.587 * gCh[i] + 0.114 * bCh[i];

        if (lum > 180) {
            // Background region — use blurred (noise-reduced)
            const t = Math.min(1, (lum - 180) / 75); // Smooth transition
            rCh[i] = rCh[i] * (1 - t) + rBlurred[i] * t;
            gCh[i] = gCh[i] * (1 - t) + gBlurred[i] * t;
            bCh[i] = bCh[i] * (1 - t) + bBlurred[i] * t;
        }
    }

    // --- Step 6: Edge restoration (subtle unsharp mask on dark content) ---
    // Re-blur for unsharp mask
    const rBlurred2 = boxBlur3x3(rCh, origW, origH);
    const gBlurred2 = boxBlur3x3(gCh, origW, origH);
    const bBlurred2 = boxBlur3x3(bCh, origW, origH);

    const sharpenAmount = 0.3;
    for (let i = 0; i < pixelCount; i++) {
        const lum = 0.299 * rCh[i] + 0.587 * gCh[i] + 0.114 * bCh[i];

        if (lum < 180) {
            // Content region — apply subtle sharpening
            rCh[i] = Math.min(255, Math.max(0, rCh[i] + (rCh[i] - rBlurred2[i]) * sharpenAmount));
            gCh[i] = Math.min(255, Math.max(0, gCh[i] + (gCh[i] - gBlurred2[i]) * sharpenAmount));
            bCh[i] = Math.min(255, Math.max(0, bCh[i] + (bCh[i] - bBlurred2[i]) * sharpenAmount));
        }
    }

    // --- Step 7: Write back to image data ---
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
