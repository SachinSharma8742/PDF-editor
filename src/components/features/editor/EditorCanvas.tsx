import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line, Transformer, Rect, Group, Text, Image as KonvaImage } from 'react-konva';
import Konva from 'konva';
import { useEditorStore } from '../../../store/editorStore';

import { usePDFStore, type PDFObject } from '../../../store/pdfStore'; // Need this for the PDF Document source
import { PDFObjectRenderer } from './PDFObjectRenderer';
import { AdjustmentGroup } from './shared/AdjustmentGroup';
import { ImageCropOverlay } from './ImageCropOverlay';
import { TextEditorOverlay } from './TextEditorOverlay';
import { BezierShapeCanvas } from './BezierShapeCanvas';
import { Loader2 } from 'lucide-react';


import { detectShape } from '../../../utils/shapeDetection';



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
        setActiveTool,
        snapToGrid,
        gridSize,
        editingObjectId,
        setEditingObjectId,
        stagePosition,
        setStagePosition,
        openTextStudio,
        previewStyle,
        setScale,
        isCropping,
        setCropping,
        isBezierDrawing,
    } = useEditorStore();

    // PDF Global State (Source)
    const { pdfDocument, eraserMode } = usePDFStore();

    // Auto-Fit PDF on Page Load
    useEffect(() => {
        if (!currentPage || currentPage.source !== 'pdf' || !pdfDocument) return;

        const fitToScreen = async () => {
            const index = currentPage.originalPageIndex;
            if (index === undefined || index === null) return;

            try {
                const page = await pdfDocument.getPage(index);
                // Get unscaled viewport
                const rotation = (currentPage.rotation || 0) + ((page as any).rotate || 0);
                const viewport = page.getViewport({ scale: 1, rotation: rotation % 360 } as any);

                const container = document.getElementById('editor-workspace');
                if (!container) return;

                const padding = 60; // Comfortable padding
                const containerW = container.clientWidth;
                const containerH = container.clientHeight;

                if (containerW === 0 || containerH === 0) return;

                const scaleX = (containerW - padding) / viewport.width;
                const scaleY = (containerH - padding) / viewport.height;

                // Fit entirely visible, cap at 1.5 if it's tiny, but allow shrinking
                const newScale = Math.min(scaleX, scaleY);

                // Only set if different enough to avoid jitters, or just set it.
                // We want to force it on page load.
                setScale(newScale);
            } catch (e) {
                console.error("Auto-fit failed", e);
            }
        };

        // Run when the page identifier changes
        fitToScreen();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage?.id, pdfDocument]);

    // Refs
    const stageRef = useRef<Konva.Stage>(null);
    const transformerRef = useRef<Konva.Transformer>(null);
    const bufferCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
    // Track Drag State for Multi-move
    const isDraggingRef = useRef(false);
    const dragStartPosRef = useRef<{ x: number, y: number } | null>(null);

    // Pan State Refs
    const editorWorkspaceRef = useRef<HTMLDivElement>(null);
    const isPanningRef = useRef(false);
    const panStartPosRef = useRef<{ x: number, y: number } | null>(null);
    const panStartStagePosRef = useRef<{ x: number, y: number } | null>(null);

    // Local State
    const [rendering, setRendering] = useState(false);
    const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
    const [bgImage, setBgImage] = useState<HTMLCanvasElement | null>(null);

    // Drawing State (Local to component for interactions)
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPath, setCurrentPath] = useState<number[]>([]);
    const [shapeStartPos, setShapeStartPos] = useState<{ x: number; y: number } | null>(null);
    const [currentShape, setCurrentShape] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

    // Area Selection State
    const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
    const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

    const toolSettings = toolPreferences[activeTool];
    const hasSelection = selectedObjectIds.length > 0;

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
    }, [selectedObjectIds, currentPage]);


    // --- PDF Rendering ---
    useEffect(() => {
        if (!currentPage || currentPage.source !== 'pdf') return;

        let renderTask: { promise: Promise<void>; cancel: () => void } | null = null;
        let isCancelled = false;

        const renderPage = async () => {
            const indexToFetch = currentPage.originalPageIndex;
            // Allow 0 index
            if (!pdfDocument || indexToFetch === undefined || indexToFetch === null) return;

            setRendering(true);
            try {
                const page = await pdfDocument.getPage(indexToFetch);
                if (isCancelled) return;

                const rotation = (currentPage.rotation || 0) + ((page as any).rotate || 0); // Combine intrinsic + user rotation

                // Get base viewport at scale 1 to determine unzoomed size
                const baseViewport = page.getViewport({ scale: 1, rotation: rotation % 360 } as any);
                const baseWidth = baseViewport.width;
                const baseHeight = baseViewport.height;

                const cssWidth = Math.floor(baseWidth * scale);
                const cssHeight = Math.floor(baseHeight * scale);

                // Set dimensions if not set or changed (triggers re-render to mount stage correctly)
                if (!dimensions || dimensions.width !== cssWidth || dimensions.height !== cssHeight) {
                    setDimensions({ width: cssWidth, height: cssHeight });
                    return;
                }

                // Use a fixed high-DPI scale for background rendering to keep it sharp
                const RENDER_SCALE = 2;
                const viewport = page.getViewport({ scale: RENDER_SCALE, rotation: rotation % 360 } as any);
                const outputScale = 1;

                // 1. Prepare Buffer Canvas (Internal PDF Render)
                const bufferCanvas = bufferCanvasRef.current;
                if (!bufferCanvas) return;
                bufferCanvas.width = Math.floor(viewport.width * outputScale);
                bufferCanvas.height = Math.floor(viewport.height * outputScale);
                const bufferContext = bufferCanvas.getContext('2d');
                if (!bufferContext) return;

                const transform = outputScale !== 1
                    ? [outputScale, 0, 0, outputScale, 0, 0]
                    : undefined;

                const renderContext = {
                    canvasContext: bufferContext,
                    transform: transform,
                    viewport: viewport,
                };

                renderTask = page.render(renderContext) as any;
                await renderTask!.promise;

                // Base background rendered
                // Capture the buffer canvas as our BG source
                const finalBg = document.createElement('canvas');
                finalBg.width = bufferCanvas.width;
                finalBg.height = bufferCanvas.height;
                const finalCtx = finalBg.getContext('2d');
                if (finalCtx) {
                    finalCtx.drawImage(bufferCanvas, 0, 0);
                    setBgImage(finalBg);
                }

            } catch (error: unknown) {
                if (error instanceof Error && error.name !== 'RenderingCancelledException') {
                    console.error('Error rendering page:', error);
                }
            } finally {
                if (!isCancelled) setRendering(false);
            }
        };

        renderPage();

        return () => {
            isCancelled = true;
            renderTask?.cancel();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pdfDocument, currentPage?.originalPageIndex, scale, dimensions?.width, dimensions?.height, currentPage?.rotation]);


    // Remove old applySingleEffect and applyThresholdEffect and applyScanEnhanceEffect as they are now in effectUtils

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
            .map(id => stageRef.current?.findOne('#' + id))
            .filter(node => node !== undefined);

        if (nodes.length > 0 && transformerRef.current) {
            transformerRef.current.nodes(nodes as Konva.Node[]);
            transformerRef.current.getLayer()?.batchDraw();
        } else if (transformerRef.current) {
            transformerRef.current.nodes([]);
            transformerRef.current.getLayer()?.batchDraw();
        }
    }, [selectedObjectIds]);


    if (!currentPage || !dimensions) return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

    const snapPoint = (val: number) => {
        if (!snapToGrid) return val;
        const g = gridSize || 20;
        return Math.round(val / g) * g;
    };

    const handlePanMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        isPanningRef.current = true;

        // Normalize pointer position
        let clientX = 0;
        let clientY = 0;

        if ('touches' in e.evt) {
            clientX = e.evt.touches[0].clientX;
            clientY = e.evt.touches[0].clientY;
        } else {
            clientX = (e.evt as MouseEvent).clientX;
            clientY = (e.evt as MouseEvent).clientY;
        }

        panStartPosRef.current = { x: clientX, y: clientY };
        panStartStagePosRef.current = { x: stagePosition.x, y: stagePosition.y };

        document.body.style.cursor = 'grabbing';

        const handleWindowMove = (we: MouseEvent | TouchEvent) => {
            if (!isPanningRef.current || !panStartPosRef.current || !panStartStagePosRef.current) return;
            // we.preventDefault(); // Careful blocking touch scroll?

            let cx = 0;
            let cy = 0;

            if ('touches' in we) {
                cx = we.touches[0].clientX;
                cy = we.touches[0].clientY;
            } else {
                cx = (we as MouseEvent).clientX;
                cy = (we as MouseEvent).clientY;
            }

            const dx = cx - panStartPosRef.current.x;
            const dy = cy - panStartPosRef.current.y;
            const newX = panStartStagePosRef.current.x + dx;
            const newY = panStartStagePosRef.current.y + dy;

            if (editorWorkspaceRef.current) {
                editorWorkspaceRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
            }
        };

        const handleWindowUp = (we: MouseEvent | TouchEvent) => {
            // For Touchend, we might not have clientX easily if touches is empty?
            // But we have the last known or just use delta?
            // Actually, Touchend doesn't have coordinates.
            // We should rely on tracking the last known delta or re-calc?
            // For MouseUp it works.
            // If we used a ref for 'currentStagePos' during move, we can just use that.
            // But simpler: Just use the delta logic if it persists?

            // Simplification: We only really need the final calculated X/Y.
            // But extracting it from DOM transform is annoying.
            // Let's assume mouseup happens at a specific point.

            let cx = 0;
            let cy = 0;

            if ('changedTouches' in we) {
                cx = we.changedTouches[0].clientX;
                cy = we.changedTouches[0].clientY;
            } else {
                cx = (we as MouseEvent).clientX;
                cy = (we as MouseEvent).clientY;
            }

            if (isPanningRef.current && panStartPosRef.current && panStartStagePosRef.current) {
                const dx = cx - panStartPosRef.current.x;
                const dy = cy - panStartPosRef.current.y;
                setStagePosition({
                    x: panStartStagePosRef.current.x + dx,
                    y: panStartStagePosRef.current.y + dy
                });
            }

            isPanningRef.current = false;
            panStartPosRef.current = null;
            panStartStagePosRef.current = null;
            document.body.style.cursor = 'grab';

            window.removeEventListener('mousemove', handleWindowMove as any);
            window.removeEventListener('mouseup', handleWindowUp as any);
            window.removeEventListener('touchmove', handleWindowMove as any);
            window.removeEventListener('touchend', handleWindowUp as any);
        };

        window.addEventListener('mousemove', handleWindowMove as any);
        window.addEventListener('mouseup', handleWindowUp as any);
        window.addEventListener('touchmove', handleWindowMove as any, { passive: false });
        window.addEventListener('touchend', handleWindowUp as any);
    };

    const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        const stage = e.target.getStage();
        if (!stage) return;

        // Manual Pan Handling
        if (activeTool === 'pan') {
            handlePanMouseDown(e);
            return;
        }

        const pos = stage.getPointerPosition();
        if (!pos) return;

        const scaledX = pos.x / scale;
        const scaledY = pos.y / scale;
        const snappedX = snapPoint(scaledX);
        const snappedY = snapPoint(scaledY);

        if (e.target === stage) {
            if (activeTool === 'select') {
                setSelectionStart({ x: scaledX, y: scaledY });
                setSelectionRect({ x: scaledX, y: scaledY, width: 0, height: 0 });
                selectObjects([]);
                return;
            }
            selectObjects([]);
        }

        const drawingTools = ['pen', 'highlighter', 'eraser'];
        if (drawingTools.includes(activeTool)) {
            if (activeTool === 'eraser' && eraserMode === 'element') {
                return;
            }
            setIsDrawing(true);
            setCurrentPath([scaledX, scaledY]);
            return;
        }

        const shapeTools = ['rectangle', 'circle', 'triangle', 'star', 'polygon', 'ellipse', 'line', 'arrow', 'text', 'ocr', 'measure', 'sticky-note', 'callout'];
        if (shapeTools.includes(activeTool)) {
            setIsDrawing(true);
            setShapeStartPos({ x: snappedX, y: snappedY });
            setCurrentShape({ x: snappedX, y: snappedY, width: 0, height: 0 });
        }
    };

    const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        const stage = e.target.getStage();
        if (!stage) return;
        const point = stage.getPointerPosition();
        if (!point) return;

        const scaledX = point.x / scale;
        const scaledY = point.y / scale;

        // Area Selection
        if (selectionStart) {
            const width = scaledX - selectionStart.x;
            const height = scaledY - selectionStart.y;
            setSelectionRect({
                x: Math.min(selectionStart.x, scaledX),
                y: Math.min(selectionStart.y, scaledY),
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
        if (shapeStartPos) {
            const currentX = snapPoint(scaledX);
            const currentY = snapPoint(scaledY);
            setCurrentShape({
                x: shapeStartPos.x,
                y: shapeStartPos.y,
                width: currentX - shapeStartPos.x,
                height: currentY - shapeStartPos.y
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
            // Simplify Path (Radial Distance Algorithm)
            const simplifyPoints = (points: number[], tolerance: number): number[] => {
                if (points.length <= 4) return points;

                const sqTolerance = tolerance * tolerance;

                // Basic Radial Distance check
                const newPoints = [points[0], points[1]];
                let lastX = points[0];
                let lastY = points[1];
                for (let i = 2; i < points.length; i += 2) {
                    const x = points[i];
                    const y = points[i + 1];
                    const distSq = (x - lastX) ** 2 + (y - lastY) ** 2;
                    if (distSq > sqTolerance) {
                        newPoints.push(x, y);
                        lastX = x;
                        lastY = y;
                    }
                }
                // Always include the last point
                if (newPoints.length < points.length) {
                    newPoints.push(points[points.length - 2], points[points.length - 1]);
                }
                return newPoints;
            };

            const simplifiedPath = simplifyPoints(currentPath, 2); // 2px tolerance

            // Smart Drawing Detection
            if (activeTool === 'pen' && toolSettings.smartShapeMode) {
                const detected = detectShape(simplifiedPath);
                if (detected.type !== 'none') {
                    addObject({
                        id: crypto.randomUUID(),
                        type: detected.type as PDFObject['type'],
                        x: detected.x,
                        y: detected.y,
                        width: detected.width,
                        height: detected.height,
                        stroke: toolSettings.color,
                        strokeWidth: toolSettings.size,
                        fill: 'transparent',
                        points: detected.points,
                        rotation: 0
                    });
                    setActiveTool('select');
                    setIsDrawing(false);
                    setCurrentPath([]);
                    return;
                }
            }

            // Normalize Path: Calculate bounds to set X/Y and make points relative
            const xs = simplifiedPath.filter((_, i) => i % 2 === 0);
            const ys = simplifiedPath.filter((_, i) => i % 2 === 1);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            const width = maxX - minX;
            const height = maxY - minY;

            // Normalize points relative to minX, minY
            const normalizedPoints = simplifiedPath.map((val, i) => {
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
                tool: activeTool as 'pen' | 'highlighter' | 'eraser',
                opacity: activeTool === 'highlighter' ? (toolSettings.opacity || 0.5) : 1,
                rotation: 0
            });
        }

        // Finalize Shape / Tool Action
        const shapeTools = ['rectangle', 'circle', 'triangle', 'star', 'polygon', 'ellipse', 'line', 'arrow', 'text', 'ocr', 'measure', 'sticky-note', 'callout'];
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
                const defaultWidth = 250;
                const defaultHeight = 40;

                // If it's a click (small drag), place at click position with default size
                // If it's a drag, use the dragged dimensions (finalX/Y are already top-left)

                const x = finalX;
                const y = finalY;
                const w = isClick ? defaultWidth : Math.abs(width);
                const h = isClick ? defaultHeight : Math.abs(height);

                addObject({
                    id: crypto.randomUUID(),
                    type: 'text',
                    x: x,
                    y: y,
                    text: 'Type here',
                    fill: toolSettings.color,
                    fontSize: toolSettings.fontSize || 24,
                    fontFamily: toolSettings.fontFamily || 'Inter',
                    width: Math.max(50, w),
                    height: Math.max(50, h), // Ensure height accommodates font size
                    rotation: 0,
                    isNew: true
                });
                // Save to Recent Styles
                useEditorStore.getState().addRecentTextStyle({
                    fontSize: toolSettings.fontSize || 24,
                    color: toolSettings.color,
                    fontFamily: toolSettings.fontFamily || 'Inter',
                    fontStyle: toolSettings.fontStyle || 'normal',
                    fontWeight: toolSettings.fontWeight || 'normal',
                    opacity: toolSettings.opacity || 1,
                    size: 0,
                    textAlign: 'left',
                    eraserMode: 'standard'
                });
            } else {
                // Shapes & Measure
                const isVector = ['line', 'arrow', 'measure'].includes(activeTool);

                addObject({
                    id: crypto.randomUUID(),
                    type: activeTool as PDFObject['type'],
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
    const handleDragStartGlobal = (e: Konva.KonvaEventObject<DragEvent>) => {
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




    const handleDragMoveGlobal = (e: Konva.KonvaEventObject<DragEvent>) => {
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
            const g = gridSize || 20;
            newX = Math.round(newX / g) * g;
            newY = Math.round(newY / g) * g;

            // Constrain the dragged node visually to the snap grid
            e.target.x(newX);
            e.target.y(newY);
        }

        const newPos = { x: newX, y: newY };
        const dx = newPos.x - dragStartPosRef.current.x;
        const dy = newPos.y - dragStartPosRef.current.y;

        // Update the ref so next move is relative to this one
        dragStartPosRef.current = newPos;

        // If dragging the STAGE (Panning)
        if (e.target === stageRef.current) {
            // Do NOT update state here. It causes full re-renders on every frame.
            // Konva handles the visual drag; we only sync on DragEnd.
            return;
        }

        // Move all OTHER selected objects
        selectedObjectIds.forEach(objId => {
            if (objId !== id) {
                const node = stageRef.current?.findOne('#' + objId);
                if (node) {
                    node.x(node.x() + dx);
                    node.y(node.y() + dy);
                }
            }
        });

        // Force batch draw to smooth animation
        stageRef.current?.batchDraw();
    };

    const handleDragEndGlobal = (e: Konva.KonvaEventObject<DragEvent>) => {
        isDraggingRef.current = false;
        dragStartPosRef.current = null;

        const id = e.target.id();
        // If we just finished dragging a selected object, we need to sync ALL positions to store
        if (selectedObjectIds.includes(id)) {
            // Iterate all selected IDs and update their positions from the Konva nodes
            selectedObjectIds.forEach(objId => {
                const node = stageRef.current?.findOne('#' + objId);
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

        // If dragging Stage
        if (e.target === stageRef.current) {
            setStagePosition({ x: e.target.x(), y: e.target.y() });
        }
    };

    const handleTransformEnd = () => {
        if (!stageRef.current) return;

        selectedObjectIds.forEach(id => {
            const node = stageRef.current?.findOne('#' + id);
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

                const updates: Partial<PDFObject> = {
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

    const handleOverlayDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
        isDraggingRef.current = true;
        dragStartPosRef.current = { x: e.target.x(), y: e.target.y() };
    };

    const handleOverlayDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
        if (!isDraggingRef.current || !dragStartPosRef.current) return;

        const newPos = { x: e.target.x(), y: e.target.y() };
        const dx = newPos.x - dragStartPosRef.current.x;
        const dy = newPos.y - dragStartPosRef.current.y;

        dragStartPosRef.current = newPos;

        // Move ALL selected objects
        selectedObjectIds.forEach(objId => {
            const node = stageRef.current?.findOne('#' + objId);
            if (node) {
                node.x(node.x() + dx);
                node.y(node.y() + dy);
            }
        });

        stageRef.current?.batchDraw();
    };

    const handleOverlayDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
        isDraggingRef.current = false;
        dragStartPosRef.current = null;

        // Sync all to store
        selectedObjectIds.forEach(objId => {
            const node = stageRef.current?.findOne('#' + objId);
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

    // --- Page Filter Helper ---
    const getPageFilter = () => {
        let filterStr = '';

        // 1. Legacy Filter (if any remains)
        if (currentPage.filter && currentPage.filter !== 'none') {
            const intensity = currentPage.filterIntensity ?? 0.5;
            switch (currentPage.filter) {
                case 'grayscale': filterStr += `grayscale(${intensity}) `; break;
                case 'sepia': filterStr += `sepia(${intensity}) `; break;
                case 'vintage': filterStr += `sepia(${intensity * 0.8}) contrast(${1 + intensity * 0.2}) brightness(${1 - intensity * 0.1}) `; break;
                case 'cool': filterStr += `hue-rotate(180deg) sepia(${intensity * 0.3}) saturate(${1 - intensity * 0.2}) `; break;
                case 'warm': filterStr += `sepia(${intensity * 0.4}) saturate(${1 + intensity * 0.2}) `; break;
            }
        }

        // 2. New Adjustment Layers are handled by AdjustmentGroup via pixel manipulation.
        // No CSS filter generation needed for effect objects.

        return filterStr.trim() || 'none';
    };

    const getTextureStyle = () => {
        if (!currentPage.texture || currentPage.texture === 'none') return {};
        const op = currentPage.textureOpacity ?? 0.3;

        switch (currentPage.texture) {
            case 'paper':
                return {
                    backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 95%, rgba(0,0,0,${op}) 0, rgba(0,0,0,${op}) 100%), repeating-linear-gradient(90deg, transparent, transparent 95%, rgba(0,0,0,${op}) 0, rgba(0,0,0,${op}) 100%)`,
                    backgroundSize: '20px 20px'
                };
            case 'grain':
                return {
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='${op}'/%3E%3C/svg%3E")`,
                };
            case 'canvas':
                return {
                    backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,${op * 0.5}) 10px, rgba(0,0,0,${op * 0.5}) 11px), repeating-linear-gradient(135deg, transparent, transparent 10px, rgba(0,0,0,${op * 0.5}) 10px, rgba(0,0,0,${op * 0.5}) 11px)`,
                    backgroundSize: '15px 15px'
                };
            default: return {};
        }
    };

    return (
        <div
            ref={editorWorkspaceRef}
            id="editor-canvas-container"
            className="shadow-2xl relative my-10"
            style={{
                width: dimensions.width,
                height: dimensions.height,
                cursor: getCursorStyle(),
                backgroundColor: pageBackgroundColor,
                transform: `translate(${stagePosition.x}px, ${stagePosition.y}px)`,
                touchAction: 'none', // Prevent browser from intercepting touch for scroll/zoom
                userSelect: 'none', // Prevent text selection during drawing
                WebkitUserSelect: 'none', // Safari support
                // Apply global page filter to the whole container? 
                // No, only to the PDF logic. If we apply to container, it affects annotations too!
                // We want strict layering: PDF -> Filter -> Overlay -> Objects
                // If we want "Vintage" effect on EVERYTHING, apply here.
                // But usually edits should be clear on top.
                // However, "Page Filter" usually implies altering the base document.
            }}
        >
            {/* Background Layer and Overlays are now rendered inside the Konva Stage for stack-based adjustment layers */}

            {/* Watermark Layer (Z=6, on top of texture, below objects) */}
            {currentPage.watermark && currentPage.watermark.text && (
                <div
                    className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center z-[6]"
                    style={{ opacity: currentPage.watermark.opacity ?? 0.2 }}
                >
                    {currentPage.watermark.isRepeating ? (
                        <div className="flex flex-wrap content-center justify-center gap-16 -rotate-12 scale-150 w-[200%] h-[200%]">
                            {Array.from({ length: 40 }).map((_, i) => (
                                <span
                                    key={i}
                                    style={{
                                        fontSize: (currentPage.watermark?.fontSize || 40) * scale,
                                        color: currentPage.watermark?.color || '#000000',
                                        fontWeight: 'bold',
                                        userSelect: 'none',
                                        fontFamily: 'sans-serif'
                                    }}
                                >
                                    {currentPage.watermark?.text}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <span
                            style={{
                                fontSize: (currentPage.watermark.fontSize || 80) * scale,
                                color: currentPage.watermark.color || '#000000',
                                transform: `rotate(${currentPage.watermark.rotate || -45}deg)`,
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap',
                                userSelect: 'none',
                                fontFamily: 'sans-serif'
                            }}
                        >
                            {currentPage.watermark.text}
                        </span>
                    )}
                </div>
            )}

            {/* Structure Layer (Header/Footer) (Z=7) */}
            {(currentPage.structure?.header || currentPage.structure?.footer) && (
                <div className="absolute inset-0 pointer-events-none z-[7] flex flex-col justify-between p-8">
                    {/* Header */}
                    {currentPage.structure?.header?.text ? (
                        <div style={{
                            textAlign: currentPage.structure.header.align,
                            color: currentPage.structure.header.color,
                            fontSize: currentPage.structure.header.fontSize * scale,
                            opacity: currentPage.structure.header.opacity ?? 1,
                            fontFamily: 'sans-serif',
                            whiteSpace: 'pre-wrap'
                        }}>
                            {currentPage.structure.header.text
                                .replace('{{page}}', `${currentPage.pageNumber}`)
                                .replace('{{total}}', `${usePDFStore.getState().pages.length}`)
                                .replace('{{date}}', new Date().toLocaleDateString())}
                        </div>
                    ) : <div />}

                    {/* Footer */}
                    {currentPage.structure?.footer?.text ? (
                        <div style={{
                            textAlign: currentPage.structure.footer.align,
                            color: currentPage.structure.footer.color,
                            fontSize: currentPage.structure.footer.fontSize * scale,
                            opacity: currentPage.structure.footer.opacity ?? 1,
                            fontFamily: 'sans-serif',
                            whiteSpace: 'pre-wrap'
                        }}>
                            {currentPage.structure.footer.text
                                .replace('{{page}}', `${currentPage.pageNumber}`)
                                .replace('{{total}}', `${usePDFStore.getState().pages.length}`)
                                .replace('{{date}}', new Date().toLocaleDateString())}
                        </div>
                    ) : <div />}
                </div>
            )}

            {/* Editing Layer: Konva Stage */}
            <div className="absolute inset-0 z-50 touch-none" style={{ touchAction: 'none' }}>
                <Stage
                    ref={stageRef}
                    width={dimensions?.width || 800}
                    height={dimensions?.height || 1100}
                    scaleX={scale * (currentPage.flipX ? -1 : 1)}
                    scaleY={scale * (currentPage.flipY ? -1 : 1)}
                    x={currentPage.flipX ? (dimensions?.width || 0) : 0}
                    y={currentPage.flipY ? (dimensions?.height || 0) : 0}
                    draggable={false}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onTouchStart={handleMouseDown}
                    onTouchMove={handleMouseMove}
                    onTouchEnd={handleMouseUp}
                    onDragStart={handleDragStartGlobal}
                    onDragMove={handleDragMoveGlobal}
                    onDragEnd={handleDragEndGlobal}
                    onWheel={(e) => {
                        // Prevent default scroll
                        e.evt.preventDefault();

                        const stage = e.target.getStage();
                        if (!stage) return;

                        // Get pointer position relative to stage
                        const pointer = stage.getPointerPosition();
                        if (!pointer) return;

                        const scaleBy = 1.08; // Zoom sensitivity
                        const oldScale = scale;

                        // Determine direction (scroll up = zoom in)
                        const direction = e.evt.deltaY > 0 ? -1 : 1;

                        // Calculate new scale with min/max limits
                        let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
                        newScale = Math.min(Math.max(newScale, 0.1), 5); // Limit between 10% and 500%

                        setScale(newScale);
                    }}
                    onDblClick={(e) => {
                        const stage = e.target.getStage();
                        if (!stage || e.target === stage) return;
                        const id = e.target.id();
                        if (!id) return;
                        const object = currentPage.objects.find(o => o.id === id);
                        if (object && object.type === 'text') {
                            openTextStudio('edit', id);
                            selectObject(id);
                        }
                    }}
                >
                    <Layer>
                        {/* 0. Grid Layer */}
                        {snapToGrid && dimensions && (
                            <Group listening={false}>
                                {/* Vertical Lines */}
                                {Array.from({ length: Math.ceil(dimensions.width / (gridSize || 20)) + 1 }).map((_, i) => (
                                    <Line
                                        key={`v-${i}`}
                                        points={[i * (gridSize || 20), 0, i * (gridSize || 20), dimensions.height]}
                                        stroke="rgba(59, 130, 246, 0.15)"
                                        strokeWidth={1}
                                        dash={[5, 5]}
                                    />
                                ))}
                                {/* Horizontal Lines */}
                                {Array.from({ length: Math.ceil(dimensions.height / (gridSize || 20)) + 1 }).map((_, i) => (
                                    <Line
                                        key={`h-${i}`}
                                        points={[0, i * (gridSize || 20), dimensions.width, i * (gridSize || 20)]}
                                        stroke="rgba(59, 130, 246, 0.15)"
                                        strokeWidth={1}
                                        dash={[5, 5]}
                                    />
                                ))}
                            </Group>
                        )}

                        {/* GHOST PREVIEW (Hover Layer) */}
                        {previewStyle && !hasSelection && (
                            <Text
                                x={stageRef.current ? ((-stagePosition.x + stageRef.current.width() / 2) / scale) : 100}
                                y={stageRef.current ? ((-stagePosition.y + stageRef.current.height() / 2) / scale) : 100}
                                text="Preview"
                                fontSize={previewStyle.fontSize}
                                fontFamily={previewStyle.fontFamily}
                                fontStyle={previewStyle.fontStyle} // e.g. "italic bold"
                                fill={previewStyle.color}
                                opacity={0.6} // Ghostly opacity
                                align="center"
                                offsetX={50} // Rough center alignment
                                offsetY={previewStyle.fontSize / 2}
                                listening={false} // Don't interact with mouse
                            />
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
                                            type: activeTool as PDFObject['type'],
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

                        {/* 3. Integrated Stack-Based Rendering */}
                        {(() => {
                            if (!currentPage || !dimensions) return null;

                            const unzoomedWidth = dimensions.width / scale;
                            const unzoomedHeight = dimensions.height / scale;

                            // Start with the background
                            let currentStack: React.ReactNode = null;

                            if (currentPage.source === 'pdf' && bgImage) {
                                currentStack = (
                                    <KonvaImage
                                        key="pdf-background"
                                        image={bgImage}
                                        width={unzoomedWidth}
                                        height={unzoomedHeight}
                                        listening={false}
                                    />
                                );
                            } else if (currentPage.source === 'blank') {
                                currentStack = (
                                    <Rect
                                        key="blank-background"
                                        width={unzoomedWidth}
                                        height={unzoomedHeight}
                                        fill={currentPage.backgroundColor || '#ffffff'}
                                        listening={false}
                                    />
                                );
                            }

                            // Texture Overlay (Legacy but integrated)
                            if (currentPage.texture && currentPage.texture !== 'none') {
                                // For now, we'll just wrap the current stack
                                // In a full implementation, textures could also be objects
                            }

                            // Iterate through objects and build the nested structure
                            currentPage.objects.forEach((obj) => {
                                const isSelected = selectedObjectIds.includes(obj.id);

                                if (obj.type === 'effect') {
                                    // Pro Refinement: Adjustment layers are always full-page and fixed
                                    const proObject = {
                                        ...obj,
                                        x: 0,
                                        y: 0,
                                        width: unzoomedWidth,
                                        height: unzoomedHeight,
                                        rotation: 0,
                                        isLocked: true // Prevent any internal move logic
                                    };

                                    // Effect Layer: Wrap the current stack
                                    currentStack = (
                                        <AdjustmentGroup
                                            key={obj.id}
                                            object={proObject}
                                            isSelected={isSelected}
                                            onSelect={(e) => {
                                                if (activeTool === 'select') {
                                                    const isMulti = e?.evt?.shiftKey === true;
                                                    selectObject(obj.id, isMulti);
                                                }
                                            }}
                                        >
                                            {currentStack}
                                        </AdjustmentGroup>
                                    );
                                } else {
                                    // Standard Object: Group it with the current stack
                                    currentStack = (
                                        <Group key={obj.id}>
                                            {currentStack}
                                            <PDFObjectRenderer
                                                object={obj}
                                                isSelected={isSelected}
                                                onSelect={(e: Konva.KonvaEventObject<MouseEvent>) => {
                                                    if (activeTool === 'eraser' && eraserMode === 'element') {
                                                        deleteObjects([obj.id]);
                                                    } else if (activeTool === 'select') {
                                                        const isMulti = e?.evt?.shiftKey === true;
                                                        selectObject(obj.id, isMulti);
                                                    }
                                                }}
                                                onChange={(updates) => updateObject(obj.id, updates)}
                                                isLocked={obj.isLocked}
                                                isSelectionEnabled={activeTool === 'select' || (activeTool === 'eraser' && eraserMode === 'element')}
                                            />
                                        </Group>
                                    );
                                }
                            });

                            return currentStack;
                        })()}

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
                        {selectedObjectIds.length === 1 && isCropping && (
                            <ImageCropOverlay objectId={selectedObjectIds[0]} />
                        )}

                        {/* Global Transformer */}
                        {!isCropping && (
                            <Transformer
                                ref={transformerRef}
                                borderStroke="#3b82f6"
                                borderStrokeWidth={1}
                                anchorFill="white"
                                anchorStroke="#3b82f6"
                                anchorStrokeWidth={1.5}
                                anchorSize={8}
                                anchorCornerRadius={10}
                                // Pro Refinement: Hide handles for adjustment layers
                                rotateEnabled={!currentPage.objects.some(o => selectedObjectIds.includes(o.id) && o.type === 'effect')}
                                enabledAnchors={currentPage.objects.some(o => selectedObjectIds.includes(o.id) && o.type === 'effect') ? [] : ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center', 'bottom-center', 'middle-left', 'middle-right']}
                                rotateAnchorOffset={30}
                                rotateAnchorCursor="grab"
                                keepRatio={selectedObjectIds.length === 1 ? (currentPage.objects.find(o => o.id === selectedObjectIds[0])?.lockAspectRatio ?? (currentPage.objects.find(o => o.id === selectedObjectIds[0])?.type === 'image')) : true}
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

                {/* Text Editor Overlay via Portal (Outside Stage) */}
                {editingObjectId && (() => {
                    const editingObj = currentPage?.objects.find(o => o.id === editingObjectId);
                    if (editingObj && editingObj.type === 'text') {
                        return (
                            <TextEditorOverlay
                                object={editingObj}
                                onBlur={(text) => {
                                    updateObject(editingObj.id, { text });
                                    setEditingObjectId(null);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                        setEditingObjectId(null);
                                    }
                                }}
                                stageX={(currentPage.flipX ? dimensions.width : 0) + stagePosition.x}
                                stageY={(currentPage.flipY ? dimensions.height : 0) + stagePosition.y}
                            />
                        );
                    }
                    return null;
                })()}
            </div>

            {/* Bézier Custom Shape Builder Overlay */}
            {isBezierDrawing && currentPage && (
                <BezierShapeCanvas
                    canvasWidth={dimensions.width}
                    canvasHeight={dimensions.height}
                    editorScale={scale}
                />
            )}

            {/* Simple Loading Indicator */}
            {rendering && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-20">
                    <Loader2 className="animate-spin text-blue-600" size={32} />
                </div>
            )}
        </div>
    );
};
