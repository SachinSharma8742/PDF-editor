import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line, Transformer, Rect, Group } from 'react-konva';
import { useEditorStore } from '../../../store/editorStore';
import { usePDFStore } from '../../../store/pdfStore'; // Need this for the PDF Document source
import { PDFObjectRenderer } from './PDFObjectRenderer';
import { CropOverlay } from './CropOverlay';
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

                // Use the stored rotation (0, 90, 180, 270)
                const rotation = (currentPage.rotation || 0) + (page.rotate || 0); // Combine intrinsic + user rotation
                const viewport = page.getViewport({ scale, rotation: rotation % 360 });
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
    }, [pdfDocument, currentPage?.originalPageIndex, scale, dimensions?.width, dimensions?.height, currentPage?.rotation]);

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

        // 3. Shape Tools (Expanded)
        // We treat 'ocr' and 'measure' like shapes (region selection / line)
        const shapeTools = ['rectangle', 'circle', 'triangle', 'star', 'polygon', 'ellipse', 'line', 'arrow', 'text', 'ocr', 'measure'];
        if (shapeTools.includes(activeTool)) {
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

        // Shape Preview
        const shapeTools = ['rectangle', 'circle', 'triangle', 'star', 'polygon', 'ellipse', 'line', 'arrow', 'text', 'ocr', 'measure'];
        if (shapeTools.includes(activeTool) && shapeStartPos) {
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

        // Finalize Shape / Tool Action
        const shapeTools = ['rectangle', 'circle', 'triangle', 'star', 'polygon', 'ellipse', 'line', 'arrow', 'text', 'ocr', 'measure'];
        if (shapeTools.includes(activeTool) && shapeStartPos) {
            const width = currentShape ? currentShape.width : 0;
            const height = currentShape ? currentShape.height : 0;
            const isClick = Math.abs(width) < 5 && Math.abs(height) < 5;

            const finalX = width < 0 ? shapeStartPos.x + width : shapeStartPos.x;
            const finalY = height < 0 ? shapeStartPos.y + height : shapeStartPos.y;
            const finalW = isClick ? 100 : Math.abs(width);
            const finalH = isClick ? 100 : Math.abs(height);

            if (activeTool === 'ocr') {
                // Trigger OCR for the selected region
                // checking for a specialized store action or just creating a highlight for now
                // Ideally, we'd call an OCR function here. For now, create a highlight rect.
                addObject({
                    id: crypto.randomUUID(), type: 'rectangle', x: finalX, y: finalY, width: finalW, height: finalH,
                    fill: 'rgba(255, 255, 0, 0.2)', stroke: 'transparent', rotation: 0
                });
                // TODO: Dispatch actual OCR action
            } else if (activeTool === 'text') {
                addObject({
                    id: crypto.randomUUID(),
                    type: 'text',
                    x: finalX,
                    y: finalY,
                    text: 'Double click to edit', // Placeholder
                    fill: toolSettings.color,
                    fontSize: toolSettings.fontSize || 24,
                    fontFamily: toolSettings.fontFamily || 'Inter',
                    width: Math.max(200, finalW),
                    height: 50,
                    rotation: 0,
                    isNew: true
                });
            } else {
                // Shapes & Measure
                const isVector = ['line', 'arrow', 'measure'].includes(activeTool);

                addObject({
                    id: crypto.randomUUID(),
                    type: activeTool as any,
                    x: finalX,
                    y: finalY,
                    width: finalW,
                    height: finalH,
                    stroke: toolSettings.color,
                    strokeWidth: 2,
                    fill: isVector ? 'transparent' : 'transparent',
                    points: isVector ? [
                        shapeStartPos.x - finalX,
                        shapeStartPos.y - finalY,
                        shapeStartPos.x + width - finalX,
                        shapeStartPos.y + height - finalY
                    ] : undefined,
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

    // Force batch draw to smooth animation


    const snapValue = (val: number, gridSize: number) => {
        return Math.round(val / gridSize) * gridSize;
    };

    const handleDragMoveGlobal = (e: any) => {
        if (!isDraggingRef.current || !dragStartPosRef.current) return;

        const id = e.target.id();
        // Ensure we are dragging a selected object
        if (!selectedObjectIds.includes(id)) return;

        const { gridSize, snapToGrid } = useEditorStore.getState();

        // Calculate raw new position
        let newX = e.target.x();
        let newY = e.target.y();

        // Snap logic: Snap the DRAGGED object's top-left corner
        if (snapToGrid) {
            // Adjust for offset if needed, but usually we drag by node position
            newX = snapValue(newX, gridSize);
            newY = snapValue(newY, gridSize);

            // Constrain the dragged node visually to the snap grid
            e.target.x(newX);
            e.target.y(newY);
        }

        const newPos = { x: newX, y: newY };
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
        if (!stageRef.current) return;

        selectedObjectIds.forEach(id => {
            const node = stageRef.current.findOne('#' + id);
            if (node) {
                const scaleX = node.scaleX();
                const scaleY = node.scaleY();

                // Find object to determine type and current dimensions
                const object = currentPage.objects.find(o => o.id === id);
                if (!object) return;

                // Help resolve dimensions if they are missing (for paths/lines)
                let oldWidth = object.width || 0;
                let oldHeight = object.height || 0;

                if ((!oldWidth || !oldHeight) && object.points) {
                    const xs = object.points.filter((_, i) => i % 2 === 0);
                    const ys = object.points.filter((_, i) => i % 2 === 1);
                    if (xs.length > 0) {
                        const minX = Math.min(...xs);
                        const maxX = Math.max(...xs);
                        const minY = Math.min(...ys);
                        const maxY = Math.max(...ys);
                        oldWidth = maxX - minX;
                        oldHeight = maxY - minY;
                    }
                }

                // Calculate new width/height
                const newWidth = Math.max(5, oldWidth * scaleX);
                const newHeight = Math.max(5, oldHeight * scaleY);

                // The node position is center-based (due to offsetX/Y in PDFObjectRenderer)
                const newX = node.x() - newWidth / 2;
                const newY = node.y() - newHeight / 2;

                // Reset node scale to avoid compounding
                node.scaleX(1);
                node.scaleY(1);

                const updates: any = {
                    x: newX,
                    y: newY,
                    width: newWidth,
                    height: newHeight,
                    rotation: node.rotation()
                };

                // Scaling points for all vector types is CRITICAL for non-uniform stretching
                const vectorTypes = ['path', 'line', 'arrow', 'measure'];
                if (vectorTypes.includes(object.type) && object.points) {
                    updates.points = object.points.map((val, i) => {
                        return i % 2 === 0 ? val * scaleX : val * scaleY;
                    });
                } else if (object.type === 'text') {
                    // For text, we usually want to adjust font size if scaled vertically
                    // but maintain independent width/height for wrapping
                    updates.fontSize = (object.fontSize || 16) * scaleY;
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
            id="editor-workspace"
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
                    style={{
                        width: dimensions.width,
                        height: dimensions.height,
                        filter: currentPage.pageFilters ?
                            `brightness(${currentPage.pageFilters.brightness}) 
                             contrast(${currentPage.pageFilters.contrast}) 
                             grayscale(${currentPage.pageFilters.grayscale}) 
                             sepia(${currentPage.pageFilters.sepia}) 
                             invert(${currentPage.pageFilters.invert})
                             blur(${currentPage.pageFilters.blur}px)`
                            : 'none',
                        transform: `scale(${currentPage.flipX ? -1 : 1}, ${currentPage.flipY ? -1 : 1})`
                    }}
                />
            )}

            {/* Page Background Overlay */}
            {currentPage.pageBackground && (
                <div
                    className="absolute inset-0 z-0 pointer-events-none mix-blend-multiply transition-colors duration-300"
                    style={{
                        backgroundColor: currentPage.pageBackground.color,
                        opacity: currentPage.pageBackground.opacity
                    }}
                />
            )}

            {/* Editing Layer: Konva Stage */}
            <div className="absolute inset-0 z-10">
                <Stage
                    ref={stageRef}
                    width={dimensions.width}
                    height={dimensions.height}
                    scaleX={scale * (currentPage.flipX ? -1 : 1)}
                    scaleY={scale * (currentPage.flipY ? -1 : 1)}
                    x={currentPage.flipX ? dimensions.width : 0}
                    y={currentPage.flipY ? dimensions.height : 0}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onDragStart={handleDragStartGlobal}
                    onDragMove={handleDragMoveGlobal}
                    onDragEnd={handleDragEndGlobal}
                >
                    <Layer>
                        {/* 0. Grid Layer */}
                        {useEditorStore.getState().snapToGrid && dimensions && (
                            <Group>
                                {/* Vertical Lines */}
                                {Array.from({ length: Math.ceil(dimensions.width / useEditorStore.getState().gridSize) }).map((_, i) => (
                                    <Line
                                        key={`v-${i}`}
                                        points={[i * useEditorStore.getState().gridSize, 0, i * useEditorStore.getState().gridSize, dimensions.height]}
                                        stroke="rgba(255, 255, 255, 0.1)"
                                        strokeWidth={1}
                                    />
                                ))}
                                {/* Horizontal Lines */}
                                {Array.from({ length: Math.ceil(dimensions.height / useEditorStore.getState().gridSize) }).map((_, i) => (
                                    <Line
                                        key={`h-${i}`}
                                        points={[0, i * useEditorStore.getState().gridSize, dimensions.width, i * useEditorStore.getState().gridSize]}
                                        stroke="rgba(255, 255, 255, 0.1)"
                                        strokeWidth={1}
                                    />
                                ))}
                            </Group>
                        )}


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
                        {isDrawing && currentShape && shapeStartPos && (
                            (() => {
                                const shapeTools = ['rectangle', 'circle', 'triangle', 'star', 'polygon', 'ellipse', 'line', 'arrow', 'measure'];
                                if (!shapeTools.includes(activeTool)) return null;

                                const width = currentShape.width;
                                const height = currentShape.height;
                                const finalX = width < 0 ? shapeStartPos.x + width : shapeStartPos.x;
                                const finalY = height < 0 ? shapeStartPos.y + height : shapeStartPos.y;
                                const finalW = Math.abs(width);
                                const finalH = Math.abs(height);
                                const isVector = ['line', 'arrow', 'measure'].includes(activeTool);

                                return (
                                    <PDFObjectRenderer
                                        object={{
                                            id: 'preview',
                                            type: activeTool as any,
                                            x: finalX,
                                            y: finalY,
                                            width: finalW,
                                            height: finalH,
                                            stroke: toolSettings.color,
                                            strokeWidth: 2,
                                            fill: isVector ? 'transparent' : 'rgba(59, 130, 246, 0.1)',
                                            points: isVector ? [
                                                shapeStartPos.x - finalX,
                                                shapeStartPos.y - finalY,
                                                shapeStartPos.x + width - finalX,
                                                shapeStartPos.y + height - finalY
                                            ] : undefined,
                                            rotation: 0
                                        }}
                                        isSelected={false}
                                        onSelect={() => { }}
                                        onChange={() => { }}
                                    />
                                );
                            })()
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
                                object={{
                                    ...obj,
                                    visible: obj.visible !== false && !(useEditorStore.getState().isCropping && selectedObjectIds.includes(obj.id))
                                }}
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

                        {/* 3.6 Crop Overlay */}
                        {selectedObjectIds.length === 1 && useEditorStore.getState().isCropping && (
                            <CropOverlay objectId={selectedObjectIds[0]} />
                        )}

                        {/* Global Transformer */}
                        {!useEditorStore.getState().isCropping && (
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
                                keepRatio={false}
                                ignoreStroke={true}
                                centeredScaling={false}
                                rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
                                rotationSnapTolerance={5}
                                anchorStyleFunc={(anchor) => {
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
                        )}
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
