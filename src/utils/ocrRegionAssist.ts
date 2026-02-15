import DocumentAnalysisWorker from '../workers/documentAnalysis.worker?worker';

export type RegionType = 'text' | 'image' | 'header' | 'footer' | 'body' | 'ocr';

export interface AnalysisRegion {
    x: number;
    y: number;
    width: number;
    height: number;
    type: RegionType;
}

export async function detectOCRRegions(imageSrc: string): Promise<AnalysisRegion[]> {
    return new Promise((resolve, reject) => {
        const worker = new DocumentAnalysisWorker();
        const img = new Image();
        img.crossOrigin = 'Anonymous';

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                worker.terminate();
                reject(new Error('Failed to get 2D context'));
                return;
            }
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, img.width, img.height);

            worker.postMessage({
                type: 'ocr-region-assist',
                imageData: imageData.data.buffer,
                width: img.width,
                height: img.height
            }, [imageData.data.buffer]);
        };

        img.onerror = () => {
            reject(new Error('Failed to load image for OCR analysis'));
            worker.terminate();
        };

        const timeoutId = setTimeout(() => {
            worker.terminate();
            reject(new Error('Worker timed out'));
        }, 30000); // 30s timeout

        worker.onmessage = (e) => {
            clearTimeout(timeoutId);
            const { type, action, regions, message } = e.data;
            if (type === 'result' && action === 'ocr-region-assist') {
                resolve(regions);
                worker.terminate();
            } else if (type === 'error') {
                reject(new Error(message));
                worker.terminate();
            } else {
                // Unexpected message
                reject(new Error('Unexpected worker response'));
                worker.terminate();
            }
        };

        worker.onerror = (e) => {
            clearTimeout(timeoutId);
            reject(new Error(`Worker error: ${e.message}`));
            worker.terminate();
        };

        img.src = imageSrc;
    });
}
