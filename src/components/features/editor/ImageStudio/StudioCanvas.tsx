import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Transformer, Group, Path } from 'react-konva';
import Konva from 'konva';
import { useImageStudioStore } from './useImageStudioStore';

interface StudioCanvasProps {
    width: number;
    height: number;
}

import { buildPipeline } from '../../../../imagePipeline/buildPipeline';

export const StudioCanvas: React.FC<StudioCanvasProps> = ({ width, height }) => {
    const { params, activeTab, setParam, setDimensions, sourceBitmap, operations, pipelineCache } = useImageStudioStore();
    const imageRef = useRef<Konva.Image>(null);
    const transformerRef = useRef<Konva.Transformer>(null);
    const cropRectRef = useRef<Konva.Rect>(null);

    // Pipeline State
    const [pipelineImg, setPipelineImg] = useState<ImageBitmap | HTMLImageElement | null>(null);

    // -- OPTIMIZATION: Effective Operations --
    // When in Crop tab, we want to see the FULL image (uncropped) so we can adjust the crop box.
    // So we temporarily strip the 'crop' operation from the pipeline for display purposes.
    const effectiveOperations = useMemo(() => {
        if (activeTab === 'crop') {
            return {
                ...operations,
                transform: {
                    ...operations.transform,
                    crop: undefined // Disable crop in pipeline while editing crop
                }
            };
        }
        return operations;
    }, [operations, activeTab]);

    // -- PIPELINE EXECUTION --
    useEffect(() => {
        let active = true;

        const runPipeline = async () => {
            if (!sourceBitmap) {
                if (active) setPipelineImg(null);
                return;
            }

            try {
                // Use effectiveOperations
                const { output, cache } = await buildPipeline(sourceBitmap, effectiveOperations, pipelineCache);

                if (active) {
                    setPipelineImg(output);

                    if (cache !== pipelineCache) {
                        useImageStudioStore.getState().pipelineCache = cache;
                    }
                }
            } catch (err) {
                console.error("Pipeline failed:", err);
            }
        };

        runPipeline();

        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceBitmap, effectiveOperations]); // Remove pipelineCache from deps to avoids loops if we mutate it.

    // Choose which image to display
    const img = (pipelineImg as HTMLImageElement);

    // Check if we are showing the pipeline result directly
    const showingPipeline = !!pipelineImg;

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

        // If rotated 90deg, the image's height becomes its width in the container
        const isRotated = (params.rotation / 90) % 2 !== 0;

        let effectiveIW = img.width;
        let effectiveIH = img.height;

        if (!showingPipeline && isRotated) {
            effectiveIW = img.height;
            effectiveIH = img.width;
        }

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

                const effectiveCropW = (!showingPipeline && isRotated) ? cropH : cropW;
                const effectiveCropH = (!showingPipeline && isRotated) ? cropW : cropH;

                const cropScaleW = (availW * 0.85) / effectiveCropW;
                const cropScaleH = (availH * 0.85) / effectiveCropH;
                const cropScale = Math.min(cropScaleW, cropScaleH);

                // Limit zoom to reasonable bounds (1x to 4x of base scale)
                const maxZoom = baseScale * 4;
                const minZoom = baseScale;
                smartScale = Math.max(minZoom, Math.min(cropScale, maxZoom));

                // Calculate offset to center the crop area
                const cropCenterX = params.crop.x + cropW / 2;
                const cropCenterY = params.crop.y + cropH / 2;

                const imageCenterX = img.width / 2;
                const imageCenterY = img.height / 2;

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
            x: (width - visualW) / 2,
            y: (height - visualH) / 2,
            stageCenterX: width / 2,
            stageCenterY: height / 2,
            offsetX,
            offsetY,
            smartZoomActive
        };
    }, [img, width, height, params.rotation, activeTab, params.crop, showingPipeline]);

    // Apply Crop Overlay
    useEffect(() => {
        if (activeTab === 'crop') {
            // Auto-initialize crop if valid image
            if (!params.crop && img) {
                setParam('crop', { x: 0, y: 0, width: img.width, height: img.height });
            }

            if (transformerRef.current && cropRectRef.current) {
                transformerRef.current.nodes([]);
                transformerRef.current.nodes([cropRectRef.current]);
                transformerRef.current.getLayer()?.batchDraw();
            }
        }
    }, [activeTab, params.crop, img, setParam]);



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
                    rotation={showingPipeline ? 0 : params.rotation}
                    fillPatternRepeat="repeat"
                    opacity={0.5}
                />

                <Group
                    x={displayDims.stageCenterX + displayDims.offsetX}
                    y={displayDims.stageCenterY + displayDims.offsetY}
                    offsetX={displayDims.width / 2}
                    offsetY={displayDims.height / 2}
                    rotation={showingPipeline ? 0 : params.rotation}
                    scaleX={showingPipeline ? 1 : (params.flipX ? -1 : 1)}
                    scaleY={showingPipeline ? 1 : (params.flipY ? -1 : 1)}
                    clipFunc={
                        (activeTab !== 'crop' && params.cropShape && params.cropShape !== 'rect')
                            ? (ctx) => {
                                const w = displayDims.width;
                                const h = displayDims.height;

                                ctx.beginPath();
                                if (params.cropShape === 'circle') {
                                    const rx = w / 2;
                                    const ry = h / 2;
                                    ctx.ellipse(w / 2, h / 2, rx, ry, 0, 0, Math.PI * 2);
                                } else if (params.cropShape === 'heart') {
                                    const x = 0, y = 0;
                                    ctx.moveTo(x + w / 2, y + h);
                                    ctx.bezierCurveTo(x, y + h * 0.6, x, y, x + w / 2, y + h * 0.3);
                                    ctx.bezierCurveTo(x + w, y, x + w, y + h * 0.6, x + w / 2, y + h);
                                }
                                ctx.closePath();
                            }
                            : undefined
                    }
                >
                    <KonvaImage
                        ref={imageRef}
                        image={img}
                        width={displayDims.width}
                        height={displayDims.height}
                    />
                </Group>

                {/* Crop Overlay */}
                {activeTab === 'crop' && (
                    <>
                        <Group
                            x={displayDims.stageCenterX + displayDims.offsetX}
                            y={displayDims.stageCenterY + displayDims.offsetY}
                            offsetX={displayDims.width / 2}
                            offsetY={displayDims.height / 2}
                            rotation={showingPipeline ? 0 : params.rotation}
                            scaleX={showingPipeline ? 1 : (params.flipX ? -1 : 1)}
                            scaleY={showingPipeline ? 1 : (params.flipY ? -1 : 1)}
                        >
                            {/* Dark Tint Overlay with Hole */}
                            <Path
                                data={(() => {
                                    // Outer Rectangle (Full Image)
                                    const outer = `M 0 0 H ${displayDims.width} V ${displayDims.height} H 0 Z`;

                                    // Inner Hole (The visible crop part)
                                    const cx = params.crop ? params.crop.x * displayDims.scale : 0;
                                    const cy = params.crop ? params.crop.y * displayDims.scale : 0;
                                    const cw = params.crop ? params.crop.width * displayDims.scale : displayDims.width;
                                    const ch = params.crop ? params.crop.height * displayDims.scale : displayDims.height;
                                    const shape = params.cropShape || 'rect';

                                    let inner = "";

                                    if (shape === 'circle') {
                                        const rx = cw / 2;
                                        const ry = ch / 2;
                                        const centX = cx + rx;
                                        const centY = cy + ry;
                                        inner = `M ${centX - rx} ${centY} A ${rx} ${ry} 0 1 0 ${centX + rx} ${centY} A ${rx} ${ry} 0 1 0 ${centX - rx} ${centY}`;
                                    } else if (shape === 'heart') {
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
                                fillRule="evenodd"
                                listening={false}
                            />

                            <Rect
                                ref={cropRectRef}
                                x={params.crop ? params.crop.x * displayDims.scale : 0}
                                y={params.crop ? params.crop.y * displayDims.scale : 0}
                                width={params.crop ? params.crop.width * displayDims.scale : displayDims.width}
                                height={params.crop ? params.crop.height * displayDims.scale : displayDims.height}
                                stroke="white"
                                strokeWidth={2 / displayDims.scale}
                                dash={[10, 5]}
                                draggable
                                dragBoundFunc={(pos) => {
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
        </Stage >
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
