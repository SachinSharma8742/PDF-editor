import type { ImageOperations } from "../components/features/editor/ImageStudio/useImageStudioStore";

/**
 * Applies geometric transformations: Rotate -> Flip -> Crop
 * Uses OffscreenCanvas where available for performance, falls back to DOM Canvas.
 */
export async function applyTransform(
    input: ImageBitmap,
    ops: ImageOperations['transform']
): Promise<ImageBitmap> {
    const { rotate, flipX, flipY, crop } = ops;

    // optimization: if no transforms, return original
    if (rotate === 0 && !flipX && !flipY && !crop) {
        return input;
    }

    // 1. Calculate intermediate dimensions after Rotation
    // Swap width/height if rotated 90 or 270
    const isRotated90or270 = Math.abs(rotate) % 180 === 90;
    const rotatedWidth = isRotated90or270 ? input.height : input.width;
    const rotatedHeight = isRotated90or270 ? input.width : input.height;

    // 2. Setup Canvas (Rotate + Flip stage)
    // If we have a crop, we might be able to optimize, but typically
    // we transform first, then crop the result.
    // However, cropping is the final step in the pipeline specific to "Transform" stage.
    // Let's do Rotate+Flip first, then Crop.

    // helper to create canvas
    const createCanvas = (w: number, h: number) => {
        if (typeof OffscreenCanvas !== 'undefined') {
            return new OffscreenCanvas(w, h);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        return canvas;
    };

    const canvas = createCanvas(rotatedWidth, rotatedHeight);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D; // TS hack for mixed context types

    if (!ctx) {
        throw new Error("Could not get canvas context for transform");
    }

    // smooth quality not strictly needed for pixel-perfect integer rotate/flip,
    // but good practice.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 3. Apply Transformations to Context
    // Move to center to rotate/flip around center
    ctx.translate(rotatedWidth / 2, rotatedHeight / 2);

    // Rotate
    ctx.rotate((rotate * Math.PI) / 180);

    // Flip
    // Note: If we flip *after* rotation in screen space, it's different than flipping *before*.
    // Requirement: Rotate -> Flip -> Crop.
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);

    // Draw Image centered
    // We draw the *original* image. The context is transformed to map the original onto the new bounds.
    ctx.drawImage(
        input,
        -input.width / 2,
        -input.height / 2
    );

    // 4. Create Intermediate Bitmap (Output of Rotate+Flip)
    // We need this to apply Crop, or we can just return this if no crop.
    const outputBitmap = await createImageBitmap(canvas);

    // 5. Apply Crop if exists
    if (crop) {
        // Validation: Ensure crop is within bounds
        const safeX = Math.max(0, crop.x);
        const safeY = Math.max(0, crop.y);
        const safeW = Math.min(crop.width, outputBitmap.width - safeX);
        const safeH = Math.min(crop.height, outputBitmap.height - safeY);

        if (safeW > 0 && safeH > 0) {
            // Check for Shape Mask
            if (ops.cropShape && ops.cropShape !== 'rect') {
                // Shape Masking Logic
                const cropCanvas = createCanvas(safeW, safeH);
                const cropCtx = cropCanvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

                if (!cropCtx) throw new Error("Could not get crop context");

                cropCtx.imageSmoothingEnabled = true;
                cropCtx.imageSmoothingQuality = 'high';

                // 1. Draw the cropped image content
                cropCtx.drawImage(
                    outputBitmap,
                    safeX, safeY, safeW, safeH, // Source
                    0, 0, safeW, safeH          // Dest
                );

                // 2. Apply Shape Mask
                cropCtx.globalCompositeOperation = 'destination-in';
                cropCtx.beginPath();

                if (ops.cropShape === 'circle') {
                    // Ellipse to support non-square aspect ratios
                    const centerX = safeW / 2;
                    const centerY = safeH / 2;
                    const radiusX = safeW / 2;
                    const radiusY = safeH / 2;
                    cropCtx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
                } else if (ops.cropShape === 'heart') {
                    // Heart Shape Path
                    const w = safeW;
                    const h = safeH;
                    const x = 0;
                    const y = 0;
                    // Standard SVG heart path scaled to bounds
                    // Heart usually fits in square, but we stretch to bounds
                    cropCtx.moveTo(x + w / 2, y + h);
                    cropCtx.bezierCurveTo(x, y + h * 0.6, x, y, x + w / 2, y + h * 0.3);
                    cropCtx.bezierCurveTo(x + w, y, x + w, y + h * 0.6, x + w / 2, y + h);
                }

                cropCtx.fill();

                // 3. Create Bitmap from Masked Canvas
                const maskedBitmap = await createImageBitmap(cropCanvas);
                outputBitmap.close();
                return maskedBitmap;

            } else {
                // Standard Rectangular Crop (Fast Path)
                // Create a new bitmap from the cropped region
                // createImageBitmap has (image, x, y, w, h) signature
                const croppedBitmap = await createImageBitmap(outputBitmap, safeX, safeY, safeW, safeH);

                // cleanup intermediate
                outputBitmap.close();
                return croppedBitmap;
            }
        }
    }

    return outputBitmap;
}
