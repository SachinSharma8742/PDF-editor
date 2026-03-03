import type { ImageOperations } from "../components/features/editor/ImageStudio/useImageStudioStore";

export async function applyAdjust(
    input: ImageBitmap,
    ops: ImageOperations['adjust']
): Promise<ImageBitmap> {
    const { brightness, contrast, saturation } = ops;

    // Optimization: If no adjustments, return original
    if (brightness === 0 && contrast === 0 && saturation === 0) {
        return input;
    }

    const canvas = new OffscreenCanvas(input.width, input.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Failed to get context");

    // Mapping params (-1 to 1) to CSS filters (percentages/multipliers)
    // 0 -> 1 (100%)
    // -1 -> 0 (0%)
    // 1 -> 2 (200%)
    const b = Math.max(0, 1 + brightness);
    const c = Math.max(0, 1 + contrast);
    const s = Math.max(0, 1 + saturation);

    ctx.filter = `brightness(${b}) contrast(${c}) saturate(${s})`;
    ctx.drawImage(input, 0, 0);

    return createImageBitmap(canvas);
}
