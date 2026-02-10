/**
 * Unified Adjustment Pipeline
 * 
 * All effects are parameter sets of a single shared pipeline:
 * 1. Luminance Extraction (for control math)
 * 2. Levels (Black Point / White Point)
 * 3. Gamma (Midtone control)
 * 4. Contrast (Global separation)
 * 5. Optional Threshold (Binary mode)
 * 6. Optional Invert
 */

export interface AdjustmentParams {
    blackPoint: number;   // 0–255, default 0
    whitePoint: number;   // 0–255, default 255
    gamma: number;        // 0.1–3.0, default 1.0
    contrast: number;     // 0.5–3.0, default 1.0
    thresholdEnabled: boolean;
    threshold: number;    // 0–255, default 128
    invertEnabled: boolean;
    grayscale: boolean;
}

export const DEFAULT_ADJUSTMENT_PARAMS: AdjustmentParams = {
    blackPoint: 0,
    whitePoint: 255,
    gamma: 1.0,
    contrast: 1.0,
    thresholdEnabled: false,
    threshold: 128,
    invertEnabled: false,
    grayscale: false,
};

/**
 * Build a lookup table (LUT) for the adjustment pipeline.
 * This avoids per-pixel pow() calls by precomputing the curve for all 256 input values.
 */
const buildLUT = (params: AdjustmentParams): Uint8Array => {
    const lut = new Uint8Array(256);
    const { blackPoint, whitePoint, gamma, contrast, thresholdEnabled, threshold, invertEnabled } = params;

    const range = Math.max(whitePoint - blackPoint, 1); // avoid division by zero

    for (let i = 0; i < 256; i++) {
        // 1. Levels: map input to 0–1 range based on black/white points
        let level = (i - blackPoint) / range;
        level = Math.max(0, Math.min(1, level));

        // 2. Gamma: midtone adjustment (use 1/gamma for perceptual correctness)
        // detailed validation to avoid Infinity
        const safeGamma = Math.max(gamma, 0.01);
        let value = Math.pow(level, 1.0 / safeGamma);

        // 3. Contrast: expand/compress around midpoint
        value = (value - 0.5) * contrast + 0.5;
        value = Math.max(0, Math.min(1, value));

        // 4. Threshold: binary mode
        if (thresholdEnabled) {
            value = value > (threshold / 255) ? 1 : 0;
        }

        // 5. Invert
        if (invertEnabled) {
            value = 1 - value;
        }

        lut[i] = Math.round(value * 255);
    }

    return lut;
};

/**
 * Apply the adjustment pipeline to a canvas context using pixel manipulation.
 * This is the core engine used by both live preview (via Konva custom filter) and export.
 */
export const applyAdjustmentPipeline = (ctx: CanvasRenderingContext2D, rawParams: Record<string, any>) => {
    const params = resolveParams(rawParams);

    // Skip if all params are at defaults (no-op)
    if (isNoop(params)) return;

    const { width, height } = ctx.canvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    processImageData(imageData, params);
    ctx.putImageData(imageData, 0, 0);
};

/**
 * Process ImageData in-place with the adjustment pipeline.
 * Used by both canvas export and Konva custom filter.
 */
export const processImageData = (imageData: ImageData, params: AdjustmentParams) => {
    const data = imageData.data;
    const lut = buildLUT(params);
    const isGrayscale = params.grayscale;

    for (let i = 0; i < data.length; i += 4) {
        if (isGrayscale) {
            // Convert to luminance first, then apply LUT
            const L = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            const val = lut[L];
            data[i] = data[i + 1] = data[i + 2] = val;
        } else {
            // Apply LUT to each channel independently (preserves color)
            data[i] = lut[data[i]];         // R
            data[i + 1] = lut[data[i + 1]]; // G
            data[i + 2] = lut[data[i + 2]]; // B
        }
        // Alpha channel (data[i+3]) is untouched
    }
};

/**
 * Resolve raw params object into typed AdjustmentParams with defaults.
 */
export const resolveParams = (raw: Record<string, any>): AdjustmentParams => ({
    blackPoint: raw.blackPoint ?? DEFAULT_ADJUSTMENT_PARAMS.blackPoint,
    whitePoint: raw.whitePoint ?? DEFAULT_ADJUSTMENT_PARAMS.whitePoint,
    gamma: raw.gamma ?? DEFAULT_ADJUSTMENT_PARAMS.gamma,
    contrast: raw.contrast ?? DEFAULT_ADJUSTMENT_PARAMS.contrast,
    thresholdEnabled: raw.thresholdEnabled ?? DEFAULT_ADJUSTMENT_PARAMS.thresholdEnabled,
    threshold: raw.threshold ?? DEFAULT_ADJUSTMENT_PARAMS.threshold,
    invertEnabled: raw.invertEnabled ?? DEFAULT_ADJUSTMENT_PARAMS.invertEnabled,
    grayscale: raw.grayscale ?? DEFAULT_ADJUSTMENT_PARAMS.grayscale,
});

/**
 * Check if params represent a no-op (all defaults).
 */
const isNoop = (params: AdjustmentParams): boolean => (
    params.blackPoint === 0 &&
    params.whitePoint === 255 &&
    params.gamma === 1.0 &&
    params.contrast === 1.0 &&
    !params.thresholdEnabled &&
    !params.invertEnabled &&
    !params.grayscale
);
