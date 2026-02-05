import React, { useEffect, useRef, useMemo } from 'react';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import Konva from 'konva';
import useImage from 'use-image';
import { useImageStudioStore } from './useImageStudioStore';

interface StudioCanvasProps {
    src: string;
    width: number;
    height: number;
}

export const StudioCanvas: React.FC<StudioCanvasProps> = ({ src, width, height }) => {
    const { params } = useImageStudioStore();
    const imageRef = useRef<Konva.Image>(null);
    const [img] = useImage(src, 'anonymous');

    // Calculate fit dimensions
    const displayDims = useMemo(() => {
        if (!img || width === 0 || height === 0) return { width, height, scale: 1 };

        // Add padding
        const padding = 40;
        const availW = width - padding * 2;
        const availH = height - padding * 2;

        const scaleW = availW / img.width;
        const scaleH = availH / img.height;
        const scale = Math.min(scaleW, scaleH, 1); // Never scale up pixelated? Maybe allow it.

        return {
            width: img.width * scale,
            height: img.height * scale,
            scale,
            x: (width - img.width * scale) / 2,
            y: (height - img.height * scale) / 2
        };
    }, [img, width, height]);

    // Apply Filters
    useEffect(() => {
        if (!img || !imageRef.current) return;

        const node = imageRef.current;
        const activeFilters: any[] = [];

        // 1. Basic Adjustments
        if (params.brightness !== 0) {
            activeFilters.push(Konva.Filters.Brighten);
            node.brightness(params.brightness);
        }
        if (params.contrast !== 0) {
            activeFilters.push(Konva.Filters.Contrast);
            node.contrast(params.contrast);
        }
        if (params.saturation !== 0) {
            activeFilters.push(Konva.Filters.HSL);
            node.saturation(params.saturation);
            // Hue and Value are not in params currently, remove them or add them
        }

        // Blur
        if (params.blur > 0) {
            activeFilters.push(Konva.Filters.Blur);
            node.blurRadius(params.blur);
        }

        // Noise
        if (params.noise > 0) {
            activeFilters.push(Konva.Filters.Noise);
            node.noise(params.noise);
        }

        // Pixelate (Quality Mode?)
        // if (params.pixelate > 1) { ... }

        // Grayscale / Invert / Sepia
        if (params.grayscale) activeFilters.push(Konva.Filters.Grayscale);
        if (params.invert) activeFilters.push(Konva.Filters.Invert);
        if (params.sepia) activeFilters.push(Konva.Filters.Sepia);

        // Apply
        node.filters(activeFilters);
        node.cache(); // Critical for filters
    }, [img, params]);

    // Force re-cache on resize ?
    useEffect(() => {
        if (imageRef.current) {
            imageRef.current.cache();
        }
    }, [displayDims]);

    if (!img) return null;

    return (
        <Stage width={width} height={height}>
            <Layer>
                {/* Checkerboard Background for Transparency */}
                <KonvaImage
                    image={checkerboardPattern(20)}
                    x={displayDims.x}
                    y={displayDims.y}
                    width={displayDims.width}
                    height={displayDims.height}
                    fillPatternRepeat="repeat"
                />

                <KonvaImage
                    ref={imageRef}
                    image={img}
                    width={displayDims.width}
                    height={displayDims.height}

                    // Transforms
                    rotation={params.rotation}

                    // Center pivot for correct rotation/flip
                    offsetX={img.width / 2}
                    offsetY={img.height / 2}

                    // We need to adjust X/Y to account for pivot offset
                    x={displayDims.x + (displayDims.width / 2)}
                    y={displayDims.y + (displayDims.height / 2)}

                    scaleX={(params.flipX ? -1 : 1) * (displayDims.width / img.width)}
                    scaleY={(params.flipY ? -1 : 1) * (displayDims.height / img.height)}
                />
            </Layer>
        </Stage>
    );
};

// Helper for background pattern
const checkerboardPattern = (size: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = size * 2;
    canvas.height = size * 2;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = '#27272a'; // Zinc-800
        ctx.fillRect(0, 0, size * 2, size * 2);
        ctx.fillStyle = '#3f3f46'; // Zinc-700
        ctx.fillRect(0, 0, size, size);
        ctx.fillRect(size, size, size, size);
    }
    const img = new Image();
    img.src = canvas.toDataURL();
    return img;
};
