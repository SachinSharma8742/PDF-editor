import type { ImageOperations } from "../components/features/editor/ImageStudio/useImageStudioStore";

export async function applyEffects(
    input: ImageBitmap,
    ops: ImageOperations['effects']
): Promise<ImageBitmap> {
    const { grayscale, sepia, invert, blur } = ops;

    // Optimization
    if (!grayscale && !sepia && !invert && !blur) {
        return input;
    }

    const canvas = new OffscreenCanvas(input.width, input.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Failed to get context");

    const filters: string[] = [];
    if (grayscale) filters.push('grayscale(1)');
    if (sepia) filters.push('sepia(1)');
    if (invert) filters.push('invert(1)');
    if (blur > 0) filters.push(`blur(${blur}px)`);

    ctx.filter = filters.join(' ');
    ctx.drawImage(input, 0, 0);

    // Note: Noise not strictly supported by CSS filters. 
    // If noise is needed, we need pixel manipulation (slow) or WebGL.
    // Skipping noise for Phase 2 pipeline.

    return createImageBitmap(canvas);
}
