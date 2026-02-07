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

    // Calculate fit dimensions with rotation support AND smart zoom for cropping
    const displayDims = useMemo(() => {
        if (!img || width === 0 || height === 0) return {
            width: 0, height: 0, scale: 1, x: 0, y: 0,
            stageCenterX: width / 2, stageCenterY: height / 2,
            offsetX: 0, offsetY: 0, smartZoomActive: false
        };

        // Add padding
        const padding = 48;
        const availW = width - padding * 2;
        const availH = height - padding * 2;

        const isRotated = (params.rotation / 90) % 2 !== 0; // 90, 270, etc.

        // If rotated 90deg, the image's height becomes its width in the container
        const effectiveIW = isRotated ? img.height : img.width;
        const effectiveIH = isRotated ? img.width : img.height;

        // Base scale to fit full image
        const baseScaleW = availW / effectiveIW;
        const baseScaleH = availH / effectiveIH;
        const baseScale = Math.min(baseScaleW, baseScaleH, 1);

        // Smart Zoom: When in crop mode with a crop selection
        let smartScale = baseScale;
        let offsetX = 0;
        let offsetY = 0;
        let smartZoomActive = false;

        if (activeTab === 'crop' && params.crop) {
            const cropW = params.crop.width;
            const cropH = params.crop.height;
            const imageArea = img.width * img.height;
            const cropArea = cropW * cropH;
            const cropRatio = cropArea / imageArea;

            // Only apply smart zoom if crop is less than 80% of image area
            if (cropRatio < 0.8) {
                smartZoomActive = true;

                // Calculate scale to make the crop area fill ~70% of available space
                const effectiveCropW = isRotated ? cropH : cropW;
                const effectiveCropH = isRotated ? cropW : cropH;

                const cropScaleW = (availW * 0.85) / effectiveCropW;
                const cropScaleH = (availH * 0.85) / effectiveCropH;
                const cropScale = Math.min(cropScaleW, cropScaleH);

                // Limit zoom to reasonable bounds (1x to 4x of base scale)
                const maxZoom = baseScale * 4;
                const minZoom = baseScale;
                smartScale = Math.max(minZoom, Math.min(cropScale, maxZoom));

                // Calculate offset to center the crop area
                // Crop center in image coordinates
                const cropCenterX = params.crop.x + cropW / 2;
                const cropCenterY = params.crop.y + cropH / 2;

                // Image center
                const imageCenterX = img.width / 2;
                const imageCenterY = img.height / 2;

                // Offset needed to center crop (in scaled pixels)
                offsetX = (imageCenterX - cropCenterX) * smartScale;
                offsetY = (imageCenterY - cropCenterY) * smartScale;
            }
        }

        // Current visual width/height
        const visualW = img.width * smartScale;
        const visualH = img.height * smartScale;

        return {
            width: visualW,
            height: visualH,
            scale: smartScale,
            x: (width - visualW) / 2, // Top-left of unrotated image relative to stage (approx)
            y: (height - visualH) / 2,
            stageCenterX: width / 2,
            stageCenterY: height / 2,
            offsetX,
            offsetY,
            smartZoomActive
        };
    }, [img, width, height, params.rotation, activeTab, params.crop]);

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
                    x={displayDims.stageCenterX + displayDims.offsetX}
                    y={displayDims.stageCenterY + displayDims.offsetY}
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

                    // Place at center of stage (with smart zoom offset)
                    x={displayDims.stageCenterX + displayDims.offsetX}
                    y={displayDims.stageCenterY + displayDims.offsetY}

                    scaleX={(params.flipX ? -1 : 1)}
                    scaleY={(params.flipY ? -1 : 1)}
                />

                {/* Crop Overlay */}
                {activeTab === 'crop' && (
                    <>
                        <Group
                            x={displayDims.stageCenterX + displayDims.offsetX}
                            y={displayDims.stageCenterY + displayDims.offsetY}
                            offsetX={displayDims.width / 2}
                            offsetY={displayDims.height / 2}
                            rotation={params.rotation}
                            scaleX={(params.flipX ? -1 : 1)}
                            scaleY={(params.flipY ? -1 : 1)}
                        >
                            {/* Dark Tint Overlay with Hole */}
                            <Path
                                data={(() => {
                                    // Outer Rectangle (Full Image)
                                    const outer = `M 0 0 H ${displayDims.width} V ${displayDims.height} H 0 Z`;

                                    // Inner Hole (The visible crop part)
                                    let inner = "";

                                    const cx = params.crop ? params.crop.x * displayDims.scale : 0;
                                    const cy = params.crop ? params.crop.y * displayDims.scale : 0;
                                    const cw = params.crop ? params.crop.width * displayDims.scale : displayDims.width;
                                    const ch = params.crop ? params.crop.height * displayDims.scale : displayDims.height;
                                    const shape = params.cropShape || 'rect';

                                    if (shape === 'circle') {
                                        const rx = cw / 2;
                                        const ry = ch / 2;
                                        const centX = cx + rx;
                                        const centY = cy + ry;
                                        // Counter-clockwise for hole in non-zero rule,
                                        // BUT evenodd rule is simpler: just draw the shape.
                                        // For evenodd to work as a hole, we just draw the shape path.
                                        // Circle path: move to right edge, arc around.
                                        inner = `M ${centX - rx} ${centY} A ${rx} ${ry} 0 1 0 ${centX + rx} ${centY} A ${rx} ${ry} 0 1 0 ${centX - rx} ${centY}`;
                                    } else if (shape === 'heart') {
                                        // Approximate heart shape path normalized to crop box
                                        const p0 = { x: cx + cw / 2, y: cy + ch };
                                        const p1 = { x: cx, y: cy + ch * 0.4 };
                                        const p2 = { x: cx, y: cy };
                                        const p3 = { x: cx + cw / 2, y: cy + ch * 0.2 };
                                        const p4 = { x: cx + cw, y: cy };
                                        const p5 = { x: cx + cw, y: cy + ch * 0.4 };

                                        // Cubic Bezier Heart
                                        // simplified:
                                        // M center bottom
                                        // C (control points) top-left
                                        inner = `M ${cx + cw / 2} ${cy + ch} ` +
                                            `C ${cx} ${cy + ch * 0.6}, ${cx} ${cy}, ${cx + cw / 2} ${cy + ch * 0.3} ` +
                                            `C ${cx + cw} ${cy}, ${cx + cw} ${cy + ch * 0.6}, ${cx + cw / 2} ${cy + ch} Z`;
                                    } else {
                                        // Rect
                                        inner = `M ${cx} ${cy} H ${cx + cw} V ${cy + ch} H ${cx} Z`;
                                    }

                                    return `${outer} ${inner}`;
                                })()}
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

                                        // Reset scale to 1 - standard Konva pattern
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
