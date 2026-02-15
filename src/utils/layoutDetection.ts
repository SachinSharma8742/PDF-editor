import DocumentWorker from '../workers/documentProcessing.worker?worker';

export interface LayoutRegion {
    x: number;
    y: number;
    width: number;
    height: number;
    type: 'text' | 'image';
}

/**
 * Detect Document Layout logic
 * Returns bounding boxes of text/image blocks.
 */
export function detectLayout(imageSrc: string): Promise<LayoutRegion[]> {
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

            const worker = new DocumentWorker();

            worker.onmessage = (e: MessageEvent) => {
                const { type, action, regions, error } = e.data;
                if (action === 'detect-layout') {
                    if (type === 'result') {
                        resolve(regions);
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
                { type: 'detect-layout', imageData: imageData.data.buffer, width: img.naturalWidth, height: img.naturalHeight },
                [imageData.data.buffer]
            );
        };

        img.onerror = () => reject(new Error('Failed to load image'));
    });
}
