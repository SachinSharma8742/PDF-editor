import React, { useEffect, useRef, useMemo } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Transformer, Group, Path } from 'react-konva';
import Konva from 'konva';
import useImage from 'use-image';
import { useImageStudioStore } from './useImageStudioStore';

interface StudioCanvasProps {
    src: string;
    width: number;
    height: number;
}

export const StudioCanvas: React.FC<StudioCanvasProps> = ({ src, width, height }) => {
    const { params, activeTab, setParam, setDimensions } = useImageStudioStore();
    const imageRef = useRef<Konva.Image>(null);
    const transformerRef = useRef<Konva.Transformer>(null);
    const cropRectRef = useRef<Konva.Rect>(null);
    const [img] = useImage(src, 'anonymous');

    useEffect(() => {
        if (img) {
            setDimensions(img.width, img.height);
        }
    }, [img, setDimensions]);

    // Calculate fit dimensions with rotation support
    const displayDims = useMemo(() => {
        if (!img || width === 0 || height === 0) return {
            width: 0, height: 0, scale: 1, x: 0, y: 0,
            stageCenterX: width / 2, stageCenterY: height / 2
        };

        // Add padding
        const padding = 48;
        const availW = width - padding * 2;
        const availH = height - padding * 2;

        const isRotated = (params.rotation / 90) % 2 !== 0; // 90, 270, etc.

        // If rotated 90deg, the image's height becomes its width in the container
        const effectiveIW = isRotated ? img.height : img.width;
        const effectiveIH = isRotated ? img.width : img.height;

        const scaleW = availW / effectiveIW;
        const scaleH = availH / effectiveIH;
        const scale = Math.min(scaleW, scaleH, 1);

        // Current visual width/height
        const visualW = img.width * scale;
        const visualH = img.height * scale;

        return {
            width: visualW,
            height: visualH,
            scale,
            x: (width - visualW) / 2, // Top-left of unrotated image relative to stage (approx)
            y: (height - visualH) / 2,
            stageCenterX: width / 2,
            stageCenterY: height / 2,
        };
    }, [img, width, height, params.rotation]);

    // Apply Crop Overlay
    useEffect(() => {
        if (activeTab === 'crop') {
            // Auto-initialize crop if valid image
            if (!params.crop && img) {
                setParam('crop', { x: 0, y: 0, width: img.width, height: img.height });
            }

            if (transformerRef.current && cropRectRef.current) {
                // We need to detach first to avoid issues
                transformerRef.current.nodes([]);
                // Then attach
                transformerRef.current.nodes([cropRectRef.current]);
                transformerRef.current.getLayer()?.batchDraw();
            }
        }
    }, [activeTab, params.crop, img]);

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

        // Apply
        node.filters(activeFilters);

        // Clear previous cache to avoid artifacts or errors
        node.clearCache();

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
                    x={displayDims.stageCenterX}
                    y={displayDims.stageCenterY}
                    width={displayDims.width}
                    height={displayDims.height}
                    offsetX={displayDims.width / 2}
                    offsetY={displayDims.height / 2}
                    rotation={params.rotation} // Rotate background too
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

                    // Place at center of stage
                    x={displayDims.stageCenterX}
                    y={displayDims.stageCenterY}

                    scaleX={(params.flipX ? -1 : 1)}
                    scaleY={(params.flipY ? -1 : 1)}
                />

                {/* Crop Overlay */}
                {activeTab === 'crop' && (
                    <>
                        <Group
                            x={displayDims.stageCenterX}
                            y={displayDims.stageCenterY}
                            offsetX={displayDims.width / 2}
                            offsetY={displayDims.height / 2}
                            rotation={params.rotation}
                            scaleX={(params.flipX ? -1 : 1)}
                            scaleY={(params.flipY ? -1 : 1)}
                        >
                            {/* Dark Tint Overlay with Hole */}
                            <Path
                                data={`M 0 0 H ${displayDims.width} V ${displayDims.height} H 0 Z M ${(params.crop ? params.crop.x * displayDims.scale : 0)} ${(params.crop ? params.crop.y * displayDims.scale : 0)} H ${(params.crop ? (params.crop.x + params.crop.width) * displayDims.scale : displayDims.width)} V ${(params.crop ? (params.crop.y + params.crop.height) * displayDims.scale : displayDims.height)} H ${(params.crop ? params.crop.x * displayDims.scale : 0)} Z`}
                                fill="rgba(0, 0, 0, 0.6)"
                                fillRule="evenodd" // Important for hole
                                listening={false} // Don't block interactions
                            />

                            <Rect
                                ref={cropRectRef}
                                x={params.crop ? params.crop.x * displayDims.scale : 0}
                                y={params.crop ? params.crop.y * displayDims.scale : 0}
                                width={params.crop ? params.crop.width * displayDims.scale : displayDims.width}
                                height={params.crop ? params.crop.height * displayDims.scale : displayDims.height}
                                stroke="white"
                                strokeWidth={2 / displayDims.scale} // Counter-scale stroke? Or just 2
                                dash={[10, 5]}
                                draggable
                                dragBoundFunc={(pos) => {
                                    // POS is absolute global coordinates.
                                    // This is tricky inside a transformed group.
                                    // Easier: Don't implement dragBoundFunc strictly or use local conversion.
                                    // For now, let it be loose.
                                    return pos;
                                }}
                                onTransformEnd={() => {
                                    if (cropRectRef.current) {
                                        const node = cropRectRef.current;
                                        const scaleX = node.scaleX();
                                        const scaleY = node.scaleY();

                                        // Reset scale to 1
                                        node.scaleX(1);
                                        node.scaleY(1);
                                        node.width(node.width() * scaleX);
                                        node.height(node.height() * scaleY);

                                        // Store as relative to image pixels?
                                        // node.x() is local to the Group (which matches Image).
                                        // So node.x() / displayDims.scale = Image Pixels X.
                                        setParam('crop', {
                                            x: node.x() / displayDims.scale,
                                            y: node.y() / displayDims.scale,
                                            width: node.width() / displayDims.scale,
                                            height: node.height() / displayDims.scale
                                        });
                                    }
                                }}
                                onDragEnd={() => {
                                    if (cropRectRef.current) {
                                        const node = cropRectRef.current;
                                        // node.x() is local
                                        setParam('crop', {
                                            x: node.x() / displayDims.scale,
                                            y: node.y() / displayDims.scale,
                                            width: node.width() / displayDims.scale,
                                            height: node.height() / displayDims.scale
                                        });
                                    }
                                }}
                            />
                        </Group>
                        <Transformer
                            ref={transformerRef}
                            rotateEnabled={false}
                            boundBoxFunc={(oldBox, newBox) => {
                                if (newBox.width < 5 || newBox.height < 5) return oldBox;
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
