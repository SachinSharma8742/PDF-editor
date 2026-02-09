import type { PageEffect } from '../store/pdfStore';

export const applyEffectStack = (ctx: CanvasRenderingContext2D, effects: PageEffect[]) => {
    if (!effects || effects.length === 0) return;

    effects.forEach(effect => {
        if (!effect.visible) return;
        applySingleEffect(ctx, effect);
    });
};

export const applySingleEffect = (ctx: CanvasRenderingContext2D, effect: PageEffect) => {
    const { width, height } = ctx.canvas;
    const opacity = effect.opacity ?? 1;
    const blendMode = effect.blendMode || 'normal';

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = blendMode as GlobalCompositeOperation;

    switch (effect.effect) {
        case 'grayscale':
            ctx.filter = `grayscale(${effect.params.intensity ?? 100}%)`;
            ctx.drawImage(ctx.canvas, 0, 0);
            break;
        case 'sepia':
            ctx.filter = `sepia(${effect.params.intensity ?? 100}%)`;
            ctx.drawImage(ctx.canvas, 0, 0);
            break;
        case 'invert':
            ctx.filter = `invert(${effect.params.intensity ?? 100}%)`;
            ctx.drawImage(ctx.canvas, 0, 0);
            break;
        case 'brightness':
            ctx.filter = `brightness(${effect.params.value ?? 100}%)`;
            ctx.drawImage(ctx.canvas, 0, 0);
            break;
        case 'contrast':
            ctx.filter = `contrast(${effect.params.value ?? 100}%)`;
            ctx.drawImage(ctx.canvas, 0, 0);
            break;
        case 'blur':
            ctx.filter = `blur(${effect.params.value ?? 0}px)`;
            ctx.drawImage(ctx.canvas, 0, 0);
            break;
        case 'bw':
            applyThresholdEffect(ctx, effect.params.threshold ?? 128);
            break;
        case 'scanEnhance':
            applyScanEnhanceEffect(ctx, effect.params);
            break;
        case 'tint':
            ctx.fillStyle = effect.params.color || 'transparent';
            ctx.fillRect(0, 0, width, height);
            break;
        case 'temperature':
            applyTemperatureEffect(ctx, effect.params.value ?? 0);
            break;
        case 'vignette':
            applyVignetteEffect(ctx, effect.params.intensity ?? 50);
            break;
    }

    ctx.restore();
};

const applyThresholdEffect = (ctx: CanvasRenderingContext2D, threshold: number) => {
    const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const val = gray >= threshold ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = val;
    }
    ctx.putImageData(imageData, 0, 0);
};

const applyScanEnhanceEffect = (ctx: CanvasRenderingContext2D, params: any) => {
    const contrast = params.contrast ?? 1.5;
    const brightness = params.brightness ?? 1.1;

    ctx.filter = `grayscale(100%) contrast(${contrast * 100}%) brightness(${brightness * 100}%)`;
    ctx.drawImage(ctx.canvas, 0, 0);
    ctx.filter = 'none';
};

const applyTemperatureEffect = (ctx: CanvasRenderingContext2D, value: number) => {
    // warm (positive) = more red/yellow, cool (negative) = more blue
    const { width, height } = ctx.canvas;
    ctx.save();
    if (value > 0) {
        ctx.fillStyle = `rgba(255, 165, 0, ${Math.abs(value) / 200})`; // Orange-ish for warm
    } else {
        ctx.fillStyle = `rgba(0, 0, 255, ${Math.abs(value) / 200})`; // Blue-ish for cool
    }
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
};

const applyVignetteEffect = (ctx: CanvasRenderingContext2D, intensity: number) => {
    const { width, height } = ctx.canvas;
    const gradient = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.sqrt(Math.pow(width / 2, 2) + Math.pow(height / 2, 2))
    );

    const alpha = intensity / 100;
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.6, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, `rgba(0,0,0,${alpha})`);

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
};
