import React, { useRef, useEffect } from 'react';
import { Text, TextPath, Rect, Circle as KonvaCircle, Image as KonvaImage, Group, Line, Arrow, RegularPolygon, Star as KonvaStar, Ellipse as KonvaEllipse, Label, Tag, Path } from 'react-konva';
import { createPortal } from 'react-dom';
import useImage from 'use-image';
import type { PDFObject } from '../../../store/pdfStore';
import { usePDFStore } from '../../../store/pdfStore';
import { useEditorStore } from '../../../store/editorStore';
import { SHAPE_PATHS } from '../../../constants/shapeConstants';
import { hexToRgba } from '../../../utils/colorUtils';

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

import Konva from 'konva';

const URLImage = ({ object, opacity, ...props }: any) => {
    const [img] = useImage(object.src || '', 'anonymous');
    const imageRef = useRef<Konva.Image>(null);

    // Apply filters and cache
    useEffect(() => {
        if (img && imageRef.current) {
            const node = imageRef.current;
            const activeFilters: any[] = [];

            // Brightness
            if (object.brightness !== undefined && object.brightness !== 0) {
                activeFilters.push(Konva.Filters.Brighten);
                node.brightness(object.brightness);
            }

            // Contrast
            if (object.contrast !== undefined && object.contrast !== 0) {
                activeFilters.push(Konva.Filters.Contrast);
                node.contrast(object.contrast);
            }

            // Blur
            if (object.blurRadius !== undefined && object.blurRadius > 0) {
                activeFilters.push(Konva.Filters.Blur);
                node.blurRadius(object.blurRadius);
            }

            // HSL (Saturation, Hue, Luminance)
            if ((object.saturation !== undefined && object.saturation !== 0) ||
                (object.hue !== undefined && object.hue !== 0)) {
                activeFilters.push(Konva.Filters.HSL);
                node.saturation(object.saturation || 0);
                node.hue(object.hue || 0);
                // node.luminance(object.luminance || 0); // If we add luminance later
            }

            // Tint (using RGBA) - Konva.Filters.RGBA
            // Not implemented in store yet, but good to have logic if needed. 
            // For now sticking to what's defined.

            // Noise
            if (object.noise !== undefined && object.noise > 0) {
                activeFilters.push(Konva.Filters.Noise);
                node.noise(object.noise);
            }

            // Pixelate
            if (object.pixelate !== undefined && object.pixelate > 1) {
                activeFilters.push(Konva.Filters.Pixelate);
                node.pixelSize(object.pixelate);
            }

            // Apply specific named filters if they exist (old way compatibility or presets)
            if (object.filters) {
                // ... logic for old filters if needed, but improved system replaces it.
            }

            node.filters(activeFilters);

            // Clear previous cache to avoid artifacts or errors
            node.clearCache();

            // Only cache if we have filters or we need to cache for some other reason
            if (activeFilters.length > 0) {
                try {
                    node.cache({
                        pixelRatio: 1, // Fix resolution for performance/memory
                        imageSmoothingEnabled: true
                    });
                } catch (e) {
                    console.error("PDFObjectRenderer: Failed to cache image", e);
                }
            } else {
                // If no filters, we might still want to clear cache effectively
                // But generally Konva handles non-cached images fine.
                // However, if we HAD filters and now don't, clearing cache is enough.
            }

            node.getLayer()?.batchDraw();
        }
    }, [
        img,
        object.filters, // Keep dependency for back-compat
        object.width,
        object.height,
        object.cornerRadius,
        object.stroke,
        object.strokeWidth,
        object.shadowColor,
        object.shadowBlur,
        object.shadowOffsetX,
        object.shadowOffsetY,
        object.shadowOpacity,
        // New deps
        object.brightness,
        object.contrast,
        object.saturation,
        object.blurRadius,
        object.hue,
        object.noise,
        object.pixelate
    ]);

    return (
        <KonvaImage
            ref={imageRef}
            image={img}
            opacity={opacity}
            scaleX={object.flipX ? -1 : 1}
            scaleY={object.flipY ? -1 : 1}
            skewX={object.skewX || 0}
            skewY={object.skewY || 0}
            offsetX={object.flipX ? object.width : 0}
            offsetY={object.flipY ? object.height : 0}
            crop={object.crop}

            // Styling
            cornerRadius={object.cornerRadius || 0}
            stroke={object.stroke}
            strokeWidth={object.strokeWidth}

            // Advanced Crop Shape (Masking)
            clipFunc={object.cropShape === 'circle' ? (ctx: any) => {
                const w = object.width || 0;
                const h = object.height || 0;
                // Draw Ellipse
                ctx.beginPath();
                ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
                ctx.closePath();
            } : undefined}

            // Shadow
            shadowColor={object.shadowColor}
            shadowBlur={object.shadowBlur}
            shadowOffsetX={object.shadowOffsetX}
            shadowOffsetY={object.shadowOffsetY}
            shadowOpacity={object.shadowOpacity}

            {...props}
        />
    );
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

    const handleObjectDblClick = () => {
        if (object.type === 'text') {
            setIsEditing(true);
        } else if (object.type === 'image') {
            // Re-open Image Studio
            if (object.originalSrc) {
                useEditorStore.getState().openImageStudio(
                    object.originalSrc,
                    object.id,
                    object.editParams
                );
            } else {
                // Legacy: just crop
                useEditorStore.getState().setCropping(true);
            }
        } else if (['rectangle', 'circle', 'triangle', 'star', 'polygon', 'ellipse', 'heart', 'cloud', 'lightning', 'drop', 'callout-bubble'].includes(object.type)) {
            useEditorStore.getState().openShapeEditor('edit');
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
        visible: object.visible !== false, // Use the visible flag
        // Locked objects cannot be dragged
        draggable: isSelectionEnabled && !isLocked && !isEditing,
        // We MUST listen to events even if locked to show the 'not-allowed' cursor
        listening: isSelectionEnabled,
        onClick: (e: any) => {
            if (isSelectionEnabled && !isLocked) onSelect?.(e);
        },
        onDblClick: isLocked ? undefined : handleObjectDblClick,
        onTap: (e: any) => {
            if (isSelectionEnabled && !isLocked) onSelect?.(e);
        },
        onDblTap: isLocked ? undefined : handleObjectDblClick,
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
                    {object.isCurved ? (
                        // Curved Text using TextPath
                        <TextPath
                            {...innerProps}
                            text={isEditing ? '' : (object.text || " ")}
                            fontSize={object.fontSize || 16}
                            fontFamily={object.fontFamily || 'Inter'}
                            fill={object.fill || 'black'}
                            // Stroke / Outline
                            stroke={object.stroke || 'transparent'}
                            strokeWidth={object.strokeWidth || 0}

                            fontWeight={object.fontWeight}
                            fontStyle={object.fontStyle}
                            textDecoration={object.textDecoration}
                            align={object.align || 'left'}
                            opacity={object.opacity ?? 1}
                            visible={!isEditing}

                            // Spacing
                            letterSpacing={object.letterSpacing || 0}

                            // Wrapping logic
                            width={object.isWrapped !== false ? (object.width || 200) : undefined}

                            // Curve Calculation
                            data={`M 10 50 Q ${(object.width || 200) / 2} ${(object.curveRadius && object.curveRadius < 0 ? 50 + Math.abs(object.curveRadius) : 50 - (object.curveRadius || 50))} ${(object.width || 200) - 10} 50`}
                        />
                    ) : (
                        <Text
                            {...innerProps}
                            text={isEditing ? '' : (object.text || " ")}
                            fontSize={object.fontSize || 16}
                            fontFamily={object.fontFamily || 'Inter'}
                            fill={object.fill || 'black'}

                            // Wrapping logic
                            width={object.isWrapped !== false ? (object.width || 200) : undefined}

                            // Stroke / Outline
                            stroke={object.stroke || 'transparent'}
                            strokeWidth={object.strokeWidth || 0}

                            fontWeight={object.fontWeight}
                            fontStyle={object.fontStyle}
                            textDecoration={object.textDecoration}
                            align={object.align || 'left'}
                            verticalAlign="middle"
                            opacity={object.opacity ?? 1}
                            visible={!isEditing}

                            // Spacing
                            letterSpacing={object.letterSpacing || 0}
                            lineHeight={object.lineHeight || 1.2}

                            // Shadow
                            shadowColor={object.shadowColor}
                            shadowBlur={object.shadowBlur}
                            shadowOffsetX={object.shadowOffsetX}
                            shadowOffsetY={object.shadowOffsetY}
                            shadowOpacity={object.shadowOpacity}
                        />
                    )}

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
                    fill={hexToRgba(object.fill, object.opacity)}
                    cornerRadius={5}
                    opacity={1}
                    dash={object.dash}
                    dashOffset={object.dashOffset}
                />
            )}

            {object.type === 'circle' && (
                <KonvaEllipse
                    {...innerProps}
                    x={width / 2}
                    y={height / 2}
                    radiusX={width / 2}
                    radiusY={height / 2}
                    stroke={object.stroke || 'black'}
                    strokeWidth={object.strokeWidth || 2}
                    fill={hexToRgba(object.fill, object.opacity)}
                    opacity={1}
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
                    fill={hexToRgba(object.fill, object.opacity)}
                    opacity={1}
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
                    radius={50} // Base radius
                    scaleX={width / 100}
                    scaleY={height / 100}
                    stroke={object.stroke || 'black'}
                    strokeWidth={(object.strokeWidth || 2) / (width / 100)} // Normalize stroke width
                    fill={hexToRgba(object.fill, object.opacity)}
                    opacity={1}
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
                    innerRadius={25}
                    outerRadius={50}
                    scaleX={width / 100}
                    scaleY={height / 100}
                    stroke={object.stroke || 'black'}
                    strokeWidth={object.strokeWidth || 2}
                    fill={hexToRgba(object.fill, object.opacity)}
                    opacity={1}
                    dash={object.dash}
                    dashOffset={object.dashOffset}
                />
            )}

            {/* NEW SHAPES */}
            {['heart', 'cloud', 'lightning', 'drop', 'callout-bubble'].includes(object.type) && (
                <Path
                    {...innerProps}
                    x={0}
                    y={0}
                    data={
                        SHAPE_PATHS[object.type] || ""
                    }
                    fill={hexToRgba(object.fill, object.opacity)}
                    stroke={object.stroke || 'black'}
                    strokeWidth={object.strokeWidth || 2}
                    scaleX={width / 24} // Normalizing from typical SVG viewbox 24x24 or similar
                    scaleY={height / 24}
                    opacity={1}
                    shadowColor={object.shadowColor}
                    shadowBlur={object.shadowBlur}
                    shadowOffsetX={object.shadowOffsetX}
                    shadowOffsetY={object.shadowOffsetY}
                    shadowOpacity={object.shadowOpacity}
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
                    pointerLength={object.type === 'arrow' ? (object.strokeWidth || 2) * 3 : 0}
                    pointerWidth={object.type === 'arrow' ? (object.strokeWidth || 2) * 3 : 0}
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
                        const tickLen = 14;
                        const perpAngle = angle + Math.PI / 2;

                        const distPx = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                        const distUnit = distPx / (calibration?.scale || 1);
                        const unitLabel = calibration?.unit || 'px';
                        const text = `${Math.round(distUnit * 100) / 100}${unitLabel}`;

                        const dx = Math.cos(perpAngle) * tickLen / 2;
                        const dy = Math.sin(perpAngle) * tickLen / 2;

                        const centerX = innerX + (x1 + x2) / 2;
                        const centerY = innerY + (y1 + y2) / 2;

                        return (
                            <Group>
                                {/* End Ticks */}
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

                                {/* Label with shadow for readability */}
                                <Group x={centerX} y={centerY} rotation={(angle * 180 / Math.PI)}>
                                    {/* Background Rect for Text */}
                                    {/* We use a simple guess for width or just use shadow */}
                                    <Text
                                        text={text}
                                        fontSize={12}
                                        fontFamily="Inter"
                                        fill={object.stroke || '#ef4444'}
                                        fontStyle="bold"
                                        align="center"
                                        verticalAlign="middle"
                                        offsetY={12} // Adjusted to sit above the line
                                        offsetX={text.length * 3.5} // Rough centering
                                        shadowColor="white"
                                        shadowBlur={2}
                                        shadowOpacity={1}
                                        shadowOffsetX={0}
                                        shadowOffsetY={0}
                                    />
                                </Group>
                            </Group>
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
