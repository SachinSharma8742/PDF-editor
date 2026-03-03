import type { ImageOperations } from "../components/features/editor/ImageStudio/useImageStudioStore";
import { deskew } from "../utils/deskew";
import { backgroundCleanup } from "../utils/backgroundCleanup";
import { removeBackground } from "../utils/backgroundRemoval";

async function bitmapToDataURL(bitmap: ImageBitmap): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get context');

    ctx.drawImage(bitmap, 0, 0);
    return canvas.toDataURL('image/png');
}

async function dataURLToBitmap(dataUrl: string): Promise<ImageBitmap> {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = dataUrl;
    await img.decode();
    return createImageBitmap(img);
}

export async function applyCleanup(
    input: ImageBitmap,
    ops: ImageOperations['cleanup']
): Promise<ImageBitmap> {
    // Return early if no cleanup needed
    if (!ops.deskew && !ops.scanRepair && !ops.backgroundRemoved) {
        return input;
    }

    let currentSrc: string | null = null;

    // Lazy convert to data URL only when needed
    const getSrc = async () => {
        if (!currentSrc) {
            currentSrc = await bitmapToDataURL(input);
        }
        return currentSrc;
    };

    try {
        // 1. Deskew
        if (ops.deskew) {
            const src = await getSrc();
            currentSrc = await deskew(src);
        }

        // 2. Scan Repair
        if (ops.scanRepair) {
            const src = await getSrc();
            currentSrc = await backgroundCleanup(src);
        }

        // 3. Background Removal
        if (ops.backgroundRemoved) {
            const src = await getSrc();
            // removeBackground returns object { maskedSrc, rawMaskDataUrl }
            // We only need maskedSrc for the pipeline visual
            const { maskedSrc } = await removeBackground(src);
            currentSrc = maskedSrc;
        }

        // Convert back to bitmap
        if (currentSrc) {
            return await dataURLToBitmap(currentSrc);
        } else {
            return input;
        }

    } catch (err) {
        console.error("Cleanup pipeline failed:", err);
        return input; // Fallback to input on error
    }
}
