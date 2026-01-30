import React, { useRef, useEffect } from 'react';
import { Text, Rect, Circle as KonvaCircle, Image as KonvaImage, Transformer, Group } from 'react-konva';
import useImage from 'use-image';
import type { PDFObject } from '../../../store/pdfStore';

interface PDFObjectRendererProps {
    object: PDFObject;
    isSelected: boolean;
    onSelect: () => void;
    onChange: (newAttrs: Partial<PDFObject>) => void;
    isLocked?: boolean;
    isSelectionEnabled?: boolean;
}

const URLImage = ({ object, ...props }: any) => {
    const [img] = useImage(object.src || '');
    return <KonvaImage image={img} {...props} />;
};

export const PDFObjectRenderer: React.FC<PDFObjectRendererProps> = ({
    object,
    isSelected,
    onSelect,
    onChange,
    isLocked,
    isSelectionEnabled = true
}) => {
    const groupRef = useRef<any>(null);
    const trRef = useRef<any>(null);
    const [liveRotation, setLiveRotation] = React.useState(object.rotation || 0);
    const [isDraggingNode, setIsDraggingNode] = React.useState(false);

    // Update live rotation when object orientation changes
    useEffect(() => {
        setLiveRotation(object.rotation || 0);
    }, [object.rotation]);

    // Sync Transformer
    useEffect(() => {
        if (isSelected && trRef.current && groupRef.current) {
            trRef.current.nodes([groupRef.current]);
            trRef.current.getLayer().batchDraw();
        }
    }, [isSelected]);

    const width = object.width || 0;
    const height = object.height || 0;
    const centerX = object.x + width / 2;
    const centerY = object.y + height / 2;

    const currentRotation = isSelected ? liveRotation : (object.rotation || 0);

    const handleDragStart = (e: any) => {
        if (e.target === groupRef.current) {
            e.target.getStage().container().style.cursor = 'grabbing';
            setIsDraggingNode(true);
        }
    };

    const handleDragEnd = (e: any) => {
        const node = e.target;
        if (node === groupRef.current) {
            setIsDraggingNode(false);
            // Compensate for center-origin mapping
            onChange({
                x: node.x() - width / 2,
                y: node.y() - height / 2,
            });
        }
    };

    const handleTransformEnd = (e: any) => {
        const node = groupRef.current;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();

        node.scaleX(1);
        node.scaleY(1);

        const newWidth = Math.max(5, width * scaleX);
        const newHeight = Math.max(5, height * scaleY);

        const updates: Partial<PDFObject> = {
            x: node.x() - newWidth / 2,
            y: node.y() - newHeight / 2,
            width: newWidth,
            height: newHeight,
            rotation: node.rotation(),
        };

        if (object.type === 'path' && object.points) {
            // Scale points to match new dimensions
            // Note: points are [x1, y1, x2, y2, ...]
            // Since we normalized points to be within [0, width] and [0, height],
            // we can just multiply by the scale factor.
            updates.points = object.points.map((val, i) => {
                return i % 2 === 0 ? val * scaleX : val * scaleY;
            });
        }

        onChange(updates);
        setLiveRotation(node.rotation());
    };

    // Common props for the Group (the container that gets transformed)
    const containerProps = {
        id: object.id,
        x: centerX,
        y: centerY,
        width: width,
        height: height,
        rotation: currentRotation,
        offsetX: width / 2,
        offsetY: height / 2,
        draggable: isSelectionEnabled && !isLocked,
        listening: isSelectionEnabled,
        onClick: isSelectionEnabled ? onSelect : undefined,
        onTap: isSelectionEnabled ? onSelect : undefined,
        onDragStart: handleDragStart,
        onDragEnd: handleDragEnd,
        onMouseEnter: (e: any) => {
            if (isSelectionEnabled && !isLocked) {
                e.target.getStage().container().style.cursor = 'grab';
            }
        },
        onMouseLeave: (e: any) => {
            e.target.getStage().container().style.cursor = 'default';
        },
    };

    // Inner shapes need the ID for hit-testing in Element Eraser
    const innerProps = {
        id: object.id,
        x: 0,
        y: 0,
        width: width,
        height: height,
    };

    return (
        <>
            <Group {...containerProps} ref={groupRef} onTransformEnd={handleTransformEnd}>
                {object.type === 'text' && (
                    <Text
                        {...innerProps}
                        text={object.text}
                        fontSize={object.fontSize || 16}
                        fontFamily={object.fontFamily || 'Arial'}
                        fill={object.fill || 'black'}
                        fontWeight={object.fontWeight}
                        fontStyle={object.fontStyle}
                        textDecoration={object.fontStyle?.includes('underline') ? 'underline' : ''}
                        align={object.align || 'left'}
                    />
                )}
                {/* ... other types stay same ... */}
                {object.type === 'rectangle' && (
                    <Rect
                        {...innerProps}
                        stroke={object.stroke || 'black'}
                        strokeWidth={object.strokeWidth || 2}
                        fill={object.fill || 'transparent'}
                        cornerRadius={5}
                    />
                )}
                {object.type === 'circle' && (
                    <KonvaCircle
                        {...innerProps}
                        x={width / 2}
                        y={height / 2}
                        radius={Math.max(width, height) / 2}
                        stroke={object.stroke || 'black'}
                        strokeWidth={object.strokeWidth || 2}
                        fill={object.fill || 'transparent'}
                    />
                )}
                {object.type === 'image' && (
                    <URLImage
                        {...innerProps}
                        object={object}
                    />
                )}
            </Group>

            {isSelected && (
                <>
                    <Transformer
                        ref={trRef}
                        anchorCornerRadius={999}
                        anchorSize={8}
                        anchorFill="#3b82f6"
                        anchorStroke="#ffffff"
                        anchorStrokeWidth={1.5}
                        borderStroke="#3b82f6"
                        borderStrokeWidth={1}
                        borderDash={[6, 3]}
                        rotateEnabled={false}
                        keepRatio={false}
                        enabledAnchors={['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']}
                        boundBoxFunc={(oldBox, newBox) => {
                            if (newBox.width < 5 || newBox.height < 5) return oldBox;
                            return newBox;
                        }}
                    />

                    {/* CUSTOM ROTATION HANDLE - Hidden while dragging parent */}
                    {!isDraggingNode && (() => {
                        const node = groupRef.current;
                        if (!node) return null;

                        const rotation = liveRotation;
                        const rad = (rotation - 90) * (Math.PI / 180);
                        const dist = (height / 2) + 40;

                        const handleX = node.x() + dist * Math.cos(rad);
                        const handleY = node.y() + dist * Math.sin(rad);

                        return (
                            <Group
                                x={handleX}
                                y={handleY}
                                rotation={rotation}
                                draggable
                                onDragStart={(e) => {
                                    e.target.getStage()!.container().style.cursor = 'grabbing';
                                }}
                                onDragMove={(e) => {
                                    const stage = e.target.getStage()!;
                                    const pointer = stage.getPointerPosition();
                                    if (!pointer) return;

                                    // Use current node center for target rotation
                                    const dx = pointer.x - node.x();
                                    const dy = pointer.y - node.y();
                                    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;

                                    if (angle < 0) angle += 360;
                                    const snaps = [0, 45, 90, 135, 180, 225, 270, 315];
                                    for (const snap of snaps) {
                                        if (Math.abs(angle - snap) < 5) {
                                            angle = snap;
                                            break;
                                        }
                                    }

                                    node.rotation(angle);
                                    setLiveRotation(angle);
                                    node.getLayer()?.batchDraw();
                                }}
                                onDragEnd={(e) => {
                                    e.target.getStage()!.container().style.cursor = 'grab';
                                    onChange({ rotation: node.rotation() });
                                }}
                            >
                                <KonvaCircle
                                    radius={12}
                                    fill="white"
                                    stroke="#3b82f6"
                                    strokeWidth={1.5}
                                    shadowColor="rgba(0,0,0,0.2)"
                                    shadowBlur={4}
                                />
                                <Text
                                    text="↻"
                                    fontSize={16}
                                    x={-7}
                                    y={-9}
                                    fill="#3b82f6"
                                    fontStyle="bold"
                                />
                            </Group>
                        );
                    })()}
                </>
            )}
        </>
    );
};
