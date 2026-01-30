import React, { useState } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import { usePDFStore } from '../../../store/pdfStore';
import { PDFObjectRenderer } from './PDFObjectRenderer';

interface CanvasLayerProps {
    pageId: string; // Changed from pageNumber to pageId for robust lookup
    pageNumber: number;
    width: number;
    height: number;
    scale: number;
}

export const CanvasLayer: React.FC<CanvasLayerProps> = ({ pageId, pageNumber, width, height, scale }) => {
    const {
        pages,
        activeTool,
        toolPreferences, // Changed from toolSettings
        addPath,
        addObject,
        updateObject,
        selectObject,
        selectedObjectIds,
        setActiveTool
    } = usePDFStore();

    const page = pages.find(p => p.id === pageId);

    // Derived Settings for Active Tool (Fixing Crash)
    // Fallback to defaults if undefined to prevent crash during hot reload/state transitions
    const toolSettings = toolPreferences[activeTool] || {
        color: '#000000',
        size: 2,
        opacity: 1,
        fontFamily: 'Arial',
        fontSize: 16
    };

    // Local state for drawing
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPath, setCurrentPath] = useState<number[]>([]);
    const [shapeStartPos, setShapeStartPos] = useState<{ x: number; y: number } | null>(null);
    const [currentShape, setCurrentShape] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

    // Area Selection State
    const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
    const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

    // Element Eraser Drag State
    const [isElementErasing, setIsElementErasing] = useState(false);
    const deletedIdsRef = React.useRef<Set<string>>(new Set()); // Track already deleted to avoid duplicates

    if (!page) return null;

    const handleMouseDown = (e: any) => {
        const stage = e.target.getStage();
        const pos = stage.getPointerPosition();
        if (!pos) return;

        const scaledX = pos.x / scale;
        const scaledY = pos.y / scale;

        // 1. Handle deselect if clicked on empty stage
        if (e.target === stage) {
            // Start Area Selection if in Select Mode
            if (activeTool === 'select') {
                setSelectionStart({ x: scaledX, y: scaledY });
                setSelectionRect({ x: scaledX, y: scaledY, width: 0, height: 0 });
                selectObject('', false); // Clear previous selection
                return;
            }
            selectObject('', false);
        }

        // 2. Handle Element Eraser (Drag-to-Delete Mode like Edge PDF)
        const eraserMode = usePDFStore.getState().eraserMode;
        if (activeTool === 'eraser' && eraserMode === 'element') {
            // Start element erasing session
            setIsElementErasing(true);
            deletedIdsRef.current.clear(); // Reset tracking

            // Check if we clicked on an object/shape (not the stage)
            const clickedOnStage = e.target === stage;
            if (!clickedOnStage) {
                const clickedId = e.target.id();
                if (clickedId && !deletedIdsRef.current.has(clickedId)) {
                    deletedIdsRef.current.add(clickedId);
                    usePDFStore.getState().deleteObjects([clickedId]);
                }
            }
            return; // Don't start drawing
        }

        // 2b. Handle Drawing Tools (Pen, Highlighter, Path Eraser)
        const drawingTools = ['pen', 'highlighter', 'eraser'];
        if (drawingTools.includes(activeTool)) {
            setIsDrawing(true);
            setCurrentPath([scaledX, scaledY]);
            return;
        }

        // 3. Handle Shape Tools (Rect, Circle, Text) - DRAG TO DRAW
        if (['rectangle', 'circle', 'text'].includes(activeTool)) {
            setIsDrawing(true);
            setShapeStartPos({ x: scaledX, y: scaledY });
            // For text, we might want just a click-to-place, but let's allow drag for box size?
            // "Text" usually is click-to-type. Let's keep Text as click-to-place for MVP, or small drag.
            // For now, init currentShape
            setCurrentShape({ x: scaledX, y: scaledY, width: 0, height: 0 });
        }
    };

    const handleMouseMove = (e: any) => {
        const stage = e.target.getStage();
        const point = stage.getPointerPosition();
        if (!point) return;

        const scaledX = point.x / scale;
        const scaledY = point.y / scale;

        // Element Eraser Drag - Delete objects as cursor passes over them
        const eraserMode = usePDFStore.getState().eraserMode;
        if (isElementErasing && activeTool === 'eraser' && eraserMode === 'element') {
            // Hit test: Find all shapes at the current pointer position
            const shapes = stage.getAllIntersections({ x: point.x, y: point.y });
            shapes.forEach((shape: any) => {
                const shapeId = shape.id();
                if (shapeId && !deletedIdsRef.current.has(shapeId)) {
                    deletedIdsRef.current.add(shapeId);
                    usePDFStore.getState().deleteObjects([shapeId]);
                }
            });
            return;
        }

        // Area Selection
        if (selectionStart) {
            const width = scaledX - selectionStart.x;
            const height = scaledY - selectionStart.y;
            setSelectionRect({
                x: width < 0 ? selectionStart.x + width : selectionStart.x,
                y: height < 0 ? selectionStart.y + height : selectionStart.y,
                width: Math.abs(width),
                height: Math.abs(height)
            });
            return;
        }

        if (!isDrawing) return;

        // Freehand Drawing
        if (['pen', 'highlighter', 'eraser'].includes(activeTool)) {
            setCurrentPath(prev => [...prev, scaledX, scaledY]);
            return;
        }

        // Shape Drawing
        if (['rectangle', 'circle'].includes(activeTool) && shapeStartPos) {
            const width = scaledX - shapeStartPos.x;
            const height = scaledY - shapeStartPos.y;
            setCurrentShape({
                x: shapeStartPos.x,
                y: shapeStartPos.y,
                width: width,
                height: height
            });
        }
    };

    const handleMouseUp = () => {
        // End Element Eraser session
        if (isElementErasing) {
            setIsElementErasing(false);
            deletedIdsRef.current.clear();
            return;
        }

        // Finalize Area Selection
        if (selectionStart && selectionRect) {
            // Find objects inside rect
            const selectedIds: string[] = [];
            const rect = selectionRect;

            page.objects.forEach(obj => {
                // Simple bounding box intersection
                // Object bounds (simplified, ignoring rotation for now)
                const objRight = obj.x + (obj.width || 0);
                const objBottom = obj.y + (obj.height || 0);
                const rectRight = rect.x + rect.width;
                const rectBottom = rect.y + rect.height;

                // Check overlap
                if (
                    obj.x < rectRight &&
                    objRight > rect.x &&
                    obj.y < rectBottom &&
                    objBottom > rect.y
                ) {
                    selectedIds.push(obj.id);
                }
            });

            if (selectedIds.length > 0) {
                // We need `selectObjects` (plural) action in store ideally
                // Or call selectObject per item with multi=true
                // But selectObjects is better. Let's assume I added it or use loop.
                // Re-checking store... I added `selectObjects` in previous step!
                // Type check: Need to make sure `selectObjects` is available in props.
                usePDFStore.getState().selectObjects(selectedIds);
            }

            setSelectionStart(null);
            setSelectionRect(null);
            return;
        }


        if (!isDrawing) return;

        // Finalize Freehand
        if (['pen', 'highlighter', 'eraser'].includes(activeTool) && currentPath.length > 0) {
            addPath(pageId, {
                id: crypto.randomUUID(),
                points: currentPath,
                stroke: activeTool === 'eraser' ? '#ffffff' : toolSettings.color,
                strokeWidth: toolSettings.size,
                tool: activeTool as any,
                opacity: activeTool === 'highlighter' ? 0.5 : 1
            });
            // Freehand usually allows continuous drawing, so we might NOT reset tool here.
            // But user might want it. Let's keep continuous for Pen.
        }

        // Finalize Shape
        if (['rectangle', 'circle', 'text'].includes(activeTool) && shapeStartPos) {
            // Check for minimal size to unintentional clicks vs drags
            const width = currentShape ? currentShape.width : 0;
            const height = currentShape ? currentShape.height : 0;

            // If very small drag, treat as default size
            const isClick = Math.abs(width) < 5 && Math.abs(height) < 5;

            // Normalize negative width/height (dragging LEFT or UP)
            const finalX = width < 0 ? shapeStartPos.x + width : shapeStartPos.x;
            const finalY = height < 0 ? shapeStartPos.y + height : shapeStartPos.y;
            const finalW = isClick ? 100 : Math.abs(width);
            const finalH = isClick ? 100 : Math.abs(height);

            if (activeTool === 'text') { // Text is special, usually just click
                addObject(pageId, {
                    id: crypto.randomUUID(),
                    type: 'text',
                    x: finalX,
                    y: finalY,
                    text: 'Double click to edit',
                    fill: toolSettings.color,
                    fontSize: toolSettings.fontSize || 16,
                    fontFamily: toolSettings.fontFamily || 'Arial',
                    width: Math.max(200, finalW) // Default min width for text
                });
            } else {
                addObject(pageId, {
                    id: crypto.randomUUID(),
                    type: activeTool as any,
                    x: finalX,
                    y: finalY,
                    width: finalW,
                    height: finalH,
                    stroke: toolSettings.color,
                    strokeWidth: 2,
                    fill: 'transparent'
                });
            }

            // AUTO-SWITCH TO SELECT (Fixes "continuous drawing" annoyance)
            setActiveTool('select');
        }

        setIsDrawing(false);
        setCurrentPath([]);
        setShapeStartPos(null);
        setCurrentShape(null);
    };

    const getCursorStyle = () => {
        const color = toolSettings.color || '#000000';
        const size = toolSettings.size || 2;

        // --- CUSTOM CURSOR: PEN ---
        // A filled circle in the current pen color, centered.
        if (activeTool === 'pen') {
            const cursorSize = Math.max(8, size + 4); // Minimum visible size
            const half = cursorSize / 2;
            const svg = `
                <svg xmlns='http://www.w3.org/2000/svg' width='${cursorSize}' height='${cursorSize}' viewBox='0 0 ${cursorSize} ${cursorSize}'>
                    <circle cx='${half}' cy='${half}' r='${size / 2 + 1}' fill='${color}' stroke='white' stroke-width='1'/>
                </svg>
            `;
            return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${half} ${half}, crosshair`;
        }

        // --- CUSTOM CURSOR: HIGHLIGHTER ---
        // A wide, semi-transparent rectangle representing the highlighter tip.
        if (activeTool === 'highlighter') {
            const cursorWidth = size + 6;
            const cursorHeight = Math.max(12, size / 2);
            const halfW = cursorWidth / 2;
            const halfH = cursorHeight / 2;
            const svg = `
                <svg xmlns='http://www.w3.org/2000/svg' width='${cursorWidth}' height='${cursorHeight}' viewBox='0 0 ${cursorWidth} ${cursorHeight}'>
                    <rect x='0' y='0' width='${cursorWidth}' height='${cursorHeight}' rx='2' fill='${color}' fill-opacity='0.6' stroke='rgba(0,0,0,0.5)' stroke-width='1'/>
                </svg>
            `;
            return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${halfW} ${halfH}, text`;
        }

        // --- DYNAMIC ERASER CURSOR ---
        if (activeTool === 'eraser') {
            const eraserMode = usePDFStore.getState().eraserMode;
            const eraserSize = size || 20;
            const half = eraserSize / 2;

            // Element Eraser: Target/Crosshair with X
            if (eraserMode === 'element') {
                const targetSize = 24;
                const targetHalf = targetSize / 2;
                const svg = `
                    <svg xmlns='http://www.w3.org/2000/svg' width='${targetSize}' height='${targetSize}' viewBox='0 0 ${targetSize} ${targetSize}'>
                        <circle cx='${targetHalf}' cy='${targetHalf}' r='8' fill='none' stroke='#ef4444' stroke-width='2'/>
                        <line x1='${targetHalf}' y1='4' x2='${targetHalf}' y2='20' stroke='#ef4444' stroke-width='2'/>
                        <line x1='4' y1='${targetHalf}' x2='20' y2='${targetHalf}' stroke='#ef4444' stroke-width='2'/>
                    </svg>
                `;
                return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${targetHalf} ${targetHalf}, crosshair`;
            }

            // Path Eraser: White circle
            const svg = `
                <svg xmlns='http://www.w3.org/2000/svg' width='${eraserSize}' height='${eraserSize}' viewBox='0 0 ${eraserSize} ${eraserSize}'>
                    <circle cx='${half}' cy='${half}' r='${Math.max(1, half - 1)}' fill='rgba(255, 255, 255, 0.5)' stroke='#333' stroke-width='1.5'/>
                </svg>
            `;
            return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${half} ${half}, auto`;
        }

        // Shape Tools
        if (['rectangle', 'circle', 'text'].includes(activeTool)) {
            return 'crosshair';
        }

        return 'default';
    };

    return (
        <div className="absolute inset-0 z-10 pointer-events-auto" style={{ cursor: getCursorStyle() }}>
            <Stage
                width={width}
                height={height}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchStart={handleMouseDown}
                onTouchMove={handleMouseMove}
                onTouchEnd={handleMouseUp}
                scaleX={scale}
                scaleY={scale}
            >
                <Layer>
                    {/* 1. Render Paths (Drawings) */}
                    {/* 1. Legacy Paths (Deprecated - New paths are objects) */}
                    {/* {page.paths.map((path, i) => (
                        <Line
                            key={path.id || i}
                            points={path.points}
                            stroke={path.stroke}
                            strokeWidth={path.strokeWidth}
                            tension={0.5}
                            lineCap="round"
                            lineJoin="round"
                            opacity={path.opacity}
                            globalCompositeOperation="source-over"
                        />
                    ))} */}

                    {/* 2. Render Current Drawing Path */}
                    {isDrawing && currentPath.length > 0 && (
                        <Line
                            points={currentPath}
                            stroke={activeTool === 'eraser' ? '#ffffff' : toolSettings.color}
                            strokeWidth={toolSettings.size}
                            tension={0.5}
                            lineCap="round"
                            lineJoin="round"
                            opacity={activeTool === 'highlighter' ? (toolSettings.opacity || 0.5) : 1}
                            globalCompositeOperation="source-over"
                        />
                    )}

                    {/* 2.5 Render Current Dragging Shape Preview */}
                    {isDrawing && currentShape && ['rectangle', 'circle'].includes(activeTool) && (
                        <PDFObjectRenderer
                            object={{
                                id: 'preview',
                                type: activeTool as any,
                                x: shapeStartPos!.x + (currentShape.width < 0 ? currentShape.width : 0), // Adjust for render logic
                                y: shapeStartPos!.y + (currentShape.height < 0 ? currentShape.height : 0),
                                width: Math.abs(currentShape.width),
                                height: Math.abs(currentShape.height),
                                stroke: toolSettings.color,
                                strokeWidth: 2,
                                fill: 'rgba(59, 130, 246, 0.1)' // Light blue transparent fill for preview
                            } as any}
                            isSelected={false}
                            onSelect={() => { }}
                            onChange={() => { }}
                        />
                    )}

                    {/* Wait, we are inside Canvas Layer which uses Konva Stage.
                        We can't render HTML divs inside Konva Layer easily unless using Html component or separate overlay.
                        Better to render a Konva Rect!
                    */}
                    {selectionRect && (
                        <React.Fragment>
                            <Line
                                points={[
                                    selectionRect.x, selectionRect.y,
                                    selectionRect.x + selectionRect.width, selectionRect.y,
                                    selectionRect.x + selectionRect.width, selectionRect.y + selectionRect.height,
                                    selectionRect.x, selectionRect.y + selectionRect.height,
                                    selectionRect.x, selectionRect.y
                                ]}
                                stroke="#3b82f6"
                                strokeWidth={1}
                                closed
                                fill="rgba(59, 130, 246, 0.1)"
                            />
                        </React.Fragment>
                    )}

                    {/* 3. Render Objects (Text, Shapes, Images) */}
                    {page.objects.map((obj) => {
                        // Allow interactions in Select mode OR Element Eraser mode
                        const eraserMode = usePDFStore.getState().eraserMode;
                        const isElementEraser = activeTool === 'eraser' && eraserMode === 'element';
                        const isInteractionEnabled = activeTool === 'select' || isElementEraser;

                        return (
                            <PDFObjectRenderer
                                key={obj.id}
                                object={obj}
                                isSelected={selectedObjectIds.includes(obj.id)}
                                onSelect={() => {
                                    // In Element Eraser mode, clicking should delete, not select
                                    if (isElementEraser) {
                                        usePDFStore.getState().deleteObjects([obj.id]);
                                    } else {
                                        selectObject(obj.id, false);
                                    }
                                }}
                                onChange={(updates) => updateObject(pageId, obj.id, updates)}
                                isLocked={false}
                                isSelectionEnabled={isInteractionEnabled}
                            />
                        );
                    })}
                </Layer>
            </Stage>
        </div>
    );
};

