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
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get 2D context'));
                return;
            }
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);

            // Spawn worker
            const worker = new Worker(
                new URL('../workers/mlProcessing.worker.ts', import.meta.url),
                { type: 'module' }
            );

            // Timeout
            const timeoutId = setTimeout(() => {
                worker.terminate();
                reject(new Error('ML task timed out'));
            }, 30000);

            worker.onmessage = (e: MessageEvent) => {
                clearTimeout(timeoutId);
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
                clearTimeout(timeoutId);
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
