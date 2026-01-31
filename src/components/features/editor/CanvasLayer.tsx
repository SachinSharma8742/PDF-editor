import React, { useState } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import { usePDFStore } from '../../../store/pdfStore';
import { PDFObjectRenderer } from './PDFObjectRenderer';

interface CanvasLayerProps {
    pageId: string;
    pageNumber: number;
    width: number;
    height: number;
    scale: number;
}

export const CanvasLayer: React.FC<CanvasLayerProps> = ({ pageId, pageNumber, width, height, scale }) => {
    const {
        pages,
        activeTool,
        toolPreferences,
        addPath,
        addObject,
        updateObject,
        selectObject,
        selectedObjectIds,
        setActiveTool,
        deleteObjects
    } = usePDFStore();

    const page = pages.find(p => p.id === pageId);

    // Derived Settings
    const toolSettings = toolPreferences[activeTool] || {
        color: '#000000',
        size: 2,
        opacity: 1,
        fontSize: 16
    };

    // Drawing State
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPath, setCurrentPath] = useState<number[]>([]);
    const [shapeStartPos, setShapeStartPos] = useState<{ x: number; y: number } | null>(null);
    const [currentShape, setCurrentShape] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

    // Selection State
    const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
    const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

    // Eraser State
    const [isElementErasing, setIsElementErasing] = useState(false);
    const deletedIdsRef = React.useRef<Set<string>>(new Set());

    if (!page) return null;

    // --- CURSOR LOGIC ---
    const getCursorStyle = () => {
        const color = toolSettings.color || '#000000';
        const size = Math.max(toolSettings.size || 2, 4); // Min size limit

        if (activeTool === 'pen') {
            // Premium Pen Cursor: Circle with color fill + white border + shadow
            const cursorSize = Math.max(16, size + 8);
            const center = cursorSize / 2;
            const radius = Math.max(2, size / 2);

            const svg = `
                <svg xmlns='http://www.w3.org/2000/svg' width='${cursorSize}' height='${cursorSize}' viewBox='0 0 ${cursorSize} ${cursorSize}'>
                    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="rgba(0,0,0,0.3)"/>
                    </filter>
                    <circle cx='${center}' cy='${center}' r='${radius}' fill='${color}' stroke='white' stroke-width='1.5' filter="url(#shadow)"/>
                    <circle cx='${center}' cy='${center}' r='${radius + 1.5}' stroke='rgba(0,0,0,0.1)' stroke-width='1' fill='none'/>
                </svg>
            `;
            return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${center} ${center}, crosshair`;
        }

        if (activeTool === 'highlighter') {
            // Highlighter Cursor: Angled marker
            const h = Math.max(14, size);
            const w = 8;
            const svgWidth = 32;
            const svgHeight = 32;

            // Draw an angled rect
            const svg = `
                <svg xmlns='http://www.w3.org/2000/svg' width='${svgWidth}' height='${svgHeight}' viewBox='0 0 ${svgWidth} ${svgHeight}'>
                     <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                        <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                    <rect x="12" y="${16 - h / 2}" width="${w}" height="${h}" rx="2" fill="${color}" stroke="white" stroke-width="1.5" transform="rotate(-45 16 16)" opacity="0.8" style="filter:url(#glow);"/>
                </svg>
            `;
            // Hotspot needs to be adjusted based on rotation, roughly center
            return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 16 16, crosshair`;
        }

        if (activeTool === 'eraser') {
            const eraserMode = usePDFStore.getState().eraserMode;
            if (eraserMode === 'element') {
                // Target cursor
                const svg = `
                     <svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>
                        <line x1="12" y1="2" x2="12" y2="22" stroke="#ef4444" stroke-width="2"/>
                        <line x1="2" y1="12" x2="22" y2="12" stroke="#ef4444" stroke-width="2"/>
                        <circle cx="12" cy="12" r="8" fill="none" stroke="#ef4444" stroke-width="2"/>
                    </svg>
                `;
                return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 12 12, crosshair`;
            } else {
                // Circle eraser
                const s = Math.max(10, (toolSettings.size || 20));
                const svg = `
                    <svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}' viewBox='0 0 ${s} ${s}'>
                        <circle cx='${s / 2}' cy='${s / 2}' r='${s / 2 - 1}' fill='white' stroke='#333' stroke-width='1'/>
                    </svg>
                `;
                return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${s / 2} ${s / 2}, crosshair`;
            }
        }

        if (['rectangle', 'circle', 'text'].includes(activeTool)) return 'crosshair';

        return 'default';
    }

    // --- EVENT HANDLERS ---
    const handleMouseDown = (e: any) => {
        const stage = e.target.getStage();
        const pos = stage.getPointerPosition();
        if (!pos) return;

        const scaledX = pos.x / scale;
        const scaledY = pos.y / scale;

        // 1. Stage Click (Deselect / Start Selection)
        if (e.target === stage) {
            if (activeTool === 'select') {
                setSelectionStart({ x: scaledX, y: scaledY });
                setSelectionRect({ x: scaledX, y: scaledY, width: 0, height: 0 });
                selectObject('', false);
                return;
            }
            selectObject('', false);
        }

        // 2. Element Eraser
        const eraserMode = usePDFStore.getState().eraserMode;
        if (activeTool === 'eraser' && eraserMode === 'element') {
            setIsElementErasing(true);
            deletedIdsRef.current.clear();
            if (e.target !== stage) {
                const id = e.target.id();
                if (id) {
                    deletedIdsRef.current.add(id);
                    deleteObjects([id]);
                }
            }
            return;
        }

        // 3. Drawing
        if (['pen', 'highlighter', 'eraser'].includes(activeTool)) {
            setIsDrawing(true);
            setCurrentPath([scaledX, scaledY]);
            return;
        }

        // 4. Shapes
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

        // Element Eraser Drag
        if (isElementErasing) {
            const shapes = stage.getAllIntersections(point);
            shapes.forEach((shape: any) => {
                const id = shape.id();
                if (id && !deletedIdsRef.current.has(id)) {
                    deletedIdsRef.current.add(id);
                    deleteObjects([id]);
                }
            });
            return;
        }

        // Area Selection
        if (selectionStart) {
            const w = scaledX - selectionStart.x;
            const h = scaledY - selectionStart.y;
            setSelectionRect({
                x: w < 0 ? selectionStart.x + w : selectionStart.x,
                y: h < 0 ? selectionStart.y + h : selectionStart.y,
                width: Math.abs(w),
                height: Math.abs(h)
            });
            return;
        }

        if (!isDrawing) return;

        // Freehand
        if (['pen', 'highlighter', 'eraser'].includes(activeTool)) {
            setCurrentPath(prev => [...prev, scaledX, scaledY]);
            return;
        }

        // Shapes
        if (shapeStartPos) {
            const w = scaledX - shapeStartPos.x;
            const h = scaledY - shapeStartPos.y;
            setCurrentShape({
                x: shapeStartPos.x,
                y: shapeStartPos.y,
                width: w,
                height: h
            });
        }
    };

    const handleMouseUp = () => {
        if (isElementErasing) {
            setIsElementErasing(false);
            return;
        }

        // Finish Selection
        if (selectionStart && selectionRect) {
            const selectedIds: string[] = [];
            const r = selectionRect;
            page.objects.forEach(obj => {
                const ox = obj.x, oy = obj.y, ow = obj.width || 0, oh = obj.height || 0;
                // Loose overlap check
                if (ox < r.x + r.width && ox + ow > r.x && oy < r.y + r.height && oy + oh > r.y) {
                    selectedIds.push(obj.id);
                }
            });
            if (selectedIds.length > 0) usePDFStore.getState().selectObjects(selectedIds);

            setSelectionStart(null);
            setSelectionRect(null);
            return;
        }

        if (!isDrawing) return;

        // Finish Freehand
        if (['pen', 'highlighter', 'eraser'].includes(activeTool) && currentPath.length > 0) {
            addPath(pageId, {
                id: crypto.randomUUID(),
                points: currentPath,
                stroke: activeTool === 'eraser' ? '#ffffff' : toolSettings.color,
                strokeWidth: toolSettings.size,
                tool: activeTool as any,
                opacity: activeTool === 'highlighter' ? 0.5 : 1
            });
        }

        // Finish Shape
        if (['rectangle', 'circle', 'text'].includes(activeTool) && shapeStartPos && currentShape) {
            const finalW = Math.abs(currentShape.width);
            const finalH = Math.abs(currentShape.height);
            // Handle clicks vs drags
            const isClick = finalW < 5 && finalH < 5;
            const targetW = isClick ? 100 : finalW;
            const targetH = isClick ? 100 : finalH;

            // Normalize Pos
            const targetX = currentShape.width < 0 ? shapeStartPos.x + currentShape.width : shapeStartPos.x;
            const targetY = currentShape.height < 0 ? shapeStartPos.y + currentShape.height : shapeStartPos.y;

            if (activeTool === 'text') {
                addObject(pageId, {
                    id: crypto.randomUUID(),
                    type: 'text',
                    x: targetX, y: targetY,
                    text: 'Double click to edit',
                    fill: toolSettings.color,
                    fontSize: toolSettings.fontSize,
                    width: Math.max(200, targetW)
                });
            } else {
                addObject(pageId, {
                    id: crypto.randomUUID(),
                    type: activeTool as any,
                    x: targetX, y: targetY,
                    width: targetW, height: targetH,
                    stroke: toolSettings.color,
                    strokeWidth: 2,
                    fill: 'transparent'
                });
            }
            setActiveTool('select');
        }

        setIsDrawing(false);
        setCurrentPath([]);
        setShapeStartPos(null);
        setCurrentShape(null);
    };

    return (
        <div
            className="absolute inset-0 z-10 pointer-events-auto touch-none"
            style={{ cursor: getCursorStyle() }}
        >
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
                    {/* Drawing Preview */}
                    {isDrawing && currentPath.length > 0 && (
                        <Line
                            points={currentPath}
                            stroke={activeTool === 'eraser' ? '#ffffff' : toolSettings.color}
                            strokeWidth={toolSettings.size}
                            tension={0.5}
                            lineCap="round"
                            lineJoin="round"
                            opacity={activeTool === 'highlighter' ? 0.5 : 1}
                        />
                    )}

                    {/* Shape Preview */}
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
                                fill: 'rgba(59, 130, 246, 0.1)'
                            } as any}
                            isSelected={false}
                            onSelect={() => { }}
                            onChange={() => { }}
                        />
                    )}

                    {/* Selection Rect */}
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

                    {/* Objects */}
                    {page.objects.map((obj) => (
                        <PDFObjectRenderer
                            key={obj.id}
                            object={obj}
                            isSelected={selectedObjectIds.includes(obj.id)}
                            onSelect={() => {
                                const eraserMode = usePDFStore.getState().eraserMode;
                                if (activeTool === 'eraser' && eraserMode === 'element') {
                                    deleteObjects([obj.id]);
                                } else if (activeTool === 'select') {
                                    selectObject(obj.id, false);
                                }
                            }}
                            onChange={(updates) => updateObject(pageId, obj.id, updates)}
                            isSelectionEnabled={activeTool === 'select' || (activeTool === 'eraser' && usePDFStore.getState().eraserMode === 'element')}
                        />
                    ))}
                </Layer>
            </Stage>
        </div>
    );
};
