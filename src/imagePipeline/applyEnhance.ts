import type { ImageOperations } from "../components/features/editor/ImageStudio/useImageStudioStore";

export async function applyEnhance(
    input: ImageBitmap,
    ops: ImageOperations['enhance']
): Promise<ImageBitmap> {
    if (!ops.upscale && (!ops.upscaleFactor || ops.upscaleFactor <= 1)) return input;

    // Worker communcation
    return new Promise((resolve, reject) => {
        const worker = new Worker(
            new URL('../workers/mlProcessing.worker.ts', import.meta.url),
            { type: 'module' }
        );

        // Convert Bitmap to ImageData for worker (Worker needs buffer)
        // We need an intermediate canvas for this
        const offscreen = new OffscreenCanvas(input.width, input.height);
        const ctx = offscreen.getContext('2d');
        if (!ctx) {
            reject(new Error("Failed to create offscreen context"));
            return;
        }
        ctx.drawImage(input, 0, 0);
        const imageData = ctx.getImageData(0, 0, input.width, input.height);

        worker.onmessage = (e: MessageEvent) => {
            const { type, action, data, width, height, error } = e.data;

            if (action === 'upscale') {
                if (type === 'result') {
                    try {
                        const outImageData = new ImageData(new Uint8ClampedArray(data), width, height);
                        createImageBitmap(outImageData).then(bitmap => {
                            resolve(bitmap);
                            worker.terminate();
                        });
                    } catch (err) {
                        reject(err);
                        worker.terminate();
                    }
                } else if (type === 'error') {
                    reject(new Error(error));
                    worker.terminate();
                }
            }
        };

        worker.onerror = () => {
            reject(new Error('Worker error'));
            worker.terminate();
        };

        // Post message
        worker.postMessage(
            {
                type: 'upscale',
                imageData: imageData.data.buffer,
                width: input.width,
                height: input.height
            },
            [imageData.data.buffer] // Transfer ownership
        );
    });
}
