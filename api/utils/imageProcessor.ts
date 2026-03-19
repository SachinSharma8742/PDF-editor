import sharp from 'sharp';

export type CompressionLevel = 'aggressive' | 'balanced' | 'conservative';
export type TargetDPI = 72 | 96 | 150 | 300;

export interface ImageResampleOptions {
    quality: number;
    dpi: TargetDPI;
    compressionLevel: CompressionLevel;
}

const LEVEL_SCALE: Record<CompressionLevel, number> = {
    aggressive: 0.68,
    balanced: 0.82,
    conservative: 1,
};

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function sanitizeQuality(quality: number) {
    return Math.round(clamp(quality, 1, 100));
}

export async function resampleImageBuffer(imageBuffer: Buffer, options: ImageResampleOptions): Promise<Buffer> {
    const quality = sanitizeQuality(options.quality);

    const source = sharp(imageBuffer, { failOn: 'none' });
    const metadata = await source.metadata();

    const dpiScale = clamp(options.dpi / 300, 0.24, 1);
    const presetScale = LEVEL_SCALE[options.compressionLevel];
    const combinedScale = clamp(dpiScale * presetScale, 0.2, 1);

    const targetWidth = metadata.width ? Math.max(1, Math.round(metadata.width * combinedScale)) : undefined;
    const targetHeight = metadata.height ? Math.max(1, Math.round(metadata.height * combinedScale)) : undefined;

    return source
        .rotate()
        .resize({
            width: targetWidth,
            height: targetHeight,
            fit: 'inside',
            withoutEnlargement: true,
            kernel: sharp.kernel.lanczos3,
        })
        .jpeg({
            quality,
            mozjpeg: true,
            chromaSubsampling: quality < 85 ? '4:2:0' : '4:4:4',
        })
        .toBuffer();
}

export async function renderPdfPageToOptimizedJpeg(
    pdfBuffer: Buffer,
    pageIndex: number,
    options: ImageResampleOptions,
): Promise<{ jpeg: Buffer; width: number; height: number }> {
    const quality = sanitizeQuality(options.quality);
    const density = options.dpi;

    const rendered = await sharp(pdfBuffer, {
        density,
        page: pageIndex,
        pages: 1,
        failOn: 'none',
    })
        .jpeg({
            quality,
            mozjpeg: true,
            chromaSubsampling: quality < 85 ? '4:2:0' : '4:4:4',
        })
        .toBuffer({ resolveWithObject: true });

    const width = rendered.info.width ?? 1;
    const height = rendered.info.height ?? 1;

    const optimizedJpeg = await resampleImageBuffer(rendered.data, {
        ...options,
        quality,
    });

    return {
        jpeg: optimizedJpeg,
        width,
        height,
    };
}
