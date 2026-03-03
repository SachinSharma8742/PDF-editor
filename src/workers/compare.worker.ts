/**
 * Document Comparison Worker
 *
 * Performs heavy pixel-diff computation off the main thread.
 * Receives two image data buffers, computes per-pixel RGB distance,
 * and returns a diff mask highlighting changed regions.
 *
 * Messages IN:
 *   { type: 'pixel-diff', imageDataA: ArrayBuffer, imageDataB: ArrayBuffer, width: number, height: number, threshold: number }
 *
 * Messages OUT:
 *   { type: 'progress', percent: number }
 *   { type: 'result', action: 'pixel-diff', diffData: ArrayBuffer, width: number, height: number, changedPixels: number, totalPixels: number }
 *   { type: 'error', message: string }
 */

self.onmessage = (e: MessageEvent) => {
    const { type } = e.data;

    try {
        if (type === 'pixel-diff') {
            const {
                imageDataA,
                imageDataB,
                width,
                height,
                threshold = 30,
            } = e.data;

            const pixelsA = new Uint8ClampedArray(imageDataA);
            const pixelsB = new Uint8ClampedArray(imageDataB);
            const totalPixels = width * height;

            // Output: RGBA diff mask
            // - Unchanged pixels: transparent
            // - Changed pixels: red overlay with alpha proportional to difference
            const diffMask = new Uint8ClampedArray(totalPixels * 4);

            let changedPixels = 0;
            const progressInterval = Math.max(1, Math.floor(totalPixels / 20)); // 5% increments

            for (let i = 0; i < totalPixels; i++) {
                const offset = i * 4;

                const rA = pixelsA[offset];
                const gA = pixelsA[offset + 1];
                const bA = pixelsA[offset + 2];

                const rB = pixelsB[offset];
                const gB = pixelsB[offset + 1];
                const bB = pixelsB[offset + 2];

                // Euclidean RGB distance
                const distance = Math.sqrt(
                    (rA - rB) ** 2 +
                    (gA - gB) ** 2 +
                    (bA - bB) ** 2
                );

                if (distance > threshold) {
                    changedPixels++;
                    // Red highlight with intensity proportional to difference
                    const intensity = Math.min(255, Math.floor((distance / 441.67) * 255)); // 441.67 = max RGB distance
                    diffMask[offset] = 255;       // R
                    diffMask[offset + 1] = 50;    // G
                    diffMask[offset + 2] = 50;    // B
                    diffMask[offset + 3] = Math.max(80, intensity); // A (min 80 for visibility)
                } else {
                    // Transparent — no change
                    diffMask[offset] = 0;
                    diffMask[offset + 1] = 0;
                    diffMask[offset + 2] = 0;
                    diffMask[offset + 3] = 0;
                }

                // Report progress periodically
                if (i > 0 && i % progressInterval === 0) {
                    const percent = Math.round((i / totalPixels) * 100);
                    postMessage({ type: 'progress', percent });
                }
            }

            // Transfer the diff mask buffer back to main thread
            const buffer = diffMask.buffer as ArrayBuffer;
            postMessage(
                {
                    type: 'result',
                    action: 'pixel-diff',
                    diffData: buffer,
                    width,
                    height,
                    changedPixels,
                    totalPixels,
                },
                { transfer: [buffer] }
            );
        } else {
            postMessage({ type: 'error', message: `Unknown message type: ${type}` });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Worker error';
        postMessage({ type: 'error', message });
    }
};
