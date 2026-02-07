import React, { useEffect, useState } from 'react';
import { Group, Rect, Image as KonvaImage, Path } from 'react-konva';
import { useEditorStore } from '../../../store/editorStore';
import { Html } from 'react-konva-utils';
import { Check, X } from 'lucide-react';

interface CropOverlayProps {
    objectId: string;
}

const HANDLE_SIZE = 10;
const OVERLAY_OPACITY = 0.5;

export const ImageCropOverlay: React.FC<CropOverlayProps> = ({ objectId }) => {
    const { currentPage, updateObject, scale: stageScale, setCropping, saveToHistory } = useEditorStore();
    const object = currentPage?.objects.find(o => o.id === objectId);

    const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        if (object?.src) {
            const img = new Image();
            img.src = object.src;
            img.crossOrigin = 'Anonymous';
            img.onload = () => setImageElement(img);
        }
    }, [object?.src]);

    if (!object || !imageElement || object.type !== 'image') return null;

    const naturalWidth = imageElement.naturalWidth;
    const naturalHeight = imageElement.naturalHeight;

    const crop = object.crop || { x: 0, y: 0, width: naturalWidth, height: naturalHeight };

    const displayScaleX = (object.width || naturalWidth) / crop.width;
    const displayScaleY = (object.height || naturalHeight) / crop.height;

    const fullStageWidth = naturalWidth * displayScaleX;
    const fullStageHeight = naturalHeight * displayScaleY;

    const centerX = object.x + object.width! / 2;
    const centerY = object.y + object.height! / 2;
    const offsetX = object.width! / 2;
    const offsetY = object.height! / 2;

    const fullImgX = -(crop.x * displayScaleX);
    const fullImgY = -(crop.y * displayScaleY);

    const updateCrop = (newCrop: typeof crop) => {
        const constrained = {
            x: Math.max(0, Math.min(newCrop.x, naturalWidth - 10)),
            y: Math.max(0, Math.min(newCrop.y, naturalHeight - 10)),
            width: Math.max(10, Math.min(newCrop.width, naturalWidth - newCrop.x)),
            height: Math.max(10, Math.min(newCrop.height, naturalHeight - newCrop.y))
        };

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

    const handleResize = (dx: number, dy: number, corner: string) => {
        let newX = crop.x;
        let newY = crop.y;
        let newW = crop.width;
        let newH = crop.height;

        const dcx = dx / displayScaleX;
        const dcy = dy / displayScaleY;

        if (corner === 'nw') {
            newX += dcx;
            newY += dcy;
            newW -= dcx;
            newH -= dcy;
        } else if (corner === 'ne') {
            newY += dcy;
            newW += dcx;
            newH -= dcy;
        } else if (corner === 'se') {
            newW += dcx;
            newH += dcy;
        } else if (corner === 'sw') {
            newX += dcx;
            newW -= dcx;
            newH += dcy;
        }

        updateCrop({
            x: newX,
            y: newY,
            width: newW,
            height: newH
        });
    };

    const renderHandle = (x: number, y: number, cursor: string, corner: string) => (
        <Rect
            x={x}
            y={y}
            width={HANDLE_SIZE / stageScale}
            height={HANDLE_SIZE / stageScale}
            offsetX={(HANDLE_SIZE / 2) / stageScale}
            offsetY={(HANDLE_SIZE / 2) / stageScale}
            fill="white"
            stroke="#3b82f6"
            strokeWidth={1.5 / stageScale}
            draggable
            onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = cursor;
            }}
            onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'default';
            }}
            onDragStart={() => {
                saveToHistory();
                setIsDragging(true);
            }}
            onDragEnd={() => setIsDragging(false)}
            onDragMove={(e) => {
                const dx = e.target.x() - x;
                const dy = e.target.y() - y;
                handleResize(dx, dy, corner);
                // Reset position to avoid "flying away" handles if update is slow, 
                // or rely on React prop updates. 
                // Resetting AFTER calculation is safer but might cause jitter.
                // For now, let's remove the forced reset to allow movement.
            }}
        />
    );

    return (
        <Group x={centerX} y={centerY} offsetX={offsetX} offsetY={offsetY} rotation={object.rotation}>
            {/* Ghost Image */}
            <KonvaImage
                x={fullImgX}
                y={fullImgY}
                image={imageElement}
                width={fullStageWidth}
                height={fullStageHeight}
                opacity={0.5}
            />

            {/* Dark Overlay Mask */}
            <Path
                x={fullImgX}
                y={fullImgY}
                fill="black"
                opacity={OVERLAY_OPACITY}
                fillRule="evenodd"
                data={(() => {
                    const outer = `M 0 0 L ${fullStageWidth} 0 L ${fullStageWidth} ${fullStageHeight} L 0 ${fullStageHeight} Z`;
                    const cx = crop.x * displayScaleX;
                    const cy = crop.y * displayScaleY;
                    const cw = crop.width * displayScaleX;
                    const ch = crop.height * displayScaleY;
                    let inner = `M ${cx} ${cy} L ${cx + cw} ${cy} L ${cx + cw} ${cy + ch} L ${cx} ${cy + ch} Z`;

                    const shape = object.cropShape || 'rect';

                    if (shape === 'circle') {
                        const rx = cw / 2;
                        const ry = ch / 2;
                        const centX = cx + rx;
                        const centY = cy + ry;
                        inner = `M ${centX - rx} ${centY} A ${rx} ${ry} 0 1 0 ${centX + rx} ${centY} A ${rx} ${ry} 0 1 0 ${centX - rx} ${centY}`;
                    } else if (shape === 'heart') {
                        const p0 = { x: cx + cw / 2, y: cy + ch };
                        inner = `M ${cx + cw / 2} ${cy + ch} ` +
                            `C ${cx} ${cy + ch * 0.6}, ${cx} ${cy}, ${cx + cw / 2} ${cy + ch * 0.3} ` +
                            `C ${cx + cw} ${cy}, ${cx + cw} ${cy + ch * 0.6}, ${cx + cw / 2} ${cy + ch} Z`;
                    }

                    return `${outer} ${inner}`;
                })()}
                listening={false}
            />

            {/* Crop Box */}
            <Group x={0} y={0}>
                <Rect
                    width={object.width}
                    height={object.height}
                    stroke="white"
                    strokeWidth={2 / stageScale}
                    listening={false}
                />
                <Path
                    data={`M ${object.width! / 3} 0 v ${object.height} M ${object.width! * 2 / 3} 0 v ${object.height} M 0 ${object.height! / 3} h ${object.width} M 0 ${object.height! * 2 / 3} h ${object.width}`}
                    stroke="white"
                    strokeWidth={1 / stageScale}
                    opacity={0.3}
                    listening={false}
                />

                {renderHandle(0, 0, 'nw-resize', 'nw')}
                {renderHandle(object.width!, 0, 'ne-resize', 'ne')}
                {renderHandle(object.width!, object.height!, 'se-resize', 'se')}
                {renderHandle(0, object.height!, 'sw-resize', 'sw')}
            </Group>

            {/* Simple Controls */}
            <Html groupProps={{ x: 0, y: object.height! + (10 / stageScale) }} divProps={{ style: { pointerEvents: 'none' } }}>
                <div style={{ transform: `scale(${1 / stageScale})`, transformOrigin: 'top left', pointerEvents: 'auto' }} className="flex gap-2">
                    <button
                        onClick={() => setCropping(false)}
                        className="p-2 rounded-full bg-white shadow-lg text-red-500 hover:bg-gray-100"
                    >
                        <X size={20} />
                    </button>
                    <button
                        onClick={() => setCropping(false)}
                        className="p-2 rounded-full bg-white shadow-lg text-green-500 hover:bg-gray-100"
                    >
                        <Check size={20} />
                    </button>
                </div>
            </Html>
        </Group>
    );
};
