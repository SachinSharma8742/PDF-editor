import React, { useEffect, useRef, useMemo } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Transformer } from 'react-konva';
import Konva from 'konva';
import useImage from 'use-image';
import { useImageStudioStore } from './useImageStudioStore';

interface StudioCanvasProps {
    src: string;
    width: number;
    height: number;
}

export const StudioCanvas: React.FC<StudioCanvasProps> = ({ src, width, height }) => {
    const { params, activeTab, setParam } = useImageStudioStore();
    const imageRef = useRef<Konva.Image>(null);
    const transformerRef = useRef<Konva.Transformer>(null);
    const cropRectRef = useRef<Konva.Rect>(null);
    const [img] = useImage(src, 'anonymous');

    // Calculate fit dimensions
    const displayDims = useMemo(() => {
        if (!img || width === 0 || height === 0) return { width, height, scale: 1, x: 0, y: 0 };

        // Add padding
        const padding = 20;
        const availW = width - padding * 2;
        const availH = height - padding * 2;

        const scaleW = availW / img.width;
        const scaleH = availH / img.height;
        const scale = Math.min(scaleW, scaleH, 1);

        return {
            width: img.width * scale,
            height: img.height * scale,
            scale,
            x: (width - img.width * scale) / 2,
            y: (height - img.height * scale) / 2
        };
    }, [img, width, height]);

    // Apply Crop Overlay (Simple visual only for now, logic needs to map back to params.crop)
    useEffect(() => {
        if (activeTab === 'crop' && transformerRef.current && cropRectRef.current) {
            transformerRef.current.nodes([cropRectRef.current]);
            transformerRef.current.getLayer()?.batchDraw();
        }
    }, [activeTab]);

    // Apply Filters
    // Apply Filters
    useEffect(() => {
        if (!img || !imageRef.current) return;

        const node = imageRef.current;
        const activeFilters: any[] = [];

        // Debug log
        // console.log("StudioCanvas: Applying params", params);

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

        // Grayscale / Invert / Sepia
        if (params.grayscale) activeFilters.push(Konva.Filters.Grayscale);
        if (params.invert) activeFilters.push(Konva.Filters.Invert);
        if (params.sepia) activeFilters.push(Konva.Filters.Sepia);

        // Pixelate (if added) or others...

        // Apply
        node.filters(activeFilters);

        // Clear previous cache to avoid artifacts or errors
        node.clearCache();

        // Only cache if we have filters or we need to cache for some other reason
        // But for consistency we always cache here to ensure filters appear
        if (activeFilters.length > 0) {
            try {
                node.cache({
                    pixelRatio: 1, // Fix resolution for performance
                    imageSmoothingEnabled: true
                });
            } catch (e) {
                console.error("StudioCanvas: Failed to cache image", e);
            }
        }

        node.getLayer()?.batchDraw();
    }, [img, params]);

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
                    opacity={0.5}
                />

                <KonvaImage
                    ref={imageRef}
                    image={img}
                    width={displayDims.width}
                    height={displayDims.height}

                    // Transforms
                    rotation={params.rotation}

                    // Center pivot for correct rotation/flip
                    offsetX={displayDims.width / 2}
                    offsetY={displayDims.height / 2}

                    // We need to adjust X/Y to account for pivot offset
                    x={displayDims.x + (displayDims.width / 2)}
                    y={displayDims.y + (displayDims.height / 2)}

                    scaleX={(params.flipX ? -1 : 1)}
                    scaleY={(params.flipY ? -1 : 1)}
                />

                {/* Crop Overlay */}
                {activeTab === 'crop' && (
                    <>
                        <Rect
                            ref={cropRectRef}
                            x={params.crop ? (displayDims.x + params.crop.x * displayDims.scale) : displayDims.x}
                            y={params.crop ? (displayDims.y + params.crop.y * displayDims.scale) : displayDims.y}
                            width={params.crop ? (params.crop.width * displayDims.scale) : displayDims.width}
                            height={params.crop ? (params.crop.height * displayDims.scale) : displayDims.height}
                            stroke="white"
                            strokeWidth={2}
                            dash={[10, 5]}
                            draggable
                            dragBoundFunc={(pos: Konva.Vector2d) => {
                                // Simple bounds check relative to the image display area
                                const x = Math.max(displayDims.x, Math.min(pos.x, displayDims.x + displayDims.width - (cropRectRef.current?.width() || 0)));
                                const y = Math.max(displayDims.y, Math.min(pos.y, displayDims.y + displayDims.height - (cropRectRef.current?.height() || 0)));
                                return { x, y };
                            }}
                            onTransformEnd={() => {
                                if (cropRectRef.current) {
                                    const node = cropRectRef.current;
                                    const scaleX = node.scaleX();
                                    const scaleY = node.scaleY();

                                    // Reset scale to 1 and adjust width/height to avoid compounding scales
                                    node.scaleX(1);
                                    node.scaleY(1);
                                    node.width(node.width() * scaleX);
                                    node.height(node.height() * scaleY);

                                    // Calculate relative crop
                                    const relativeX = (node.x() - displayDims.x) / displayDims.scale;
                                    const relativeY = (node.y() - displayDims.y) / displayDims.scale;
                                    const relativeW = node.width() / displayDims.scale;
                                    const relativeH = node.height() / displayDims.scale;

                                    setParam('crop', {
                                        x: Math.max(0, relativeX),
                                        y: Math.max(0, relativeY),
                                        width: relativeW,
                                        height: relativeH
                                    });
                                }
                            }}
                            onDragEnd={() => {
                                if (cropRectRef.current) {
                                    const node = cropRectRef.current;
                                    const relativeX = (node.x() - displayDims.x) / displayDims.scale;
                                    const relativeY = (node.y() - displayDims.y) / displayDims.scale;
                                    const relativeW = node.width() / displayDims.scale;
                                    const relativeH = node.height() / displayDims.scale;

                                    setParam('crop', {
                                        x: Math.max(0, relativeX),
                                        y: Math.max(0, relativeY),
                                        width: relativeW,
                                        height: relativeH
                                    });
                                }
                            }}
                        />
                        <Transformer
                            ref={transformerRef}
                            rotateEnabled={false}
                            boundBoxFunc={(oldBox: any, newBox: any) => {
                                // limit resize
                                if (newBox.width < 5 || newBox.height < 5) {
                                    return oldBox;
                                }
                                // Constrain to image bounds could go here too for perfection
                                return newBox;
                            }}
                        />
                    </>
                )}
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
