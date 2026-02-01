import React, { useRef, useEffect, useState } from 'react';
import { Group, Circle, Rect, Line, Arc, Path } from 'react-konva';
import Konva from 'konva';

interface AntiGravityTransformerProps {
    node: Konva.Node | null;
    isSelected: boolean;
    onChange: (attrs: any) => void;
}

/**
 * AntiGravityTransformer - A custom ultra-minimal selection box with:
 * - 6px circular floating handles with shadow
 * - Semi-transparent adaptive border (30% opacity, full on transform)
 * - Dedicated rotation handle with icon above top-center
 * - Large 20px invisible hit areas
 * - Hover scale animations, hide handles during drag
 */
export const AntiGravityTransformer: React.FC<AntiGravityTransformerProps> = ({
    node,
    isSelected,
    onChange,
}) => {
    const groupRef = useRef<Konva.Group>(null);
    const [hoveredHandle, setHoveredHandle] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isTransforming, setIsTransforming] = useState(false);
    const [isRotating, setIsRotating] = useState(false);
    const [rotationStartAngle, setRotationStartAngle] = useState(0);
    const [initialRotation, setInitialRotation] = useState(0);
    const [box, setBox] = useState({ x: 0, y: 0, width: 0, height: 0, rotation: 0 });

    // Sync box with node
    useEffect(() => {
        if (!node || !isSelected) return;

        const updateBox = () => {
            setBox({
                x: node.x(),
                y: node.y(),
                width: node.width() * node.scaleX(),
                height: node.height() * node.scaleY(),
                rotation: node.rotation() || 0,
            });
        };

        updateBox();

        // Listen to node changes
        node.on('dragmove transform', updateBox);
        return () => {
            node.off('dragmove transform', updateBox);
        };
    }, [node, isSelected]);

    if (!isSelected || !node) return null;

    const { x, y, width, height, rotation } = box;

    // Visual properties
    const HANDLE_SIZE = 6;
    const HIT_AREA_SIZE = 20;
    const ROTATION_HANDLE_OFFSET = 30; // Distance above the box
    const borderOpacity = isTransforming ? 1 : 0.3;

    // Handle positions (8 corners/edges)
    const handles = [
        { id: 'tl', cx: 0, cy: 0, cursor: 'nwse-resize' },
        { id: 'tm', cx: width / 2, cy: 0, cursor: 'ns-resize' },
        { id: 'tr', cx: width, cy: 0, cursor: 'nesw-resize' },
        { id: 'ml', cx: 0, cy: height / 2, cursor: 'ew-resize' },
        { id: 'mr', cx: width, cy: height / 2, cursor: 'ew-resize' },
        { id: 'bl', cx: 0, cy: height, cursor: 'nesw-resize' },
        { id: 'bm', cx: width / 2, cy: height, cursor: 'ns-resize' },
        { id: 'br', cx: width, cy: height, cursor: 'nwse-resize' },
    ];

    // Resize handle functions
    const handleDragStart = (handleId: string, e: Konva.KonvaEventObject<DragEvent>) => {
        setIsDragging(true);
        setIsTransforming(true);
    };

    const handleDrag = (handleId: string, e: Konva.KonvaEventObject<DragEvent>) => {
        if (!node) return;

        const pointer = e.target.getStage()?.getPointerPosition();
        if (!pointer) return;

        // Calculate new dimensions based on which handle is being dragged
        let newX = x, newY = y, newW = width, newH = height;

        switch (handleId) {
            case 'br':
                newW = pointer.x - x;
                newH = pointer.y - y;
                break;
            case 'tr':
                newW = pointer.x - x;
                newY = pointer.y;
                newH = y + height - pointer.y;
                break;
            case 'bl':
                newX = pointer.x;
                newW = x + width - pointer.x;
                newH = pointer.y - y;
                break;
            case 'tl':
                newX = pointer.x;
                newY = pointer.y;
                newW = x + width - pointer.x;
                newH = y + height - pointer.y;
                break;
        }

        if (newW > 5 && newH > 5) {
            node.x(newX);
            node.y(newY);
            node.width(newW / node.scaleX());
            node.height(newH / node.scaleY());
            node.getLayer()?.batchDraw();
        }
    };

    const handleDragEnd = (handleId: string) => {
        setIsDragging(false);
        setIsTransforming(false);

        if (!node) return;
        onChange({
            x: node.x(),
            y: node.y(),
            width: node.width() * node.scaleX(),
            height: node.height() * node.scaleY(),
            rotation: node.rotation(),
        });
    };

    // Rotation handle functions
    const handleRotationStart = (e: Konva.KonvaEventObject<MouseEvent>) => {
        e.cancelBubble = true;
        setIsRotating(true);
        setIsTransforming(true);

        const stage = e.target.getStage();
        if (!stage || !node) return;

        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        // Calculate center of the object
        const centerX = x + width / 2;
        const centerY = y + height / 2;

        // Calculate initial angle from center to pointer
        const startAngle = Math.atan2(pointer.y - centerY, pointer.x - centerX) * (180 / Math.PI);
        setRotationStartAngle(startAngle);
        setInitialRotation(node.rotation() || 0);
    };

    const handleRotationMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (!isRotating || !node) return;

        const stage = e.target.getStage();
        if (!stage) return;

        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        // Calculate center of the object
        const centerX = x + width / 2;
        const centerY = y + height / 2;

        // Calculate current angle from center to pointer
        const currentAngle = Math.atan2(pointer.y - centerY, pointer.x - centerX) * (180 / Math.PI);

        // Calculate rotation delta
        const rotationDelta = currentAngle - rotationStartAngle;

        // Apply rotation
        const newRotation = initialRotation + rotationDelta;
        node.rotation(newRotation);
        node.getLayer()?.batchDraw();

        setBox(prev => ({ ...prev, rotation: newRotation }));
    };

    const handleRotationEnd = () => {
        setIsRotating(false);
        setIsTransforming(false);

        if (!node) return;
        onChange({
            x: node.x(),
            y: node.y(),
            width: node.width() * node.scaleX(),
            height: node.height() * node.scaleY(),
            rotation: node.rotation(),
        });
    };

    const isRotationHovered = hoveredHandle === 'rotation';

    return (
        <Group
            ref={groupRef}
            x={x}
            y={y}
            rotation={rotation}
            onMouseMove={handleRotationMove}
            onMouseUp={handleRotationEnd}
        >
            {/* Adaptive Border - Semi-transparent unless transforming */}
            <Rect
                x={0}
                y={0}
                width={width}
                height={height}
                stroke="#60a5fa"
                strokeWidth={0.5}
                opacity={borderOpacity}
                listening={false}
            />

            {/* Rotation Handle Line - connects top center to rotation handle */}
            <Line
                points={[width / 2, 0, width / 2, -ROTATION_HANDLE_OFFSET]}
                stroke="#60a5fa"
                strokeWidth={1}
                opacity={borderOpacity}
                listening={false}
            />

            {/* Rotation Handle - Hit Area */}
            <Circle
                x={width / 2}
                y={-ROTATION_HANDLE_OFFSET}
                radius={HIT_AREA_SIZE / 2}
                fill="transparent"
                onMouseEnter={(e) => {
                    setHoveredHandle('rotation');
                    e.target.getStage()!.container().style.cursor = 'grab';
                }}
                onMouseLeave={(e) => {
                    if (!isRotating) {
                        setHoveredHandle(null);
                        e.target.getStage()!.container().style.cursor = 'default';
                    }
                }}
                onMouseDown={handleRotationStart}
            />

            {/* Rotation Handle - Visible Circle with Rotation Icon */}
            <Circle
                x={width / 2}
                y={-ROTATION_HANDLE_OFFSET}
                radius={isRotationHovered ? 10 : 8}
                fill={isRotationHovered ? "#3b82f6" : "#60a5fa"}
                stroke="#ffffff"
                strokeWidth={1.5}
                shadowColor="rgba(0,0,0,0.25)"
                shadowBlur={4}
                shadowOffsetY={2}
                listening={false}
            />

            {/* Rotation Icon - SVG Path for rotation arrow */}
            <Path
                x={width / 2 - 5}
                y={-ROTATION_HANDLE_OFFSET - 5}
                data="M 5 1 A 4 4 0 1 1 1 5 M 0 3 L 1 5 L 3 4"
                fill="transparent"
                stroke="#ffffff"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                listening={false}
                scaleX={1}
                scaleY={1}
            />

            {/* Resize Handles - Circular Floating Pips */}
            {handles.map((handle) => {
                const isHovered = hoveredHandle === handle.id;
                const isVisible = !isDragging || hoveredHandle === handle.id;

                if (!isVisible) return null;

                return (
                    <React.Fragment key={handle.id}>
                        {/* Invisible Large Hit Area */}
                        <Circle
                            x={handle.cx}
                            y={handle.cy}
                            radius={HIT_AREA_SIZE / 2}
                            fill="transparent"
                            onMouseEnter={(e) => {
                                setHoveredHandle(handle.id);
                                e.target.getStage()!.container().style.cursor = handle.cursor;
                            }}
                            onMouseLeave={(e) => {
                                setHoveredHandle(null);
                                e.target.getStage()!.container().style.cursor = 'default';
                            }}
                            draggable
                            onDragStart={(e) => handleDragStart(handle.id, e)}
                            onDragMove={(e) => handleDrag(handle.id, e)}
                            onDragEnd={() => handleDragEnd(handle.id)}
                        />

                        {/* Visible 6px Circular Pip with Shadow */}
                        <Circle
                            x={handle.cx}
                            y={handle.cy}
                            radius={isHovered ? HANDLE_SIZE * 1.2 / 2 : HANDLE_SIZE / 2}
                            fill="#60a5fa"
                            stroke="#ffffff"
                            strokeWidth={1.5}
                            shadowColor="rgba(0,0,0,0.25)"
                            shadowBlur={4}
                            shadowOffsetY={2}
                            listening={false}
                        />
                    </React.Fragment>
                );
            })}
        </Group>
    );
};
