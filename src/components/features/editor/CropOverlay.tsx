import React, { useEffect, useRef, useState } from 'react';
import { Group, Rect, Line, Image as KonvaImage, Text } from 'react-konva';
import { useEditorStore } from '../../../store/editorStore';
import Konva from 'konva';

interface CropOverlayProps {
    objectId: string;
}

export const CropOverlay: React.FC<CropOverlayProps> = ({ objectId }) => {
    const { currentPage, updateObject, scale: stageScale, setCropping } = useEditorStore();
    const object = currentPage?.objects.find(o => o.id === objectId);

    const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        if (object?.src) {
            const img = new Image();
            img.src = object.src;
            img.onload = () => setImageElement(img);
        }
    }, [object?.src]);

    if (!object || !imageElement || object.type !== 'image') return null;

    const naturalWidth = imageElement.naturalWidth;
    const naturalHeight = imageElement.naturalHeight;

    // Current crop or full image
    const crop = object.crop || { x: 0, y: 0, width: naturalWidth, height: naturalHeight };

    // Scale from "Source Pixels" to "Stage Pixels"
    const displayScaleX = (object.width || naturalWidth) / crop.width;
    const displayScaleY = (object.height || naturalHeight) / crop.height;

    // Full image bounds in stage coordinates
    const fullStageWidth = naturalWidth * displayScaleX;
    const fullStageHeight = naturalHeight * displayScaleY;

    // The object's x/y is the top-left of the CROPPED area.
    // We need to find the top-left of the FULL image.
    const fullStageX = object.x - (crop.x * displayScaleX);
    const fullStageY = object.y - (crop.y * displayScaleY);

    const updateCrop = (newCrop: typeof crop) => {
        // Constrain to source image bounds
        const constrained = {
            x: Math.max(0, Math.min(newCrop.x, naturalWidth - 10)),
            y: Math.max(0, Math.min(newCrop.y, naturalHeight - 10)),
            width: Math.max(10, Math.min(newCrop.width, naturalWidth - newCrop.x)),
            height: Math.max(10, Math.min(newCrop.height, naturalHeight - newCrop.y))
        };

        // When we move the top-left of the crop (x, y), 
        // the object's stage position must also move to keep visual consistency.
        const dx = (constrained.x - crop.x) * displayScaleX;
        const dy = (constrained.y - crop.y) * displayScaleY;

        updateObject(objectId, {
            crop: constrained,
            x: object.x + dx,
            y: object.y + dy,
            width: constrained.width * displayScaleX,
            height: constrained.height * displayScaleY
        });
    };

    const handleSize = 12 / stageScale;
    const color = '#3b82f6';

    const renderHandle = (x: number, y: number, cursor: string, onDrag: (dx: number, dy: number) => void) => (
        <Rect
            x={x}
            y={y}
            width={handleSize}
            height={handleSize}
            offsetX={handleSize / 2}
            offsetY={handleSize / 2}
            fill="white"
            stroke={color}
            strokeWidth={2 / stageScale}
            draggable
            onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = cursor;
            }}
            onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'default';
            }}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={(e) => {
                setIsDragging(false);
                e.target.position({ x, y });
            }}
            onDragMove={(e) => {
                const dx = e.target.x() - x;
                const dy = e.target.y() - y;
                onDrag(dx, dy);
                e.target.position({ x, y });
            }}
        />
    );

    // To match PDFObjectRenderer's center-based rotation:
    const centerX = object.x + object.width! / 2;
    const centerY = object.y + object.height! / 2;
    const offsetX = object.width! / 2;
    const offsetY = object.height! / 2;

    // Inside this group (assuming x=centerX, y=centerY, offsetX=offsetX, offsetY=offsetY),
    // (0,0) is the top-left of the CROPPED area.

    // Top-left of the FULL image relative to the group's (0,0):
    const fullImgX = -(crop.x * displayScaleX);
    const fullImgY = -(crop.y * displayScaleY);

    return (
        <Group x={centerX} y={centerY} offsetX={offsetX} offsetY={offsetY} rotation={object.rotation}>
            {/* 1. Full Image Ghost (Dimmed) */}
            <KonvaImage
                x={fullImgX}
                y={fullImgY}
                image={imageElement}
                width={fullStageWidth}
                height={fullStageHeight}
                opacity={0.3}
            />

            {/* 2. Dark Overlay for outside crop area (4 rects) */}
            <Group x={fullImgX} y={fullImgY}>
                <Rect width={fullStageWidth} x={0} y={0} height={crop.y * displayScaleY} fill="black" opacity={0.5} />
                <Rect width={fullStageWidth} x={0} y={(crop.y + crop.height) * displayScaleY} height={fullStageHeight - (crop.y + crop.height) * displayScaleY} fill="black" opacity={0.5} />
                <Rect width={crop.x * displayScaleX} x={0} y={crop.y * displayScaleY} height={crop.height * displayScaleY} fill="black" opacity={0.5} />
                <Rect width={fullStageWidth - (crop.x + crop.width) * displayScaleX} x={(crop.x + crop.width) * displayScaleX} y={crop.y * displayScaleY} height={crop.height * displayScaleY} fill="black" opacity={0.5} />
            </Group>

            {/* 3. The Active Crop Area */}
            <Group x={0} y={0}>
                {/* Border */}
                <Rect
                    width={object.width}
                    height={object.height}
                    stroke={color}
                    strokeWidth={2 / stageScale}
                    dash={[4, 4]}
                />

                {/* Corner Handles */}
                {renderHandle(0, 0, 'nw-resize', (dx, dy) => {
                    const dcx = dx / displayScaleX;
                    const dcy = dy / displayScaleY;
                    updateCrop({
                        x: crop.x + dcx,
                        y: crop.y + dcy,
                        width: crop.width - dcx,
                        height: crop.height - dcy
                    });
                })}
                {renderHandle(object.width!, 0, 'ne-resize', (dx, dy) => {
                    const dcw = dx / displayScaleX;
                    const dcy = dy / displayScaleY;
                    updateCrop({
                        x: crop.x,
                        y: crop.y + dcy,
                        width: crop.width + dcw,
                        height: crop.height - dcy
                    });
                })}
                {renderHandle(object.width!, object.height!, 'se-resize', (dx, dy) => {
                    const dcw = dx / displayScaleX;
                    const dch = dy / displayScaleY;
                    updateCrop({
                        x: crop.x,
                        y: crop.y,
                        width: crop.width + dcw,
                        height: crop.height + dch
                    });
                })}
                {renderHandle(0, object.height!, 'sw-resize', (dx, dy) => {
                    const dcx = dx / displayScaleX;
                    const dch = dy / displayScaleY;
                    updateCrop({
                        x: crop.x + dcx,
                        y: crop.y,
                        width: crop.width - dcx,
                        height: crop.height + dch
                    });
                })}

                {/* Done Button Shadow / Indicator */}
                {!isDragging && (
                    <Group x={object.width! / 2} y={object.height! + 20 / stageScale}>
                        <Rect
                            width={80 / stageScale}
                            height={25 / stageScale}
                            fill="#3b82f6"
                            cornerRadius={4 / stageScale}
                            offsetX={40 / stageScale}
                            onClick={() => setCropping(false)}
                            onTap={() => setCropping(false)}
                        />
                        <Text
                            text="Confirm Crop"
                            fontSize={10 / stageScale}
                            fill="white"
                            align="center"
                            verticalAlign="middle"
                            width={80 / stageScale}
                            height={25 / stageScale}
                            offsetX={40 / stageScale}
                            pointerEvents="none"
                            fontStyle="bold"
                        />
                    </Group>
                )}
            </Group>
        </Group>
    );
};

