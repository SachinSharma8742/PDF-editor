import MLWorker from '../workers/mlProcessing.worker?worker';

/**
 * Run ML task in a dedicated worker.
 */
function runMLTask(type: 'detect-subject' | 'upscale', imageSrc: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imageSrc;

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);

            const worker = new MLWorker();

            worker.onmessage = (e: MessageEvent) => {
                const { type: msgType, action, data, width, height, error } = e.data;
                if (action === type) {
                    if (msgType === 'result') {
                        // For upscale, we get back raw buffer. Convert to blob/url.
                        const outCanvas = document.createElement('canvas');
                        outCanvas.width = width;
                        outCanvas.height = height;
                        const outCtx = outCanvas.getContext('2d')!;
                        const outImgData = new ImageData(new Uint8ClampedArray(data), width, height);
                        outCtx.putImageData(outImgData, 0, 0);
                        resolve(outCanvas.toDataURL('image/png'));

                        worker.terminate();
                    } else if (msgType === 'error') {
                        reject(new Error(error));
                        worker.terminate();
                    }
                }
            };

            worker.onerror = (err) => {
                reject(err instanceof Error ? err : new Error('Worker error'));
                worker.terminate();
            };

            worker.postMessage(
                { type, imageData: imageData.data.buffer, width: img.naturalWidth, height: img.naturalHeight },
                [imageData.data.buffer]
            );
        };

        img.onerror = () => reject(new Error('Failed to load image'));
    });
}

/**
 * AI Image Upscale: high-quality 2x upscaling via worker.
 */
export async function upscaleImage(imageSrc: string): Promise<string> {
    return runMLTask('upscale', imageSrc);
}
