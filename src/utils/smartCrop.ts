/**
 * Smart Auto-Crop Utility
 * 
 * Detects subject bounds and removes empty margins automatically.
 * Returns a new data URL — never mutates the original image.
 */

const ANALYSIS_MAX_SIZE = 512;
const DEFAULT_PADDING = 8; // px padding on each side after crop
const LUMINANCE_THRESHOLD = 30; // delta from background luminance to detect content

/**
 * Sample corner pixels to estimate the background color.
 */
function detectBackgroundColor(
    data: Uint8ClampedArray,
    width: number,
    height: number
): { r: number; g: number; b: number } {
    const corners = [
        [0, 0],
        [width - 1, 0],
        [0, height - 1],
        [width - 1, height - 1],
        [Math.floor(width / 2), 0],
        [Math.floor(width / 2), height - 1],
        [0, Math.floor(height / 2)],
        [width - 1, Math.floor(height / 2)],
    ];

    let rSum = 0, gSum = 0, bSum = 0, count = 0;

    for (const [cx, cy] of corners) {
        const idx = (cy * width + cx) * 4;
        rSum += data[idx];
        gSum += data[idx + 1];
        bSum += data[idx + 2];
        count++;
    }

    return {
        r: Math.round(rSum / count),
        g: Math.round(gSum / count),
        b: Math.round(bSum / count),
    };
}

/**
 * Calculate luminance for a single pixel.
 */
function pixelLuminance(r: number, g: number, b: number): number {
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Find the content bounding box by scanning for pixels that differ
 * from the background beyond the luminance threshold.
 */
function findContentBounds(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    bgColor: { r: number; g: number; b: number }
): { top: number; left: number; bottom: number; right: number } | null {
    const bgLum = pixelLuminance(bgColor.r, bgColor.g, bgColor.b);

    let top = height, left = width, bottom = 0, right = 0;
    let found = false;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];

            // Skip fully transparent pixels
            if (a < 10) continue;

            const lum = pixelLuminance(r, g, b);
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
    return { top, left, bottom, right };
}

/**
 * Load an image source (data URL or URL) into an HTMLImageElement.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image for smart crop'));
        img.src = src;
    });
}

/**
 * Smart Auto-Crop: detects subject bounds and removes empty margins.
 * 
 * @param imageSrc - The source image (data URL or URL)
 * @param padding  - Padding in original-resolution pixels (default 8)
 * @returns A new data URL of the cropped image
 */
export async function smartCrop(
    imageSrc: string,
    padding: number = DEFAULT_PADDING
): Promise<string> {
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

    // --- Step 2: Detect background color ---
    const bgColor = detectBackgroundColor(analysisData.data, analysisW, analysisH);

    // --- Step 3: Find content bounds on analysis image ---
    const bounds = findContentBounds(analysisData.data, analysisW, analysisH, bgColor);

    if (!bounds) {
        // No content detected — return original unchanged
        return imageSrc;
    }

    // --- Step 4: Map bounds back to original resolution ---
    const invScale = 1 / scale;
    let cropX = Math.floor(bounds.left * invScale) - padding;
    let cropY = Math.floor(bounds.top * invScale) - padding;
    let cropR = Math.ceil(bounds.right * invScale) + padding;
    let cropB = Math.ceil(bounds.bottom * invScale) + padding;

    // Clamp to image bounds
    cropX = Math.max(0, cropX);
    cropY = Math.max(0, cropY);
    cropR = Math.min(origW, cropR);
    cropB = Math.min(origH, cropB);

    const cropW = cropR - cropX;
    const cropH = cropB - cropY;

    // If crop would be essentially the full image (within padding), skip
    if (cropW >= origW - padding * 2 && cropH >= origH - padding * 2) {
        return imageSrc;
    }

    // --- Step 5: Crop original-resolution image ---
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = cropW;
    outputCanvas.height = cropH;
    const outputCtx = outputCanvas.getContext('2d');
    if (!outputCtx) throw new Error('Failed to get output context');
    outputCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    // --- Step 6: Return new bitmap as data URL ---
    const result = outputCanvas.toDataURL('image/png');

    // Cleanup
    analysisCanvas.width = 0;
    analysisCanvas.height = 0;
    outputCanvas.width = 0;
    outputCanvas.height = 0;

    return result;
}
