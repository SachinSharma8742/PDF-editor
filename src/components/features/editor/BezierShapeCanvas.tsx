import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../../../store/editorStore';

// A single anchor point with optional Bézier handles (in/out control points relative to anchor)
interface Anchor {
    x: number;
    y: number;
    cpIn: { dx: number; dy: number };   // incoming handle
    cpOut: { dx: number; dy: number };  // outgoing handle
}

/**
 * Build the cubic Bézier SVG path string from the anchor list.
 * If `closed` is true, the path ends with a smooth Z.
 */
function buildPathData(anchors: Anchor[], closed: boolean, mousePos?: { x: number; y: number }): string {
    if (anchors.length === 0) return '';

    const pts = closed ? [...anchors, anchors[0]] : anchors;
    let d = `M ${anchors[0].x} ${anchors[0].y}`;

    for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const cp1x = a.x + a.cpOut.dx;
        const cp1y = a.y + a.cpOut.dy;
        const cp2x = b.x + b.cpIn.dx;
        const cp2y = b.y + b.cpIn.dy;
        d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${b.x} ${b.y}`;
    }

    // Rubber-band line from last anchor to cursor (only while not closed)
    if (!closed && mousePos && anchors.length > 0) {
        const last = anchors[anchors.length - 1];
        const cp1x = last.x + last.cpOut.dx;
        const cp1y = last.y + last.cpOut.dy;
        d += ` C ${cp1x} ${cp1y}, ${mousePos.x} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`;
    }

    if (closed) d += ' Z';
    return d;
}

const CLOSE_THRESHOLD = 12; // px – snap-close radius

export const BezierShapeCanvas: React.FC<{ canvasWidth: number; canvasHeight: number; editorScale: number }> = ({
    canvasWidth,
    canvasHeight,
    editorScale,
}) => {
    const { endBezierMode, addObject, bezierStyle, setActiveTool } = useEditorStore();

    const [anchors, setAnchors] = useState<Anchor[]>([]);
    const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
    // State for live drag handle preview while the user is dragging a new anchor
    const [dragging, setDragging] = useState<{ anchor: Anchor; dragged: boolean } | null>(null);

    const svgRef = useRef<SVGSVGElement>(null);

    // ---------- Coordinate helper ----------
    const clientToSvg = useCallback((clientX: number, clientY: number) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };
        return {
            x: (clientX - rect.left) / editorScale,
            y: (clientY - rect.top) / editorScale,
        };
    }, [editorScale]);

    // ---------- Finish / commit the shape ----------
    const finishShape = useCallback((anchorsToCommit: Anchor[], shouldClose: boolean) => {
        if (anchorsToCommit.length < 2) { endBezierMode(); return; }

        // 1. Calculate bounding box (minimal rect containing all anchors AND their handles)
        // We include control points to ensure the visual shape is contained and the pivot is stable.
        const xs: number[] = [];
        const ys: number[] = [];
        anchorsToCommit.forEach(a => {
            xs.push(a.x, a.x + a.cpIn.dx, a.x + a.cpOut.dx);
            ys.push(a.y, a.y + a.cpIn.dy, a.y + a.cpOut.dy);
        });
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        const width = Math.max(maxX - minX, 1);
        const height = Math.max(maxY - minY, 1);

        // 2. Normalize anchors relative to the top-left (minX, minY)
        const normalized = anchorsToCommit.map(a => ({
            ...a,
            x: a.x - minX,
            y: a.y - minY,
        }));

        const pathData = buildPathData(normalized, shouldClose);

        addObject({
            id: crypto.randomUUID(),
            type: 'path',
            pathData,
            x: minX,
            y: minY,
            width: width,
            height: height,
            stroke: bezierStyle.stroke,
            strokeWidth: bezierStyle.strokeWidth,
            fill: bezierStyle.fill,
            fillOpacity: bezierStyle.fillOpacity,
            opacity: bezierStyle.opacity,
            rotation: 0,
        } as any);

        setActiveTool('select');
        endBezierMode();
    }, [addObject, bezierStyle, endBezierMode, setActiveTool]);

    // ---------- Mouse / Pointer events ----------
    const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);

        const pos = clientToSvg(e.clientX, e.clientY);

        // Check close-to-first-anchor snap
        if (anchors.length >= 3) {
            const first = anchors[0];
            const dist = Math.hypot(pos.x - first.x, pos.y - first.y);
            if (dist < CLOSE_THRESHOLD / editorScale) {
                finishShape(anchors, true);
                return;
            }
        }

        const newAnchor: Anchor = {
            x: pos.x,
            y: pos.y,
            cpIn: { dx: 0, dy: 0 },
            cpOut: { dx: 0, dy: 0 },
        };
        setDragging({ anchor: newAnchor, dragged: false });
    }, [anchors, clientToSvg, editorScale, finishShape]);

    const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
        const pos = clientToSvg(e.clientX, e.clientY);
        setMousePos(pos);

        if (dragging) {
            const dx = pos.x - dragging.anchor.x;
            const dy = pos.y - dragging.anchor.y;
            const distSq = dx * dx + dy * dy;
            if (distSq > (4 / editorScale) * (4 / editorScale)) {
                setDragging(prev => prev ? {
                    ...prev,
                    dragged: true,
                    anchor: {
                        ...prev.anchor,
                        cpOut: { dx, dy },
                        cpIn: { dx: -dx, dy: -dy },
                    }
                } : null);
            }
        }
    }, [clientToSvg, dragging, editorScale]);

    const handlePointerUp = useCallback((_e: React.PointerEvent<SVGSVGElement>) => {
        if (!dragging) return;
        setAnchors(prev => [...prev, dragging.anchor]);
        setDragging(null);
    }, [dragging]);

    const handleDoubleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        e.preventDefault();
        // Remove the last anchor that was added on the first click of the dblclick
        setAnchors(prev => {
            const trimmed = prev.length > 1 ? prev.slice(0, -1) : prev;
            finishShape(trimmed, false);
            return trimmed;
        });
    }, [finishShape]);

    // ---------- Keyboard ----------
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { endBezierMode(); }
            if ((e.key === 'Enter' || e.key === 'Return') && anchors.length >= 2) {
                finishShape(anchors, true);
            }
            if ((e.key === 'Backspace' || e.key === 'Delete') && anchors.length > 0) {
                setAnchors(prev => prev.slice(0, -1));
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [anchors, endBezierMode, finishShape]);

    // ---------- Build live path for rendering ----------
    const previewAnchors = dragging ? [...anchors, dragging.anchor] : anchors;
    const previewPath = buildPathData(previewAnchors, false, dragging ? undefined : mousePos ?? undefined);

    const snapFirst = anchors.length >= 3 && mousePos &&
        Math.hypot(mousePos.x - anchors[0].x, mousePos.y - anchors[0].y) < CLOSE_THRESHOLD / editorScale;

    return (
        <div
            style={{
                position: 'absolute', inset: 0,
                width: canvasWidth * editorScale,
                height: canvasHeight * editorScale,
                pointerEvents: 'all',
                zIndex: 200,
                cursor: snapFirst ? 'cell' : 'crosshair',
            }}
        >
            {/* Instruction banner */}
            <div style={{
                position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(9,9,11,0.88)', backdropFilter: 'blur(8px)',
                borderRadius: 10, padding: '6px 14px',
                color: '#a1a1aa', fontSize: 11, fontFamily: 'Inter, sans-serif',
                display: 'flex', gap: 12, alignItems: 'center', userSelect: 'none',
                border: '1px solid rgba(255,255,255,0.07)',
                whiteSpace: 'nowrap', zIndex: 201,
            }}>
                <span><span style={{ color: '#fff' }}>Click</span> add point</span>
                <span style={{ color: '#3f3f46' }}>|</span>
                <span><span style={{ color: '#fff' }}>Drag</span> add curve</span>
                <span style={{ color: '#3f3f46' }}>|</span>
                <span><span style={{ color: '#fff' }}>Enter</span> close &amp; finish</span>
                <span style={{ color: '#3f3f46' }}>|</span>
                <span><span style={{ color: '#fff' }}>⌫</span> undo point</span>
                <span style={{ color: '#3f3f46' }}>|</span>
                <span><span style={{ color: '#fff' }}>Esc</span> cancel</span>
                {anchors.length >= 2 && <><span style={{ color: '#3f3f46' }}>|</span><span style={{ color: '#60a5fa' }}>{anchors.length} pts</span></>}
            </div>

            <svg
                ref={svgRef}
                width={canvasWidth * editorScale}
                height={canvasHeight * editorScale}
                viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
                style={{ position: 'absolute', inset: 0, display: 'block' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onDoubleClick={handleDoubleClick}
            >
                {/* Live path preview */}
                {previewPath && (
                    <>
                        {/* Shadow stroke for visibility on both light/dark pages */}
                        <path
                            d={previewPath}
                            fill="none"
                            stroke="white"
                            strokeWidth={3 / editorScale}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity={0.4}
                        />
                        <path
                            d={previewPath}
                            fill="none"
                            stroke={bezierStyle.stroke || '#3b82f6'}
                            strokeWidth={2 / editorScale}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray={`${6 / editorScale} ${4 / editorScale}`}
                        />
                    </>
                )}

                {/* Placed anchor handles */}
                {previewAnchors.map((anchor, i) => {
                    const isFirst = i === 0;
                    const isSnapping = isFirst && snapFirst;
                    const r = 5 / editorScale;
                    const hR = 3.5 / editorScale;

                    return (
                        <g key={i}>
                            {/* Cubic Bézier handles (shown when non-zero) */}
                            {(anchor.cpOut.dx !== 0 || anchor.cpOut.dy !== 0) && (
                                <>
                                    <line
                                        x1={anchor.x} y1={anchor.y}
                                        x2={anchor.x + anchor.cpOut.dx}
                                        y2={anchor.y + anchor.cpOut.dy}
                                        stroke="#60a5fa" strokeWidth={1 / editorScale} opacity={0.7}
                                    />
                                    <circle
                                        cx={anchor.x + anchor.cpOut.dx}
                                        cy={anchor.y + anchor.cpOut.dy}
                                        r={hR} fill="#60a5fa" opacity={0.9}
                                    />
                                    <line
                                        x1={anchor.x} y1={anchor.y}
                                        x2={anchor.x + anchor.cpIn.dx}
                                        y2={anchor.y + anchor.cpIn.dy}
                                        stroke="#60a5fa" strokeWidth={1 / editorScale} opacity={0.7}
                                    />
                                    <circle
                                        cx={anchor.x + anchor.cpIn.dx}
                                        cy={anchor.y + anchor.cpIn.dy}
                                        r={hR} fill="#60a5fa" opacity={0.9}
                                    />
                                </>
                            )}
                            {/* Anchor dot */}
                            <circle
                                cx={anchor.x} cy={anchor.y} r={r + 2 / editorScale}
                                fill={isSnapping ? '#22c55e' : 'white'}
                                stroke={isSnapping ? '#16a34a' : '#3b82f6'}
                                strokeWidth={1.5 / editorScale}
                            />
                            {isFirst && anchors.length >= 3 && (
                                <circle cx={anchor.x} cy={anchor.y} r={r + 5 / editorScale}
                                    fill="none"
                                    stroke={isSnapping ? '#22c55e' : '#3b82f6'}
                                    strokeWidth={1.5 / editorScale}
                                    opacity={0.6}
                                    strokeDasharray={`${3 / editorScale} ${3 / editorScale}`}
                                />
                            )}
                        </g>
                    );
                })}

                {/* Live drag handle ghost */}
                {dragging && dragging.dragged && (
                    <g>
                        <line
                            x1={dragging.anchor.x} y1={dragging.anchor.y}
                            x2={mousePos?.x ?? dragging.anchor.x}
                            y2={mousePos?.y ?? dragging.anchor.y}
                            stroke="#f59e0b" strokeWidth={1 / editorScale} opacity={0.7} strokeDasharray={`${4 / editorScale} ${3 / editorScale}`}
                        />
                        <circle
                            cx={mousePos?.x ?? dragging.anchor.x}
                            cy={mousePos?.y ?? dragging.anchor.y}
                            r={4 / editorScale} fill="#f59e0b" opacity={0.9}
                        />
                    </g>
                )}
            </svg>
        </div>
    );
};
