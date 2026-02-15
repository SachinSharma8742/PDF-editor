import MLWorker from '../workers/mlProcessing.worker?worker';

/**
 * Run ML task in a dedicated worker.
 * Spawns a new worker for each task to ensure memory cleanup.
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

            // Spawn worker
            const worker = new MLWorker();

            worker.onmessage = (e: MessageEvent) => {
                const { type: msgType, action, data, error } = e.data;
                if (action === type) {
                    if (msgType === 'result') {
                        resolve(data);
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
                [imageData.data.buffer] // Zero-copy transfer
            );
        };

        img.onerror = () => reject(new Error('Failed to load image'));
    });
}

/**
 * Subject Detection: computes the bounding box of the dominant foreground subject.
 */
export async function detectSubject(imageSrc: string): Promise<{ x: number; y: number; width: number; height: number } | null> {
    return runMLTask('detect-subject', imageSrc);
}
