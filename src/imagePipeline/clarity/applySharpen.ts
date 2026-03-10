export async function applySharpen(
    input: ImageBitmap,
    strength: number // 0 to 1
): Promise<ImageBitmap> {
    if (strength <= 0) return input;

    // Create canvas
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

    // Unsharp Mask Algorithm
    // 1. Create blurred copy (Box Blur approximation for speed)
    // 2. Subtract blur from original to get mask
    // 3. Add mask back to original

    // Box blur radius depends on image size, minimal 1
    const radius = 1;

    // Helper for box blur pass
    const blurred = new Uint8ClampedArray(data.length);

    // Simple Box Blur implementation
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let rSum = 0, gSum = 0, bSum = 0, count = 0;

            for (let ky = -radius; ky <= radius; ky++) {
                for (let kx = -radius; kx <= radius; kx++) {
                    const py = Math.min(Math.max(y + ky, 0), height - 1);
                    const px = Math.min(Math.max(x + kx, 0), width - 1);
                    const idx = (py * width + px) * 4;

                    rSum += data[idx];
                    gSum += data[idx + 1];
                    bSum += data[idx + 2];
                    count++;
                }
            }

            const idx = (y * width + x) * 4;
            blurred[idx] = rSum / count;
            blurred[idx + 1] = gSum / count;
            blurred[idx + 2] = bSum / count;
        }
    }

    // Apply Unsharp Mask formula
    // Final = Original + (Original - Blurred) * Amount
    // Amount is derived from strength. Max strength 1 -> Amount 2.0 (strong sharpening)
    const amount = strength * 2.5;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const rBlur = blurred[i];
        const gBlur = blurred[i + 1];
        const bBlur = blurred[i + 2];

        // High-pass signal
        const rMask = r - rBlur;
        const gMask = g - gBlur;
        const bMask = b - bBlur;

        outputData[i] = r + rMask * amount;
        outputData[i + 1] = g + gMask * amount;
        outputData[i + 2] = b + bMask * amount;
        outputData[i + 3] = data[i + 3]; // Alpha unchanged
    }

    // Write back
    const finalImageData = new ImageData(outputData, width, height);
    return createImageBitmap(finalImageData);
}
