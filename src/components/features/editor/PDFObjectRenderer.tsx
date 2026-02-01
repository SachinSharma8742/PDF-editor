import React, { useRef, useEffect } from 'react';
import { Text, Rect, Circle as KonvaCircle, Image as KonvaImage, Group, Line, Arrow, RegularPolygon, Star as KonvaStar, Ellipse as KonvaEllipse } from 'react-konva';
import { createPortal } from 'react-dom';
import useImage from 'use-image';
import type { PDFObject } from '../../../store/pdfStore';
import { usePDFStore } from '../../../store/pdfStore';
import { useEditorStore } from '../../../store/editorStore';

interface PDFObjectRendererProps {
    object: PDFObject;
    isSelected: boolean;
    onSelect?: (e: any) => void;
    onChange?: (newAttrs: Partial<PDFObject>) => void;
    onDragStart?: (e: any) => void;
    onDragMove?: (e: any) => void;
    onDragEnd?: (e: any) => void;
    onTransformEnd?: (e: any) => void;
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
    onDragStart,
    onDragMove,
    onDragEnd,
    onTransformEnd,
    isLocked,
    isSelectionEnabled = true
}) => {
    const groupRef = useRef<any>(null);
    const [isEditing, setIsEditing] = React.useState(object.isNew);
    const { calibration } = usePDFStore();

    // Debug Log
    console.log(`[Renderer] ${object.id} (${object.type}) Opacity:`, object.opacity);


    // If it's a new text object, focus it immediately
    useEffect(() => {
        if (object.type === 'text' && object.isNew && !isEditing) {
            setIsEditing(true);
            onChange?.({ isNew: false });
        }
    }, [object.isNew, object.type, isEditing, onChange]);

    const handleTextDblClick = () => {
        if (object.type === 'text' && !isLocked) {
            setIsEditing(true);
        }
    };

    const handleTextBlur = (newText: string) => {
        setIsEditing(false);
        onChange?.({ text: newText });
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
        if (!['path', 'line', 'arrow', 'measure'].includes(object.type) || !object.points) {
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

    // Calculate center offset for center-based rotation
    const offsetX = width / 2;
    const offsetY = height / 2;

    const containerProps = {
        id: object.id,
        // Position is where the center of the object should be (after offset)
        x: x + offsetX,
        y: y + offsetY,
        width: width,
        height: height,
        // Offset moves the rotation/anchor point to the center
        offsetX: offsetX,
        offsetY: offsetY,
        rotation: object.rotation || 0,
        // Locked objects cannot be dragged
        draggable: isSelectionEnabled && !isLocked && !isEditing,
        // We MUST listen to events even if locked to show the 'not-allowed' cursor
        listening: isSelectionEnabled,
        onClick: (e: any) => {
            if (isSelectionEnabled && !isLocked) onSelect?.(e);
        },
        onDblClick: isLocked ? undefined : handleTextDblClick,
        onTap: (e: any) => {
            if (isSelectionEnabled && !isLocked) onSelect?.(e);
        },
        onDblTap: isLocked ? undefined : handleTextDblClick,
        onDragStart: isLocked ? undefined : onDragStart,
        onDragMove: isLocked ? undefined : onDragMove,
        onDragEnd: isLocked ? undefined : onDragEnd,
        onTransformEnd: isLocked ? undefined : onTransformEnd,
        onContextMenu: (e: any) => {
            // Locked objects don't show context menu for object actions
            if (isSelectionEnabled && !isLocked) {
                e.evt.preventDefault();
                e.evt._pdfEditorHit = 'object';
                onSelect?.(e);
                const { openContextMenu } = useEditorStore.getState();
                openContextMenu(e.evt.clientX, e.evt.clientY, 'object', { objectIds: [object.id] });
            }
        },
        onMouseEnter: (e: any) => {
            if (isSelectionEnabled) {
                if (isLocked) {
                    e.target.getStage().container().style.cursor = 'not-allowed';
                } else {
                    e.target.getStage().container().style.cursor = object.type === 'text' ? 'text' : 'move';
                }
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
                    dash={object.dash}
                    dashOffset={object.dashOffset}
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
                    dash={object.dash}
                    dashOffset={object.dashOffset}
                />
            )}

            {object.type === 'ellipse' && (
                <KonvaEllipse
                    {...innerProps}
                    x={width / 2}
                    y={height / 2}
                    radiusX={width / 2}
                    radiusY={height / 2}
                    stroke={object.stroke || 'black'}
                    strokeWidth={object.strokeWidth || 2}
                    fill={object.fill || 'transparent'}
                    opacity={object.opacity ?? 1}
                    dash={object.dash}
                    dashOffset={object.dashOffset}
                />
            )}

            {(object.type === 'triangle' || object.type === 'polygon') && (
                <RegularPolygon
                    {...innerProps}
                    x={width / 2}
                    y={height / 2}
                    sides={object.type === 'triangle' ? 3 : (object.sides || 5)}
                    radius={Math.min(width, height) / 2}
                    stroke={object.stroke || 'black'}
                    strokeWidth={object.strokeWidth || 2}
                    fill={object.fill || 'transparent'}
                    opacity={object.opacity ?? 1}
                    dash={object.dash}
                    dashOffset={object.dashOffset}
                />
            )}

            {object.type === 'star' && (
                <KonvaStar
                    {...innerProps}
                    x={width / 2}
                    y={height / 2}
                    numPoints={object.sides || 5}
                    innerRadius={(object.innerRadius || (Math.min(width, height) / 4))}
                    outerRadius={(object.outerRadius || (Math.min(width, height) / 2))}
                    stroke={object.stroke || 'black'}
                    strokeWidth={object.strokeWidth || 2}
                    fill={object.fill || 'transparent'}
                    opacity={object.opacity ?? 1}
                    dash={object.dash}
                    dashOffset={object.dashOffset}
                />
            )}

            {object.type === 'image' && <URLImage {...innerProps} object={object} opacity={object.opacity ?? 1} />}

            {(object.type === 'path' || object.type === 'line' || object.type === 'arrow') && object.points && (
                <Line
                    points={object.points}
                    stroke={object.stroke || 'black'}
                    strokeWidth={object.strokeWidth || 2}
                    tension={object.type === 'path' ? 0.5 : 0} // Straight lines for 'line'/'arrow'
                    lineCap="round"
                    lineJoin="round"
                    x={innerX}
                    y={innerY}
                    fill="transparent"
                    opacity={object.opacity ?? 1}
                    pointerLength={object.type === 'arrow' ? 10 : 0}
                    pointerWidth={object.type === 'arrow' ? 10 : 0}
                    dash={object.dash}
                    dashOffset={object.dashOffset}
                />
            )}
            {object.type === 'measure' && object.points && (
                <>
                    <Line
                        points={object.points}
                        stroke={object.stroke || '#ef4444'}
                        strokeWidth={2}
                        lineCap="round"
                        lineJoin="round"
                        x={innerX}
                        y={innerY}
                        fill="transparent"
                        opacity={object.opacity ?? 1}
                    />
                    {(() => {
                        const [x1, y1, x2, y2] = object.points;
                        const angle = Math.atan2(y2 - y1, x2 - x1);
                        const tickLen = 10;
                        const perpAngle = angle + Math.PI / 2;

                        const distPx = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                        const distUnit = distPx / (calibration?.scale || 1);
                        const unitLabel = calibration?.unit || 'px';

                        const dx = Math.cos(perpAngle) * tickLen / 2;
                        const dy = Math.sin(perpAngle) * tickLen / 2;

                        return (
                            <>
                                <Line
                                    points={[x1 - dx, y1 - dy, x1 + dx, y1 + dy]}
                                    stroke={object.stroke || '#ef4444'}
                                    strokeWidth={2}
                                    x={innerX}
                                    y={innerY}
                                />
                                <Line
                                    points={[x2 - dx, y2 - dy, x2 + dx, y2 + dy]}
                                    stroke={object.stroke || '#ef4444'}
                                    strokeWidth={2}
                                    x={innerX}
                                    y={innerY}
                                />
                                <Text
                                    x={innerX + (x1 + x2) / 2}
                                    y={innerY + (y1 + y2) / 2}
                                    text={`${Math.round(distUnit * 100) / 100}${unitLabel}`}
                                    fontSize={12}
                                    fontFamily="Inter"
                                    fill={object.stroke || '#ef4444'}
                                    align="center"
                                    verticalAlign="middle"
                                    offsetX={20}
                                    offsetY={20}
                                    rotation={(angle * 180 / Math.PI)}
                                />
                            </>
                        );
                    })()}
                </>
            )}

            {object.type === 'redaction' && (
                <Group>
                    <Rect
                        {...innerProps}
                        fill="black"
                        opacity={1}
                        stroke={isSelected ? '#ef4444' : 'black'}
                        strokeWidth={1}
                    />
                    <Text
                        {...innerProps}
                        text="REDACTED"
                        fontSize={Math.min(width, height) / 4}
                        fill="rgba(255, 255, 255, 0.4)"
                        align="center"
                        verticalAlign="middle"
                        fontStyle="bold"
                    />
                    {/* Diagnostic/Instruction text when hovering or selected */}
                    {isSelected && (
                        <Text
                            y={height + 5}
                            width={width}
                            text="Permanently removes underlying content on export"
                            fontSize={10}
                            fill="#ef4444"
                            align="center"
                        />
                    )}
                </Group>
            )}

            {object.type === 'stamp' && object.content && (
                <URLImage
                    {...innerProps}
                    object={{
                        ...object,
                        src: `data:image/svg+xml;utf8,${encodeURIComponent(object.content)}`
                    }}
                    opacity={object.opacity ?? 1}
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
