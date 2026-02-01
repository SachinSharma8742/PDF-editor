import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line, Transformer, Rect } from 'react-konva';
import { useEditorStore } from '../../../store/editorStore';
import { usePDFStore } from '../../../store/pdfStore'; // Need this for the PDF Document source
import { PDFObjectRenderer } from './PDFObjectRenderer';
import { Loader2 } from 'lucide-react';
import type { PDFObject } from '../../../store/pdfStore';

export const EditorCanvas: React.FC = () => {
    // Editor State
    const {
        currentPage,
        scale,
        activeTool,
        toolPreferences,
        selectedObjectIds,
        selectObject,
        selectObjects,
        updateObject,
        deleteObjects,
        addPath,
        addObject,
        setActiveTool
    } = useEditorStore();

    // PDF Global State (Source)
    const { pdfDocument } = usePDFStore();

    // Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const stageRef = useRef<any>(null);
    const transformerRef = useRef<any>(null);
    // Track Drag State for Multi-move
    const isDraggingRef = useRef(false);
    const dragStartPosRef = useRef<{ x: number, y: number } | null>(null);

    // Local State
    const [rendering, setRendering] = useState(false);
    const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

    // Drawing State (Local to component for interactions)
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPath, setCurrentPath] = useState<number[]>([]);
    const [shapeStartPos, setShapeStartPos] = useState<{ x: number; y: number } | null>(null);
    const [currentShape, setCurrentShape] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

    // Area Selection State
    const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
    const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

    const toolSettings = toolPreferences[activeTool];

    // --- Multi-Selection Overlay Logic (Computed) ---
    const selectionBounds = React.useMemo(() => {
        if (!currentPage || selectedObjectIds.length <= 1) return null;

        const objects = currentPage.objects.filter(o => selectedObjectIds.includes(o.id));
        if (objects.length === 0) return null;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        objects.forEach(obj => {
            let x = obj.x;
            let y = obj.y;
            let w = obj.width || 0;
            let h = obj.height || 0;

            if (obj.type === 'path' && (!obj.width || obj.width === 0) && obj.points) {
                const xs = obj.points.filter((_, i) => i % 2 === 0);
                const ys = obj.points.filter((_, i) => i % 2 === 1);
                if (xs.length > 0) {
                    const mx = Math.min(...xs);
                    const my = Math.min(...ys);
                    w = Math.max(...xs) - mx;
                    h = Math.max(...ys) - my;
                    if (x === undefined || x === 0) {
                        x = mx;
                        y = my;
                    }
                }
            }

            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x + w > maxX) maxX = x + w;
            if (y + h > maxY) maxY = y + h;
        });

        if (minX === Infinity) return null;

        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }, [selectedObjectIds, currentPage?.objects]);


    // --- PDF Rendering ---
    useEffect(() => {
        if (!currentPage || currentPage.source !== 'pdf') return;

        let renderTask: any = null;
        let isCancelled = false;

        const renderPage = async () => {
            const indexToFetch = currentPage.originalPageIndex;
            // Allow 0 index
            if (!pdfDocument || indexToFetch === undefined || indexToFetch === null) return;

            setRendering(true);
            try {
                const page = await pdfDocument.getPage(indexToFetch);
                if (isCancelled) return;

                const viewport = page.getViewport({ scale });
                const outputScale = window.devicePixelRatio || 1;
                const cssWidth = Math.floor(viewport.width);
                const cssHeight = Math.floor(viewport.height);

                // Set dimensions if not set or changed (triggers re-render to mount canvas)
                if (!dimensions || dimensions.width !== cssWidth || dimensions.height !== cssHeight) {
                    setDimensions({ width: cssWidth, height: cssHeight });
                    // We return here because we need the re-render to create the canvas with new dimensions
                    return;
                }

                // If dimensions match, canvas should exist now
                const canvas = canvasRef.current;
                if (!canvas) return;

                const context = canvas.getContext('2d');
                if (!context) return;

                canvas.width = Math.floor(viewport.width * outputScale);
                canvas.height = Math.floor(viewport.height * outputScale);
                canvas.style.width = cssWidth + "px";
                canvas.style.height = cssHeight + "px";

                const transform = outputScale !== 1
                    ? [outputScale, 0, 0, outputScale, 0, 0]
                    : undefined;

                const renderContext = {
                    canvasContext: context,
                    transform: transform,
                    viewport: viewport,
                };

                renderTask = page.render(renderContext);
                await renderTask.promise;
            } catch (error: any) {
                if (error.name !== 'RenderingCancelledException') {
                    console.error('Error rendering page:', error);
                }
            } finally {
                if (!isCancelled) setRendering(false);
            }
        };

        renderPage();

        return () => {
            isCancelled = true;
            if (renderTask) renderTask.cancel();
        };
    }, [pdfDocument, currentPage?.originalPageIndex, scale, dimensions?.width, dimensions?.height]);

    // Dimensions for Non-PDF sources (e.g. Blank page)
    useEffect(() => {
        if (!currentPage) return;
        if (currentPage.source !== 'pdf') {
            setDimensions({
                width: currentPage.width * scale,
                height: currentPage.height * scale
            });
        }
    }, [currentPage, scale]);

    // --- Transformer Sync Logic for Multi-Select ---
    useEffect(() => {
        if (!transformerRef.current || !stageRef.current) return;

        // Find nodes for all selected IDs
        const nodes = selectedObjectIds
            .map(id => stageRef.current.findOne('#' + id))
            .filter(node => node !== undefined);

        if (nodes.length > 0) {
            transformerRef.current.nodes(nodes);
            transformerRef.current.getLayer().batchDraw();
        } else {
            transformerRef.current.nodes([]);
            transformerRef.current.getLayer().batchDraw();
        }
    }, [selectedObjectIds]);


    if (!currentPage || !dimensions) return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

    const handleMouseDown = (e: any) => {
        const stage = e.target.getStage();
        const pos = stage.getPointerPosition();
        if (!pos) return;

        const scaledX = pos.x / scale;
        const scaledY = pos.y / scale;

        // 1. Clicked on Empty Stage / Deselect
        if (e.target === stage) {
            if (activeTool === 'select') {
                setSelectionStart({ x: scaledX, y: scaledY });
                setSelectionRect({ x: scaledX, y: scaledY, width: 0, height: 0 });
                selectObjects([]);
                return;
            }
            selectObjects([]);
        }

        // 2. Drawing Tools
        const drawingTools = ['pen', 'highlighter', 'eraser'];
        if (drawingTools.includes(activeTool)) {
            setIsDrawing(true);
            setCurrentPath([scaledX, scaledY]);
            return;
        }

        // 3. Shape Tools
        if (['rectangle', 'circle', 'text'].includes(activeTool)) {
            setIsDrawing(true);
            setShapeStartPos({ x: scaledX, y: scaledY });
            setCurrentShape({ x: scaledX, y: scaledY, width: 0, height: 0 });
        }
    };

    const handleMouseMove = (e: any) => {
        const stage = e.target.getStage();
        const point = stage.getPointerPosition();
        if (!point) return;

        const scaledX = point.x / scale;
        const scaledY = point.y / scale;

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

        // Freehand
        if (['pen', 'highlighter', 'eraser'].includes(activeTool)) {
            setCurrentPath(prev => [...prev, scaledX, scaledY]);
            return;
        }

        // Shape
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
        // Finalize Area Selection
        if (selectionStart && selectionRect) {
            const selectedIds: string[] = [];
            const rect = selectionRect;

            currentPage.objects.forEach(obj => {
                // Skip locked objects - they cannot be selected
                if (obj.isLocked) return;

                const objRight = obj.x + (obj.width || 0);
                const objBottom = obj.y + (obj.height || 0);
                const rectRight = rect.x + rect.width;
                const rectBottom = rect.y + rect.height;

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
                selectObjects(selectedIds);
            } else {
                selectObjects([]);
            }

            setSelectionStart(null);
            setSelectionRect(null);
            return;
        }

        if (!isDrawing) return;

        // Finalize Freehand
        if (['pen', 'highlighter', 'eraser'].includes(activeTool) && currentPath.length > 0) {
            // Normalize Path: Calculate bounds to set X/Y and make points relative
            const xs = currentPath.filter((_, i) => i % 2 === 0);
            const ys = currentPath.filter((_, i) => i % 2 === 1);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            const width = maxX - minX;
            const height = maxY - minY;

            // Normalize points relative to minX, minY
            const normalizedPoints = currentPath.map((val, i) => {
                return i % 2 === 0 ? val - minX : val - minY;
            });

            addPath({
                id: crypto.randomUUID(),
                x: minX,
                y: minY,
                width: width,
                height: height,
                points: normalizedPoints,
                stroke: activeTool === 'eraser' ? '#ffffff' : toolSettings.color,
                strokeWidth: toolSettings.size,
                tool: activeTool as any,
                opacity: activeTool === 'highlighter' ? (toolSettings.opacity || 0.5) : 1,
                rotation: 0
            });
        }

        // Finalize Shape
        if (['rectangle', 'circle', 'text'].includes(activeTool) && shapeStartPos) {
            const width = currentShape ? currentShape.width : 0;
            const height = currentShape ? currentShape.height : 0;
            const isClick = Math.abs(width) < 5 && Math.abs(height) < 5;

            const finalX = width < 0 ? shapeStartPos.x + width : shapeStartPos.x;
            const finalY = height < 0 ? shapeStartPos.y + height : shapeStartPos.y;
            const finalW = isClick ? 100 : Math.abs(width);
            const finalH = isClick ? 100 : Math.abs(height);

            if (activeTool === 'text') {
                addObject({
                    id: crypto.randomUUID(),
                    type: 'text',
                    x: finalX,
                    y: finalY,
                    text: '', // Start empty for new text
                    fill: toolSettings.color,
                    fontSize: toolSettings.fontSize || 24, // Slightly larger default
                    fontFamily: toolSettings.fontFamily || 'Inter',
                    width: Math.max(200, finalW),
                    height: 100, // Taller default for editing
                    rotation: 0,
                    isNew: true // Signal PDFObjectRenderer to enter edit mode
                });
            } else {
                addObject({
                    id: crypto.randomUUID(),
                    type: activeTool as any,
                    x: finalX,
                    y: finalY,
                    width: finalW,
                    height: finalH,
                    stroke: toolSettings.color,
                    strokeWidth: 2,
                    fill: 'transparent',
                    rotation: 0
                });
            }
            setActiveTool('select');
        }

        setIsDrawing(false);
        setCurrentPath([]);
        setShapeStartPos(null);
        setCurrentShape(null);
    };

    // --- TRANSFORM & DRAG LOGIC ---

    // Drag Start: Capture initial positions for delta calculation
    const handleDragStartGlobal = (e: any) => {
        const id = e.target.id();
        if (selectedObjectIds.includes(id)) {
            isDraggingRef.current = true;
            // No need to store positions, we calculate based on the driven node's absolute change?
            // Actually, for multi-drag, it's safer to just let Konva move the dragged node,
            // and we manually move the *other* selected nodes by the same delta.
            dragStartPosRef.current = { x: e.target.x(), y: e.target.y() };
        }
    };

    // Drag Move: Move all OTHER selected objects
    const handleDragMoveGlobal = (e: any) => {
        if (!isDraggingRef.current || !dragStartPosRef.current) return;

        const id = e.target.id();
        // Ensure we are dragging a selected object
        if (!selectedObjectIds.includes(id)) return;

        const newPos = { x: e.target.x(), y: e.target.y() };
        const dx = newPos.x - dragStartPosRef.current.x;
        const dy = newPos.y - dragStartPosRef.current.y;

        // Update the ref so next move is relative to this one
        dragStartPosRef.current = newPos;

        // Move all OTHER selected objects
        selectedObjectIds.forEach(objId => {
            if (objId !== id) {
                const node = stageRef.current.findOne('#' + objId);
                if (node) {
                    node.x(node.x() + dx);
                    node.y(node.y() + dy);
                }
            }
        });

        // Force batch draw to smooth animation
        stageRef.current.batchDraw();
    };

    const handleDragEndGlobal = (e: any) => {
        isDraggingRef.current = false;
        dragStartPosRef.current = null;

        const id = e.target.id();
        // If we just finished dragging a selected object, we need to sync ALL positions to store
        if (selectedObjectIds.includes(id)) {
            // Iterate all selected IDs and update their positions from the Konva nodes
            selectedObjectIds.forEach(objId => {
                const node = stageRef.current.findOne('#' + objId);
                if (node) {
                    // Node position is center-based (due to offset), convert back to top-left
                    const offsetX = node.offsetX() || 0;
                    const offsetY = node.offsetY() || 0;
                    updateObject(objId, {
                        x: node.x() - offsetX,
                        y: node.y() - offsetY
                    });
                }
            });
        }
    };

    const handleTransformEnd = () => {
        selectedObjectIds.forEach(id => {
            const node = stageRef.current.findOne('#' + id);
            if (node) {
                const scaleX = node.scaleX();
                const scaleY = node.scaleY();

                // Find object to determine type and current dimensions
                const object = currentPage.objects.find(o => o.id === id);
                if (!object) return;

                // Calculate new width/height
                const oldWidth = object.width || 0;
                const oldHeight = object.height || 0;
                const newWidth = oldWidth * scaleX;
                const newHeight = oldHeight * scaleY;

                // The node position is center-based (due to offsetX/Y in PDFObjectRenderer)
                // node.x() = original_x + oldWidth/2
                // After scaling, the offset changes to newWidth/2
                // So: new_x = node.x() - newWidth/2
                const newX = node.x() - newWidth / 2;
                const newY = node.y() - newHeight / 2;

                // Reset node scale to avoid compounding
                node.scaleX(1);
                node.scaleY(1);

                // Get rotation
                const rotation = node.rotation();

                const updates: any = {
                    x: newX,
                    y: newY,
                    rotation: rotation
                };

                if (object.type === 'path' && object.points) {
                    // Scale the path points
                    const newPoints = object.points.map((val, i) => {
                        return i % 2 === 0 ? val * scaleX : val * scaleY;
                    });
                    updates.points = newPoints;
                    updates.width = newWidth;
                    updates.height = newHeight;
                } else if (object.type === 'text') {
                    updates.fontSize = (object.fontSize || 16) * scaleY;
                    updates.width = newWidth;
                    updates.height = newHeight;
                } else {
                    updates.width = newWidth;
                    updates.height = newHeight;
                }

                updateObject(id, updates);
            }
        });
    };

    // --- Multi-Selection Overlay Logic ---

    const handleOverlayDragStart = (e: any) => {
        isDraggingRef.current = true;
        dragStartPosRef.current = { x: e.target.x(), y: e.target.y() };
    };

    const handleOverlayDragMove = (e: any) => {
        if (!isDraggingRef.current || !dragStartPosRef.current) return;

        const newPos = { x: e.target.x(), y: e.target.y() };
        const dx = newPos.x - dragStartPosRef.current.x;
        const dy = newPos.y - dragStartPosRef.current.y;

        dragStartPosRef.current = newPos;

        // Move ALL selected objects
        selectedObjectIds.forEach(objId => {
            const node = stageRef.current.findOne('#' + objId);
            if (node) {
                node.x(node.x() + dx);
                node.y(node.y() + dy);
            }
        });

        stageRef.current.batchDraw();
    };

    const handleOverlayDragEnd = (e: any) => {
        isDraggingRef.current = false;
        dragStartPosRef.current = null;

        // Sync all to store
        selectedObjectIds.forEach(objId => {
            const node = stageRef.current.findOne('#' + objId);
            if (node) {
                // Convert from center-based position to top-left for storage
                const offsetX = node.offsetX() || 0;
                const offsetY = node.offsetY() || 0;
                updateObject(objId, {
                    x: node.x() - offsetX,
                    y: node.y() - offsetY
                });
            }
        });

        // Reset overlay position to match the new bounds on next render
        // Actually, React will re-render and set x/y of Rect.
        // Konva might keep the dragged offset? 
        // We might need to manually reset Scale/Rotation if we supported it, but for Drag x/y it usually snaps back to props.
        // But to be safe, we can reset:
        e.target.position({ x: selectionBounds?.x || 0, y: selectionBounds?.y || 0 });
        // Wait, if we reset it NOW, it might visually jump before React updates?
        // Better to let React update props.
    };

    // --- CURSOR LOGIC ---
    const getCursorStyle = () => {
        const color = toolSettings.color || '#000000';
        const size = Math.max(toolSettings.size || 2, 4);

        if (activeTool === 'pen') {
            const cursorSize = Math.max(16, size + 8);
            const center = cursorSize / 2;
            const radius = Math.max(2, size / 2);
            const svg = `
                <svg xmlns='http://www.w3.org/2000/svg' width='${cursorSize}' height='${cursorSize}' viewBox='0 0 ${cursorSize} ${cursorSize}'>
                    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="rgba(0,0,0,0.3)"/>
                    </filter>
                    <circle cx='${center}' cy='${center}' r='${radius}' fill='${color}' stroke='white' stroke-width='1.5' filter="url(#shadow)"/>
                </svg>
            `;
            return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${center} ${center}, crosshair`;
        }

        if (activeTool === 'highlighter') {
            const h = Math.max(14, size);
            const svgWidth = 32; const svgHeight = 32;
            const svg = `
                <svg xmlns='http://www.w3.org/2000/svg' width='${svgWidth}' height='${svgHeight}' viewBox='0 0 ${svgWidth} ${svgHeight}'>
                    <rect x="12" y="${16 - h / 2}" width="8" height="${h}" rx="2" fill="${color}" stroke="white" stroke-width="1.5" transform="rotate(-45 16 16)" opacity="0.8"/>
                </svg>
            `;
            return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 16 16, crosshair`;
        }

        if (activeTool === 'eraser') {
            const s = Math.max(12, size);
            const svg = `
                 <svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}' viewBox='0 0 ${s} ${s}'>
                     <circle cx='${s / 2}' cy='${s / 2}' r='${s / 2 - 1}' fill='white' stroke='black' stroke-width='1'/>
                 </svg>
             `;
            return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${s / 2} ${s / 2}, crosshair`;
        }

        if (activeTool === 'text') return 'text';
        if (['rectangle', 'circle'].includes(activeTool)) return 'crosshair';

        return 'default';
    }

    // Get background color - for blank pages use their custom color, otherwise white
    const pageBackgroundColor = currentPage.source === 'blank'
        ? (currentPage.backgroundColor || '#ffffff')
        : '#ffffff';

    return (
        <div
            className="shadow-2xl relative my-10"
            style={{
                width: dimensions.width,
                height: dimensions.height,
                cursor: getCursorStyle(),
                backgroundColor: pageBackgroundColor
            }}
        >
            {/* Background Layer: PDF Render */}
            {currentPage.source === 'pdf' && (
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 z-0 pointer-events-none"
                    style={{ width: dimensions.width, height: dimensions.height }}
                />
            )}

            {/* Editing Layer: Konva Stage */}
            <div className="absolute inset-0 z-10">
                <Stage
                    ref={stageRef}
                    width={dimensions.width}
                    height={dimensions.height}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onDragStart={handleDragStartGlobal}
                    onDragMove={handleDragMoveGlobal}
                    onDragEnd={handleDragEndGlobal}
                    scaleX={scale}
                    scaleY={scale}
                >
                    <Layer>


                        {/* 2. Drawing Path */}
                        {isDrawing && currentPath.length > 0 && (
                            <Line
                                points={currentPath}
                                stroke={activeTool === 'eraser' ? '#ffffff' : toolSettings.color}
                                strokeWidth={toolSettings.size}
                                tension={0.5}
                                lineCap="round"
                                lineJoin="round"
                                opacity={activeTool === 'highlighter' ? (toolSettings.opacity || 0.5) : 1}
                            />
                        )}

                        {/* 2.5 Shape Preview */}
                        {isDrawing && currentShape && ['rectangle', 'circle'].includes(activeTool) && (
                            <PDFObjectRenderer
                                object={{
                                    id: 'preview',
                                    type: activeTool as any,
                                    x: shapeStartPos!.x + (currentShape.width < 0 ? currentShape.width : 0),
                                    y: shapeStartPos!.y + (currentShape.height < 0 ? currentShape.height : 0),
                                    width: Math.abs(currentShape.width),
                                    height: Math.abs(currentShape.height),
                                    stroke: toolSettings.color,
                                    strokeWidth: 2,
                                    fill: 'rgba(59, 130, 246, 0.1)',
                                    rotation: 0
                                }}
                                isSelected={false}
                                onSelect={() => { }}
                                onChange={() => { }}
                            />
                        )}

                        {/* 2.6 Selection Rect */}
                        {selectionRect && (
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
                        )}

                        {/* 3. Objects */}
                        {currentPage.objects.map((obj) => (
                            <PDFObjectRenderer
                                key={obj.id}
                                object={obj}
                                isSelected={selectedObjectIds.includes(obj.id)}
                                onSelect={(e: any) => {
                                    if (activeTool === 'eraser' && toolSettings.eraserMode === 'object') {
                                        deleteObjects([obj.id]);
                                    } else if (activeTool === 'select') {
                                        // Handle Shift+Click for multi-select
                                        const isMulti = e?.evt?.shiftKey === true;
                                        selectObject(obj.id, isMulti);
                                    }
                                }}
                                onChange={(updates) => updateObject(obj.id, updates)}
                                isLocked={obj.isLocked}
                                isSelectionEnabled={activeTool === 'select' || (activeTool === 'eraser' && toolSettings.eraserMode === 'object')}
                            />
                        ))}

                        {/* 3.5 Multi-Select Overlay (Draggable Empty Space) */}
                        {selectionBounds && activeTool === 'select' && (
                            <Rect
                                id="selection-overlay"
                                x={selectionBounds.x}
                                y={selectionBounds.y}
                                width={selectionBounds.width}
                                height={selectionBounds.height}
                                fill="transparent" // Transparent but clickable
                                draggable
                                onDragStart={handleOverlayDragStart}
                                onDragMove={handleOverlayDragMove}
                                onDragEnd={handleOverlayDragEnd}
                                // Ensure cursor indicates move availability
                                onMouseEnter={(e) => {
                                    const container = e.target.getStage()?.container();
                                    if (container) container.style.cursor = 'move';
                                }}
                                onMouseLeave={(e) => {
                                    const container = e.target.getStage()?.container();
                                    if (container) container.style.cursor = 'default';
                                }}
                            />
                        )}

                        {/* Global Transformer */}
                        <Transformer
                            ref={transformerRef}
                            borderStroke="#3b82f6"
                            borderStrokeWidth={1}
                            anchorFill="white"
                            anchorStroke="#3b82f6"
                            anchorStrokeWidth={1.5}
                            anchorSize={8}
                            anchorCornerRadius={10}
                            rotateEnabled={true}
                            rotateAnchorOffset={30}
                            rotateAnchorCursor="grab"
                            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
                            rotationSnapTolerance={5}
                            anchorStyleFunc={(anchor) => {
                                // Make rotation anchor bigger and styled differently
                                if (anchor.hasName('rotater')) {
                                    anchor.fill('#3b82f6');
                                    anchor.stroke('#ffffff');
                                    anchor.strokeWidth(2);
                                    anchor.width(12);
                                    anchor.height(12);
                                    anchor.offsetX(6);
                                    anchor.offsetY(6);
                                }
                            }}
                            boundBoxFunc={(oldBox, newBox) => {
                                if (newBox.width < 5 || newBox.height < 5) return oldBox;
                                return newBox;
                            }}
                            onTransformEnd={handleTransformEnd}
                        />
                    </Layer>
                </Stage>
            </div>

            {/* Simple Loading Indicator */}
            {rendering && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-20">
                    <Loader2 className="animate-spin text-blue-600" size={32} />
                </div>
            )}
        </div>
    );
};
