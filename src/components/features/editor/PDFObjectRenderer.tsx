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

            // Grayscale (B&W)
            if (object.grayscale === 1) {
                activeFilters.push(Konva.Filters.Grayscale);
            }

            // Sepia
            if (object.sepia === 1) {
                activeFilters.push(Konva.Filters.Sepia);
            }

            // Invert
            if (object.invert === 1) {
                activeFilters.push(Konva.Filters.Invert);
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
        object.pixelate,
        object.grayscale,
        object.sepia,
        object.invert
    ]);

    return (
        <Group
            x={props.x}
            y={props.y}
            width={props.width}
            height={props.height}
            // Apply clip to the Group
            clipFunc={(!object.cropShape || object.cropShape === 'rect') ? undefined : (ctx: any) => {
                const shape = object.cropShape;
                const w = object.width || 0;
                const h = object.height || 0;

                if (shape === 'circle') {
                    ctx.beginPath();
                    ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
                    ctx.closePath();
                } else if (shape === 'heart') {
                    const cx = 0;
                    const cy = 0;
                    const cw = w;
                    const ch = h;

                    ctx.beginPath();
                    ctx.moveTo(cx + cw / 2, cy + ch);
                    ctx.bezierCurveTo(cx, cy + ch * 0.6, cx, cy, cx + cw / 2, cy + ch * 0.3);
                    ctx.bezierCurveTo(cx + cw, cy, cx + cw, cy + ch * 0.6, cx + cw / 2, cy + ch);
                    ctx.closePath();
                }
            }}
        >
            <KonvaImage
                ref={imageRef}
                image={img}
                opacity={opacity}
                // Reset position relative to Group
                x={0}
                y={0}
                width={props.width}
                height={props.height}

                scaleX={object.flipX ? -1 : 1}
                scaleY={object.flipY ? -1 : 1}
                skewX={object.skewX || 0}
                skewY={object.skewY || 0}
                offsetX={object.flipX ? object.width : 0}
                offsetY={object.flipY ? object.height : 0}
                crop={object.crop}

                fill="transparent"
                cornerRadius={object.cornerRadius || 0}
                stroke={object.stroke}
                strokeWidth={object.strokeWidth}
                strokeEnabled={(object.strokeWidth ?? 0) > 0}

                // Shadow (apply to image or group? Image is better for cached filters usually, 
                // but if clipped, shadow should follow clip? 
                // If shadow is on Image, and Image is cached, shadow is baked. 
                // Then Group clips it. This cuts the shadow.
                // ideally shadow should be on the Group? 
                // But let's stick to minimal changes for transparency first.
                shadowColor={object.shadowColor}
                shadowBlur={object.shadowBlur}
                shadowOffsetX={object.shadowOffsetX}
                shadowOffsetY={object.shadowOffsetY}
                shadowOpacity={object.shadowOpacity}

                {...props}
            />
        </Group>
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
    const {
        editingObjectId,
        setEditingObjectId,
        openImageStudio,
        openShapeEditor,
        openTextStudio
    } = useEditorStore();

    const isEditing = editingObjectId === object.id;
    const { calibration } = usePDFStore();

    // Debug Log
    // console.log(`[Renderer] ${object.id} (${object.type}) Opacity:`, object.opacity);

    if (object.type === 'group') {
        console.log('[PDFObjectRenderer] Rendering Group:', { id: object.id, x: object.x, y: object.y, childrenCount: object.children?.length, visible: object.visible, opacity: object.opacity });
    }
    if (!isSelectionEnabled) {
        console.log('[PDFObjectRenderer] Rendering Child:', { parentGroup: true, id: object.id, type: object.type, x: object.x, y: object.y, visible: object.visible });
    }


    // If it's a new text object, focus it immediately
    useEffect(() => {
        if (object.type === 'text' && object.isNew && !isEditing) {
            setEditingObjectId(object.id);
            onChange?.({ isNew: false });
        }
    }, [object.isNew, object.type, isEditing, onChange, object.id, setEditingObjectId]);

    // Force Cache for Groups (Flatten to Image behavior)
    useEffect(() => {
        if (object.type === 'group' && groupRef.current) {
            try {
                // We need to wait for children to potentially load if they are images?
                // But usually they are already loaded or in store.
                // For now, immediate cache.
                groupRef.current.cache({
                    pixelRatio: 2 // High quality
                });
            } catch (e) {
                console.error("Failed to cache group", e);
            }
        }
        return () => {
            if (object.type === 'group' && groupRef.current) {
                groupRef.current.clearCache();
            }
        };
    }, [object.type, object.children, object.width, object.height, object.id]);

    const handleObjectDblClick = () => {
        if (object.type === 'text') {
            openTextStudio('edit', object.id);
        } else if (object.type === 'image') {
            // Re-open Image Studio
            if (object.originalSrc) {
                openImageStudio(
                    object.originalSrc,
                    object.id,
                    object.editParams
                );
            } else {
                // Legacy: just crop
                useEditorStore.getState().setCropping(true);
            }
        } else if (['rectangle', 'circle', 'triangle', 'star', 'polygon', 'ellipse', 'heart', 'cloud', 'lightning', 'drop', 'callout-bubble'].includes(object.type)) {
            openShapeEditor('edit');
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
                if (object.type === 'effect') {
                    // Professionals don't show "not-allowed" for fixed adjustment layers, 
                    // they show "pointer" or "default" because it's still an interactive layer.
                    e.target.getStage().container().style.cursor = 'pointer';
                } else if (isLocked) {
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

            {/* Always add an invisible hit area for groups to catch clicks easily */}
            {object.type === 'group' && (
                <Rect
                    x={0}
                    y={0}
                    width={width}
                    height={height}
                    fill="transparent"
                    stroke={isSelected ? "#3b82f6" : "transparent"} // Optional debug border
                    strokeWidth={1}
                />
            )}

            {object.type === 'text' && (
                <>
                    {object.isCurved ? (
                        // Curved Text using TextPath
                        <TextPath
                            {...innerProps}
                            text={object.text || " "}
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
                            opacity={isEditing ? 0.3 : (object.opacity ?? 1)}
                            visible={true}

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
                            text={object.text || " "}
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
                            opacity={isEditing ? 0.3 : (object.opacity ?? 1)}
                            visible={true}

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
                </>
            )}

            {object.type === 'rectangle' && (
                <Rect
                    {...innerProps}
                    stroke={object.stroke || 'black'}
                    strokeWidth={object.strokeWidth ?? 2}
                    strokeEnabled={(object.strokeWidth ?? 2) > 0}
                    fill={hexToRgba(object.fill, object.fillOpacity ?? 1)}
                    cornerRadius={5}
                    opacity={object.opacity ?? 1}
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
                    strokeWidth={object.strokeWidth ?? 2}
                    strokeEnabled={(object.strokeWidth ?? 2) > 0}
                    fill={hexToRgba(object.fill, object.fillOpacity ?? 1)}
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
                    strokeWidth={object.strokeWidth ?? 2}
                    strokeEnabled={(object.strokeWidth ?? 2) > 0}
                    fill={hexToRgba(object.fill, object.fillOpacity ?? 1)}
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
                    radius={50} // Base radius
                    scaleX={width / 100}
                    scaleY={height / 100}
                    stroke={object.stroke || 'black'}
                    strokeWidth={(object.strokeWidth ?? 2) / (width / 100)} // Normalize stroke width
                    strokeEnabled={(object.strokeWidth ?? 2) > 0}
                    fill={hexToRgba(object.fill, object.fillOpacity ?? 1)}
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
                    innerRadius={25}
                    outerRadius={50}
                    scaleX={width / 100}
                    scaleY={height / 100}
                    stroke={object.stroke || 'black'}
                    strokeWidth={object.strokeWidth ?? 2}
                    strokeEnabled={(object.strokeWidth ?? 2) > 0}
                    fill={hexToRgba(object.fill, object.fillOpacity ?? 1)}
                    opacity={object.opacity ?? 1}
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
                    fill={hexToRgba(object.fill, object.fillOpacity ?? 1)}
                    stroke={object.stroke || 'black'}
                    strokeWidth={object.strokeWidth ?? 2}
                    strokeEnabled={(object.strokeWidth ?? 2) > 0}
                    scaleX={width / 24} // Normalizing from typical SVG viewbox 24x24 or similar
                    scaleY={height / 24}
                    opacity={object.opacity ?? 1}
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
                    strokeWidth={object.strokeWidth ?? 2}
                    strokeEnabled={(object.strokeWidth ?? 2) > 0}
                    tension={object.type === 'path' ? 0.5 : 0} // Straight lines for 'line'/'arrow'
                    lineCap="round"
                    lineJoin="round"
                    x={innerX}
                    y={innerY}
                    fill="transparent"
                    opacity={object.opacity ?? 1}
                    pointerLength={object.type === 'arrow' ? (object.strokeWidth ?? 2) * 3 : 0}
                    pointerWidth={object.type === 'arrow' ? (object.strokeWidth ?? 2) * 3 : 0}
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

            {object.type === 'effect' && (
                <>
                    <Rect
                        {...innerProps}
                        fill={isSelected ? 'rgba(59, 130, 246, 0.05)' : 'transparent'}
                        stroke={isSelected ? "#3b82f6" : "transparent"}
                        strokeWidth={isSelected ? 1 : 0}
                    // This Rect acts as the selection hit area for the effect layer
                    />
                    {/* Professional Tag Label */}
                    {isSelected && (
                        <Group x={10} y={10} listening={false}>
                            <Rect
                                fill="#3b82f6"
                                width={120}
                                height={24}
                                cornerRadius={4}
                            />
                            <Text
                                text={`${object.name?.toUpperCase() || 'ADJUSTMENT LAYER'}`}
                                fill="white"
                                width={120}
                                height={24}
                                align="center"
                                verticalAlign="middle"
                                fontSize={10}
                                fontStyle="bold"
                            />
                        </Group>
                    )}
                </>
            )}

            {object.type === 'group' && object.children && (
                <>
                    {object.children.map(child => (
                        <PDFObjectRenderer
                            key={child.id}
                            object={child}
                            isSelected={false}
                            isSelectionEnabled={false} // Disable individual selection of children
                            isLocked={true} // Lock children so they don't capture events independently of group
                        />
                    ))}
                </>
            )}



        </Group>
    );
};

// TextEditorOverlay removed - moved to separate file and outside Konva tree
