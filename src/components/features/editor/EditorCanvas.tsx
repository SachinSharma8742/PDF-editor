import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import { useEditorStore } from '../../../store/editorStore';
import { usePDFStore } from '../../../store/pdfStore'; // Need this for the PDF Document source
import { PDFObjectRenderer } from './PDFObjectRenderer';
import { Loader2 } from 'lucide-react';

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
    const wrapperRef = useRef<HTMLDivElement>(null);

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

    if (!currentPage || !dimensions) return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

    // --- Interaction Handlers (Copied & Adapted from CanvasLayer) ---

    const handleMouseDown = (e: any) => {
        const stage = e.target.getStage();
        const pos = stage.getPointerPosition();
        if (!pos) return;

        const scaledX = pos.x / scale;
        const scaledY = pos.y / scale;

        // 1. Clicked on Empty Stage
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
            }

            setSelectionStart(null);
            setSelectionRect(null);
            return;
        }

        if (!isDrawing) return;

        // Finalize Freehand
        if (['pen', 'highlighter', 'eraser'].includes(activeTool) && currentPath.length > 0) {
            addPath({
                id: crypto.randomUUID(),
                points: currentPath,
                stroke: activeTool === 'eraser' ? '#ffffff' : toolSettings.color,
                strokeWidth: toolSettings.size,
                tool: activeTool as any,
                opacity: activeTool === 'highlighter' ? (toolSettings.opacity || 0.5) : 1
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
                    text: 'Double click to edit',
                    fill: toolSettings.color,
                    fontSize: toolSettings.fontSize || 16,
                    fontFamily: toolSettings.fontFamily || 'Arial',
                    width: Math.max(200, finalW),
                    height: 24, // Approx
                    rotation: 0
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

    const getCursorStyle = () => {
        if (activeTool === 'select') return 'default';
        if (['rectangle', 'circle', 'text'].includes(activeTool)) return 'crosshair';
        if (['pen', 'highlighter', 'eraser'].includes(activeTool)) return 'crosshair'; // Custom cursors later
        return 'default';
    };

    return (
        <div
            className="shadow-2xl bg-white relative my-10"
            style={{
                width: dimensions.width,
                height: dimensions.height,
                cursor: getCursorStyle()
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
                    width={dimensions.width}
                    height={dimensions.height}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    scaleX={scale}
                    scaleY={scale}
                >
                    <Layer>
                        {/* 1. Render Paths */}
                        {currentPage.paths.map((path, i) => (
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
                        ))}

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
                                onSelect={() => selectObject(obj.id, false)}
                                onChange={(updates) => updateObject(obj.id, updates)}
                                isLocked={obj.isLocked}
                                isSelectionEnabled={activeTool === 'select'}
                            />
                        ))}
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
