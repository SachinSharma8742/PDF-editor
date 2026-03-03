import type { ImageOperations, ImagePipelineCache } from "../components/features/editor/ImageStudio/useImageStudioStore";
import { applyTransform } from "./applyTransform";
import { applyCleanup } from "./applyCleanup";
import { applyEnhance } from "./applyEnhance";
import { applyAdjust } from "./applyAdjust";
import { applyEffects } from "./applyEffects";

export async function buildPipeline(
    source: ImageBitmap,
    ops: ImageOperations,
    cache: ImagePipelineCache
): Promise<{ output: ImageBitmap, cache: ImagePipelineCache }> {
    let current = source;
    const newCache = { ...cache };

    // 1. Transform (Rotate, Flip, Crop)
    // Caching Strategy: Check if transformOps match exactly
    const transformOpsMatch = cache.transformOps &&
        cache.transformOps.rotate === ops.transform.rotate &&
        cache.transformOps.flipX === ops.transform.flipX &&
        cache.transformOps.flipY === ops.transform.flipY &&
        // Deep compare crop
        JSON.stringify(cache.transformOps.crop) === JSON.stringify(ops.transform.crop) &&
        cache.transformOps.cropShape === ops.transform.cropShape;

    let transformChanged = false;

    if (cache.transformed && transformOpsMatch) {
        current = cache.transformed;
        newCache.transformed = cache.transformed;
        newCache.transformOps = cache.transformOps;
    } else {
        current = await applyTransform(current, ops.transform);
        newCache.transformed = current;
        newCache.transformOps = { ...ops.transform, crop: ops.transform.crop ? { ...ops.transform.crop } : undefined };
        transformChanged = true;
    }

    // 2. Cleanup (Deskew, BG Removal - ScanRepair deprecated)
    // Caching Strategy: Check if cleanupOps match exactly AND upstream didn't change
    const opsMatch = cache.cleanupOps &&
        cache.cleanupOps.deskew === ops.cleanup.deskew &&
        cache.cleanupOps.backgroundRemoved === ops.cleanup.backgroundRemoved;

    if (!transformChanged && cache.cleaned && opsMatch) {
        current = cache.cleaned;
        newCache.cleaned = cache.cleaned;
        newCache.cleanupOps = cache.cleanupOps;
    } else {
        // Run cleanup
        current = await applyCleanup(current, ops.cleanup);
        newCache.cleaned = current;
        newCache.cleanupOps = { ...ops.cleanup };
    }
    const cleanupChanged = transformChanged || !opsMatch || !cache.cleaned;

    // 3. Enhance - Upscale
    // Caching for upscale:
    if (ops.enhance.upscale && (!cache.enhanced || cleanupChanged)) {
        current = await applyEnhance(current, ops.enhance);
        newCache.enhanced = current;
        newCache.enhancedOps = { ...ops.enhance };
    } else if (cache.enhanced && ops.enhance.upscale) {
        current = cache.enhanced;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const enhanceChanged = cleanupChanged || (ops.enhance.upscale !== (cache.enhancedOps?.upscale || false));

    // 4. Clarity Removed

    // 5. Adjust (Brightness, etc.)
    current = await applyAdjust(current, ops.adjust);

    // 6. Effects (Grayscale, etc.)
    current = await applyEffects(current, ops.effects);

    return { output: current, cache: newCache };
}
