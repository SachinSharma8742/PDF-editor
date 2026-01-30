import React, { useRef, useEffect, useState } from 'react';
import { Group, Circle, Rect, Line } from 'react-konva';
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
 * - Hidden rotation zones outside corners
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

    // Rotation zone positions (outside corners, 15px offset)
    const rotationZones = [
        { id: 'rot-tl', cx: -15, cy: -15 },
        { id: 'rot-tr', cx: width + 15, cy: -15 },
        { id: 'rot-bl', cx: -15, cy: height + 15 },
        { id: 'rot-br', cx: width + 15, cy: height + 15 },
    ];

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

        // This is a simplified implementation - full resize logic would be more complex
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
            // Add edge handle logic as needed
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

    // Visual properties
    const HANDLE_SIZE = 6;
    const HIT_AREA_SIZE = 20;
    const borderOpacity = isTransforming ? 1 : 0.3;

    return (
        <Group
            ref={groupRef}
            x={x}
            y={y}
            rotation={rotation}
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

            {/* Rotation Zones - Invisible hit areas outside corners */}
            {rotationZones.map((zone) => (
                <Circle
                    key={zone.id}
                    x={zone.cx}
                    y={zone.cy}
                    radius={15}
                    fill="transparent"
                    onMouseEnter={(e) => {
                        e.target.getStage()!.container().style.cursor = 'grab'; // Would be rotate cursor in prod
                    }}
                    onMouseLeave={(e) => {
                        e.target.getStage()!.container().style.cursor = 'default';
                    }}
                // Rotation drag logic would go here
                />
            ))}

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
                            listening={false} // The invisible hit area handles events
                        />
                    </React.Fragment>
                );
            })}
        </Group>
    );
};
