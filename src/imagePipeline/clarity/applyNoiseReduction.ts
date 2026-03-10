export async function applyNoiseReduction(
    input: ImageBitmap,
    strength: number // 0 to 1
): Promise<ImageBitmap> {
    if (strength <= 0) return input;

    // Create canvas to read pixel data
    const canvas = new OffscreenCanvas(input.width, input.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return input;

    ctx.drawImage(input, 0, 0);
    const imageData = ctx.getImageData(0, 0, input.width, input.height);
    const data = imageData.data;
    const width = input.width;
    const height = input.height;

    // Create output buffer
    const outputData = new Uint8ClampedArray(data.length);

    // Determines algorithm based on strength
    // Strength 0-0.5: Median Filter (3x3) - effective for grain/speckle
    // Strength 0.5-1.0: Bilateral-ish Smoothing - preserves edges
    const useMedian = strength <= 0.5;

    if (useMedian) {
        // Simple 3x3 Median Filter
        const kernelSize = 3;
        const half = Math.floor(kernelSize / 2);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const r: number[] = [];
                const g: number[] = [];
                const b: number[] = [];
                const aVal = data[(y * width + x) * 4 + 3];

                for (let ky = -half; ky <= half; ky++) {
                    for (let kx = -half; kx <= half; kx++) {
                        const py = Math.min(Math.max(y + ky, 0), height - 1);
                        const px = Math.min(Math.max(x + kx, 0), width - 1);
                        const idx = (py * width + px) * 4;
                        r.push(data[idx]);
                        g.push(data[idx + 1]);
                        b.push(data[idx + 2]);
                    }
                }

                r.sort((a, b) => a - b);
                g.sort((a, b) => a - b);
                b.sort((a, b) => a - b);

                const center = Math.floor(r.length / 2);
                const outIdx = (y * width + x) * 4;

                // Mix with original based on strength (2x strength since range is 0-0.5)
                const mix = strength * 2;
                outputData[outIdx] = r[center] * mix + data[outIdx] * (1 - mix);
                outputData[outIdx + 1] = g[center] * mix + data[outIdx + 1] * (1 - mix);
                outputData[outIdx + 2] = b[center] * mix + data[outIdx + 2] * (1 - mix);
                outputData[outIdx + 3] = aVal;
            }
        }
    } else {
        // "Smart" Smoothing (Approximate Bilateral)
        // Checks similarity of neighbors to preserve edges
        const radius = 2;
        const threshold = 30; // Pixel difference threshold for edge detection

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let rSum = 0, gSum = 0, bSum = 0, count = 0;
                const idx = (y * width + x) * 4;
                const r0 = data[idx];
                const g0 = data[idx + 1];
                const b0 = data[idx + 2];

                for (let ky = -radius; ky <= radius; ky++) {
                    for (let kx = -radius; kx <= radius; kx++) {
                        const py = Math.min(Math.max(y + ky, 0), height - 1);
                        const px = Math.min(Math.max(x + kx, 0), width - 1);
                        const pIdx = (py * width + px) * 4;

                        const r = data[pIdx];
                        const g = data[pIdx + 1];
                        const b = data[pIdx + 2];

                        // Closeness check (intensity difference)
                        const dist = Math.abs(r - r0) + Math.abs(g - g0) + Math.abs(b - b0);

                        if (dist < threshold) {
                            rSum += r;
                            gSum += g;
                            bSum += b;
                            count++;
                        }
                    }
                }

                // Strength 0.5-1.0 mapped to mix 0.0-1.0
                const mix = (strength - 0.5) * 2;
                outputData[idx] = (rSum / count) * mix + r0 * (1 - mix);
                outputData[idx + 1] = (gSum / count) * mix + g0 * (1 - mix);
                outputData[idx + 2] = (bSum / count) * mix + b0 * (1 - mix);
                outputData[idx + 3] = data[idx + 3];
            }
        }
    }

    // Write back to bitmap
    const finalImageData = new ImageData(outputData, width, height);
    return createImageBitmap(finalImageData);
}
