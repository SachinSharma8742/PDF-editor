import React, { useRef, useEffect } from 'react';
import { Text, Rect, Circle as KonvaCircle, Image as KonvaImage, Group, Line } from 'react-konva';
import { createPortal } from 'react-dom';
import useImage from 'use-image';
import type { PDFObject } from '../../../store/pdfStore';
import { useEditorStore } from '../../../store/editorStore';

interface PDFObjectRendererProps {
    object: PDFObject;
    isSelected: boolean;
    onSelect: (e: any) => void;
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
    const [isEditing, setIsEditing] = React.useState(object.isNew);

    // Debug Log
    console.log(`[Renderer] ${object.id} (${object.type}) Opacity:`, object.opacity);


    // If it's a new text object, focus it immediately
    useEffect(() => {
        if (object.type === 'text' && object.isNew && !isEditing) {
            setIsEditing(true);
            onChange({ isNew: false });
        }
    }, [object.isNew, object.type, isEditing, onChange]);

    const handleTextDblClick = () => {
        if (object.type === 'text' && !isLocked) {
            setIsEditing(true);
        }
    };

    const handleTextBlur = (newText: string) => {
        setIsEditing(false);
        onChange({ text: newText });
    };

    const handleTextKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.currentTarget.blur();
        }
        if (e.key === 'Escape') {
            setIsEditing(false);
        }
    };

    // Calculate bounds logic
    const { minX, minY, calculatedWidth, calculatedHeight, isLegacyPath } = React.useMemo(() => {
        if (object.type !== 'path' || !object.points) {
            return { minX: 0, minY: 0, calculatedWidth: 0, calculatedHeight: 0, isLegacyPath: false };
        }
        const isLegacy = !object.width || object.width === 0;
        const xs = object.points.filter((_, i) => i % 2 === 0);
        const ys = object.points.filter((_, i) => i % 2 === 1);
        if (xs.length === 0) return { minX: 0, minY: 0, calculatedWidth: 0, calculatedHeight: 0, isLegacyPath: false };
        const mx = Math.min(...xs);
        const my = Math.min(...ys);
        return {
            minX: mx, minY: my,
            calculatedWidth: Math.max(...xs) - mx,
            calculatedHeight: Math.max(...ys) - my,
            isLegacyPath: isLegacy
        };
    }, [object.points, object.type, object.width]);

    const width = object.width || calculatedWidth;
    const height = object.height || calculatedHeight;

    let x = object.x;
    let y = object.y;
    let innerX = 0;
    let innerY = 0;

    if (isLegacyPath) {
        x = (object.x === undefined || object.x === 0) ? minX : object.x;
        y = (object.y === undefined || object.y === 0) ? minY : object.y;
        innerX = -minX;
        innerY = -minY;
    }

    const containerProps = {
        id: object.id,
        x: x,
        y: y,
        width: width,
        height: height,
        rotation: object.rotation || 0,
        // opacity: object.opacity ?? 1, <--- Removed from Group to avoid issues, applying to children directly
        draggable: isSelectionEnabled && !isLocked && !isEditing,
        listening: isSelectionEnabled,
        onClick: (e: any) => { if (isSelectionEnabled) onSelect(e); },
        onDblClick: handleTextDblClick,
        onTap: (e: any) => { if (isSelectionEnabled) onSelect(e); },
        onDblTap: handleTextDblClick,
        onContextMenu: (e: any) => {
            if (isSelectionEnabled) {
                e.evt.preventDefault(); // Stop Browser Menu immediately
                // Tag the event so global listener knows we hit an object
                e.evt._pdfEditorHit = 'object';
                onSelect(e);
            }
        },
        onMouseEnter: (e: any) => {
            if (isSelectionEnabled && !isLocked) {
                e.target.getStage().container().style.cursor = object.type === 'text' ? 'text' : 'move';
            }
        },
        onMouseLeave: (e: any) => {
            e.target.getStage().container().style.cursor = 'default';
        },
    };

    const innerProps = { width, height, x: 0, y: 0 };

    return (
        <Group {...containerProps} ref={groupRef}>
            {object.type === 'text' && (
                <>
                    <Text
                        {...innerProps}
                        text={isEditing ? '' : (object.text || " ")}
                        fontSize={object.fontSize || 16}
                        fontFamily={object.fontFamily || 'Arial'}
                        fill={object.fill || 'black'}
                        fontWeight={object.fontWeight}
                        fontStyle={object.fontStyle}
                        textDecoration={object.fontStyle?.includes('underline') ? 'underline' : ''}
                        align={object.align || 'left'}
                        verticalAlign="middle"
                        opacity={object.opacity ?? 1}
                        visible={!isEditing}
                    />
                    {isEditing && (
                        <TextEditorOverlay
                            object={object}
                            onBlur={handleTextBlur}
                            onKeyDown={handleTextKeyDown}
                        />
                    )}
                </>
            )}

            {object.type === 'rectangle' && (
                <Rect
                    {...innerProps}
                    stroke={object.stroke || 'black'}
                    strokeWidth={object.strokeWidth || 2}
                    fill={object.fill || 'transparent'}
                    cornerRadius={5}
                    opacity={object.opacity ?? 1}
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
                    opacity={object.opacity ?? 1}
                />
            )}

            {object.type === 'image' && <URLImage {...innerProps} object={object} opacity={object.opacity ?? 1} />}

            {object.type === 'path' && object.points && (
                <Line
                    points={object.points}
                    stroke={object.stroke || 'black'}
                    strokeWidth={object.strokeWidth || 2}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                    x={innerX}
                    y={innerY}
                    fill="transparent"
                />
            )}
        </Group>
    );
};

// --- Text Editor Overlay ---
const TextEditorOverlay: React.FC<{
    object: PDFObject;
    onBlur: (text: string) => void;
    onKeyDown: (e: any) => void;
}> = ({ object, onBlur, onKeyDown }) => {
    const { scale } = useEditorStore();
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const [val, setVal] = React.useState(object.text || '');

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(val.length, val.length);
        }
    }, []);

    const parentContainer = document.getElementById('editor-workspace');
    if (!parentContainer) return null;

    const top = object.y * scale;
    const left = object.x * scale;
    const width = (object.width || 200) * scale;
    const height = (object.height || 100) * scale;

    const style: React.CSSProperties = {
        position: 'absolute',
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        height: `${height}px`,
        fontSize: `${(object.fontSize || 16) * scale}px`,
        fontFamily: object.fontFamily || 'Arial',
        fontWeight: object.fontWeight as any,
        fontStyle: object.fontStyle as any,
        color: object.fill || 'black',
        textAlign: object.align || 'left',
        background: 'transparent',
        border: '1px dashed #3b82f6',
        outline: 'none',
        resize: 'none',
        overflow: 'hidden',
        padding: '0',
        margin: '0',
        lineHeight: '1.2',
        zIndex: 200,
        transform: `rotate(${object.rotation || 0}deg)`,
        transformOrigin: '0 0'
    };

    return createPortal(
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none'
        }}>
            <textarea
                ref={textareaRef}
                style={{ ...style, pointerEvents: 'auto' }}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onBlur={() => onBlur(val)}
                onKeyDown={onKeyDown}
            />
        </div>,
        parentContainer
    );
};
