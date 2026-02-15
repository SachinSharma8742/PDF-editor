import DocumentWorker from '../workers/documentProcessing.worker?worker';

/**
 * Auto Document Cleanup
 * Spawns a worker to process the image and return a cleaned version.
 */
export function autoCleanupDocument(imageSrc: string): Promise<string> {
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

            const worker = new DocumentWorker();

            worker.onmessage = (e: MessageEvent) => {
                const { type, action, imageData: resultBuffer, width, height, error } = e.data;
                if (action === 'auto-cleanup') {
                    if (type === 'result') {
                        // Convert buffer back to Data URL
                        const resCanvas = document.createElement('canvas');
                        resCanvas.width = width;
                        resCanvas.height = height;
                        const resCtx = resCanvas.getContext('2d')!;
                        const resData = new ImageData(new Uint8ClampedArray(resultBuffer), width, height);
                        resCtx.putImageData(resData, 0, 0);
                        resolve(resCanvas.toDataURL('image/png'));
                        worker.terminate();
                    } else if (type === 'error') {
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
                { type: 'auto-cleanup', imageData: imageData.data.buffer, width: img.naturalWidth, height: img.naturalHeight },
                [imageData.data.buffer]
            );
        };

        img.onerror = () => reject(new Error('Failed to load image'));
    });
}
