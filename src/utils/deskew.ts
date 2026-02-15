/**
 * Deskew + Perspective Correction Utility
 * 
 * Auto-straightens rotated/skewed images using Sobel edge detection
 * and angle histogram voting. Returns a new data URL — never mutates
 * the original image.
 */

const ANALYSIS_MAX_SIZE = 512;
const MAX_ROTATION_DEGREES = 15; // Clamp extreme rotation

/**
 * Load an image source into an HTMLImageElement.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image for deskew'));
        img.src = src;
    });
}

/**
 * Convert RGBA image data to grayscale (single-channel Float32Array).
 */
function toGrayscale(data: Uint8ClampedArray, width: number, height: number): Float32Array {
    const gray = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
        const idx = i * 4;
        gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }
    return gray;
}

/**
 * Apply Sobel edge detection. Returns gradient magnitude and angle arrays.
 */
function sobelEdgeDetection(
    gray: Float32Array,
    width: number,
    height: number
): { magnitude: Float32Array; angle: Float32Array } {
    const magnitude = new Float32Array(width * height);
    const angle = new Float32Array(width * height);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            // Sobel kernels
            const tl = gray[(y - 1) * width + (x - 1)];
            const tc = gray[(y - 1) * width + x];
            const tr = gray[(y - 1) * width + (x + 1)];
            const ml = gray[y * width + (x - 1)];
            const mr = gray[y * width + (x + 1)];
            const bl = gray[(y + 1) * width + (x - 1)];
            const bc = gray[(y + 1) * width + x];
            const br = gray[(y + 1) * width + (x + 1)];

            const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
            const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;

            const idx = y * width + x;
            magnitude[idx] = Math.sqrt(gx * gx + gy * gy);
            angle[idx] = Math.atan2(gy, gx); // radians, range [-π, π]
        }
    }

    return { magnitude, angle };
}

/**
 * Estimate the dominant skew angle from edge data using angle histogram voting.
 * We look for deviations from 0° or 90° edges (typically dominant in documents/photos).
 */
function estimateSkewAngle(
    magnitude: Float32Array,
    angle: Float32Array,
    width: number,
    height: number
): number {
    // Calculate magnitude threshold (top 20% of edges)
    const sorted = Float32Array.from(magnitude).sort();
    const thresholdIdx = Math.floor(sorted.length * 0.8);
    const threshold = sorted[thresholdIdx] || 1;

    // Build histogram of angles near horizontal (±45°)
    // We bin into 0.5° increments over range [-45°, 45°]
    const binCount = 180;
    const binSize = 0.5; // degrees per bin
    const histogram = new Float32Array(binCount);

    for (let i = 0; i < magnitude.length; i++) {
        if (magnitude[i] < threshold) continue;

        // The edge angle represents gradient direction. 
        // Line orientation is perpendicular to gradient.
        let lineAngle = angle[i] * (180 / Math.PI) + 90; // Convert to line orientation

        // Normalize to [-90, 90)
        while (lineAngle >= 90) lineAngle -= 180;
        while (lineAngle < -90) lineAngle += 180;

        // We're interested in near-horizontal lines: angles close to 0°
        if (Math.abs(lineAngle) <= 45) {
            const bin = Math.floor((lineAngle + 45) / binSize);
            if (bin >= 0 && bin < binCount) {
                histogram[bin] += magnitude[i]; // Weight by edge strength
            }
        }
    }

    // Find peak bin
    let maxVal = 0;
    let maxBin = binCount / 2; // default to 0°

    for (let i = 0; i < binCount; i++) {
        if (histogram[i] > maxVal) {
            maxVal = histogram[i];
            maxBin = i;
        }
    }

    // Convert peak bin back to angle
    const dominantAngle = (maxBin * binSize) - 45;

    // If the image has no significant edges, return 0
    if (maxVal === 0) return 0;

    return dominantAngle;
}

/**
 * Sample corner pixels to estimate the background color for fill.
 */
function detectBackgroundColor(
    data: Uint8ClampedArray,
    width: number,
    height: number
): string {
    const corners = [
        [0, 0],
        [width - 1, 0],
        [0, height - 1],
        [width - 1, height - 1],
    ];

    let rSum = 0, gSum = 0, bSum = 0;
    for (const [cx, cy] of corners) {
        const idx = (cy * width + cx) * 4;
        rSum += data[idx];
        gSum += data[idx + 1];
        bSum += data[idx + 2];
    }

    const r = Math.round(rSum / 4);
    const g = Math.round(gSum / 4);
    const b = Math.round(bSum / 4);
    return `rgb(${r},${g},${b})`;
}

/**
 * Deskew: auto-straighten a rotated/skewed image.
 * 
 * @param imageSrc - The source image (data URL or URL)
 * @returns A new data URL of the corrected image
 */
export async function deskew(imageSrc: string): Promise<string> {
    const img = await loadImage(imageSrc);
    const origW = img.naturalWidth;
    const origH = img.naturalHeight;

    if (origW === 0 || origH === 0) {
        throw new Error('Image has zero dimensions');
    }

    // --- Step 1: Downscale for fast analysis ---
    const scale = Math.min(1, ANALYSIS_MAX_SIZE / Math.max(origW, origH));
    const analysisW = Math.round(origW * scale);
    const analysisH = Math.round(origH * scale);

    const analysisCanvas = document.createElement('canvas');
    analysisCanvas.width = analysisW;
    analysisCanvas.height = analysisH;
    const analysisCtx = analysisCanvas.getContext('2d');
    if (!analysisCtx) throw new Error('Failed to get analysis context');
    analysisCtx.drawImage(img, 0, 0, analysisW, analysisH);
    const analysisData = analysisCtx.getImageData(0, 0, analysisW, analysisH);

    // --- Step 2: Convert to grayscale ---
    const gray = toGrayscale(analysisData.data, analysisW, analysisH);

    // --- Step 3: Sobel edge detection ---
    const { magnitude, angle } = sobelEdgeDetection(gray, analysisW, analysisH);

    // --- Step 4: Estimate skew angle ---
    const skewAngle = estimateSkewAngle(magnitude, angle, analysisW, analysisH);

    // --- Step 5: Clamp rotation ---
    const clampedAngle = Math.max(-MAX_ROTATION_DEGREES, Math.min(MAX_ROTATION_DEGREES, skewAngle));

    // If angle is negligible, return original unchanged
    if (Math.abs(clampedAngle) < 0.3) {
        // Cleanup
        analysisCanvas.width = 0;
        analysisCanvas.height = 0;
        return imageSrc;
    }

    // --- Step 6: Rotate full-resolution image ---
    const radians = -clampedAngle * (Math.PI / 180); // Negate to correct the skew

    // Calculate output canvas size to fit rotated image
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    const newW = Math.ceil(origW * cos + origH * sin);
    const newH = Math.ceil(origH * cos + origW * sin);

    // Detect background color for fill
    const bgColor = detectBackgroundColor(analysisData.data, analysisW, analysisH);

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = newW;
    outputCanvas.height = newH;
    const outputCtx = outputCanvas.getContext('2d');
    if (!outputCtx) throw new Error('Failed to get output context');

    // Fill with background color
    outputCtx.fillStyle = bgColor;
    outputCtx.fillRect(0, 0, newW, newH);

    // Translate to center, rotate, draw
    outputCtx.translate(newW / 2, newH / 2);
    outputCtx.rotate(radians);
    outputCtx.drawImage(img, -origW / 2, -origH / 2);

    // --- Step 7: Return corrected bitmap ---
    const result = outputCanvas.toDataURL('image/png');

    // Cleanup
    analysisCanvas.width = 0;
    analysisCanvas.height = 0;
    outputCanvas.width = 0;
    outputCanvas.height = 0;

    return result;
}
