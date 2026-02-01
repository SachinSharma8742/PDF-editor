import React, { useEffect, useRef, useState, useMemo } from 'react';
import { usePDFStore, type PDFObject } from '../../../store/pdfStore';
import { useEditorStore } from '../../../store/editorStore';
import { FileText, Image as ImageIcon } from 'lucide-react';
import clsx from 'clsx';
import * as pdfjsLib from 'pdfjs-dist';

interface PDFThumbnailProps {
    pageNumber: number;
    width?: number; // Target width for the thumbnail
}

// Helper to draw objects on the canvas
const drawObject = (ctx: CanvasRenderingContext2D, obj: PDFObject, scale: number) => {
    ctx.save();
    ctx.globalAlpha = obj.opacity ?? 1;

    // Base coordinates and dimensions scaled
    const x = obj.x * scale;
    const y = obj.y * scale;
    const w = (obj.width ?? 0) * scale;
    const h = (obj.height ?? 0) * scale;

    if (obj.type === 'path' && obj.points) {
        ctx.beginPath();
        ctx.strokeStyle = obj.stroke || '#000';
        ctx.lineWidth = (obj.strokeWidth || 1) * scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Points are relative to the object's (x, y)
        if (obj.points.length >= 2) {
            ctx.moveTo(x + obj.points[0] * scale, y + obj.points[1] * scale);
            for (let i = 2; i < obj.points.length; i += 2) {
                ctx.lineTo(x + obj.points[i] * scale, y + obj.points[i + 1] * scale);
            }
        }
        ctx.stroke();
    }
    else if (obj.type === 'rectangle') {
        ctx.beginPath();
        if (obj.fill && obj.fill !== 'transparent') {
            ctx.fillStyle = obj.fill;
            ctx.fillRect(x, y, w, h);
        }
        if (obj.stroke) {
            ctx.strokeStyle = obj.stroke;
            ctx.lineWidth = (obj.strokeWidth || 1) * scale;
            ctx.strokeRect(x, y, w, h);
        }
    }
    else if (obj.type === 'circle') {
        ctx.beginPath();
        const centerX = x + w / 2;
        const centerY = y + h / 2;
        const radiusX = Math.abs(w / 2);
        const radiusY = Math.abs(h / 2);

        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);

        if (obj.fill && obj.fill !== 'transparent') {
            ctx.fillStyle = obj.fill;
            ctx.fill();
        }
        if (obj.stroke) {
            ctx.strokeStyle = obj.stroke;
            ctx.lineWidth = (obj.strokeWidth || 1) * scale;
            ctx.stroke();
        }
    }
    else if (obj.type === 'text' && obj.text) {
        ctx.font = `${obj.fontStyle ?? ''} ${obj.fontWeight ?? ''} ${(obj.fontSize ?? 12) * scale}px ${obj.fontFamily ?? 'Inter'}`;
        ctx.fillStyle = obj.fill || '#000';
        ctx.textBaseline = 'top';
        ctx.fillText(obj.text, x, y);
    }
    // Add more types (image, arrow, etc.) as needed

    ctx.restore();
};

// Separate component for blank page thumbnails to handle its own canvas
const BlankThumbnail: React.FC<{
    bgColor: string;
    isDark: boolean;
    thumbWidth: number;
    thumbHeight: number;
    blankScale: number;
    objects: PDFObject[];
}> = ({ bgColor, isDark, thumbWidth, thumbHeight, blankScale, objects }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas dimensions
        canvas.width = thumbWidth;
        canvas.height = thumbHeight;

        // Clear and draw all objects
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        objects.forEach(obj => {
            drawObject(ctx, obj, blankScale);
        });
    }, [objects, thumbWidth, thumbHeight, blankScale]);

    return (
        <div
            className="w-full h-full border border-gray-100 flex items-center justify-center relative"
            style={{ backgroundColor: bgColor }}
        >
            {objects.length === 0 && (
                <span className={`text-[10px] ${isDark ? 'text-white/40' : 'text-gray-300'}`}>Blank</span>
            )}
            <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 pointer-events-none"
                style={{ width: thumbWidth, height: thumbHeight }}
            />
        </div>
    );
};

export const PDFThumbnail: React.FC<PDFThumbnailProps> = ({ pageNumber, width = 120 }) => {
    const { pdfDocument, pages } = usePDFStore();
    const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
    const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
    const [rendering, setRendering] = useState(false);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const [scaleFactor, setScaleFactor] = useState(1);

    // We subscribe to the specific page state to trigger re-renders only when this page changes
    const pageState = pages.find(p => p.pageNumber === pageNumber);

    // 1. Render Base PDF Layer
    useEffect(() => {
        if (!pageState || pageState.source !== 'pdf' || !pdfDocument || !pdfCanvasRef.current) return;

        let renderTask: any = null;
        let isCancelled = false;

        const renderPDF = async () => {
            try {
                setRendering(true);
                const indexToFetch = pageState.originalPageIndex;
                if (!indexToFetch) return;

                const page = await pdfDocument.getPage(indexToFetch);
                if (isCancelled) return;

                const viewport = page.getViewport({ scale: 1 });
                const boxScale = width / viewport.width;
                const scaledViewport = page.getViewport({ scale: boxScale });

                const canvas = pdfCanvasRef.current;
                if (!canvas) return;

                const context = canvas.getContext('2d');
                if (!context) return;

                // Set dimensions
                canvas.width = scaledViewport.width;
                canvas.height = scaledViewport.height;
                setCanvasSize({ width: scaledViewport.width, height: scaledViewport.height });
                setScaleFactor(boxScale);

                renderTask = page.render({
                    canvasContext: context,
                    viewport: scaledViewport,
                });

                await renderTask.promise;
            } catch (err: any) {
                if (err.name !== 'RenderingCancelledException') {
                    console.error('Thumbnail PDF render error:', err);
                }
            } finally {
                if (!isCancelled) setRendering(false);
            }
        };

        renderPDF();

        return () => {
            isCancelled = true;
            if (renderTask) {
                renderTask.cancel();
            }
        };
    }, [pdfDocument, pageState?.originalPageIndex, pageState?.source, width]); // Only re-render PDF if source/doc/width changes

    // 2. Render Annotation Layer (Drawings, Objects)
    useEffect(() => {
        const canvas = annotationCanvasRef.current;
        if (!canvas || !pageState || canvasSize.width === 0) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Match dimensions
        canvas.width = canvasSize.width;
        canvas.height = canvasSize.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Render all objects using the accurate scale factor from PDF rendering
        pageState.objects.forEach(obj => {
            drawObject(ctx, obj, scaleFactor);
        });

    }, [pageState?.objects, canvasSize, scaleFactor]); // Re-run when objects change or canvas resizes

    if (!pageState) return null;

    if (pageState.source === 'image' && pageState.content) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 overflow-hidden relative">
                <img src={pageState.content} alt={`Page ${pageNumber}`} className="max-w-full max-h-full object-contain" />
                {/* Overlay Annotations for Image Pages too */}
                <canvas
                    ref={annotationCanvasRef}
                    className="absolute inset-0 pointer-events-none mx-auto"
                    style={{
                        // We might need to adjust this if image doesn't fill the container 
                        // But for now, assuming full cover or consistent aspect ratio
                        width: '100%',
                        height: '100%'
                    }}
                />
            </div>
        );
    }

    if (pageState.source === 'blank') {
        const bgColor = pageState.backgroundColor || '#ffffff';
        const isDark = bgColor !== '#ffffff' && bgColor !== 'white';

        // Calculate thumbnail dimensions for blank page
        const aspectRatio = pageState.height / pageState.width;
        const thumbWidth = width;
        const thumbHeight = width * aspectRatio;
        const blankScale = thumbWidth / pageState.width;

        return (
            <BlankThumbnail
                bgColor={bgColor}
                isDark={isDark}
                thumbWidth={thumbWidth}
                thumbHeight={thumbHeight}
                blankScale={blankScale}
                objects={pageState.objects}
            />
        );
    }

    return (
        <div
            className={clsx("w-full h-full bg-white flex items-center justify-center relative", rendering ? "animate-pulse bg-gray-200" : "")}
            onContextMenu={(e) => {
                e.preventDefault();
                if (pageState) {
                    useEditorStore.getState().openContextMenu(e.clientX, e.clientY, 'thumbnail', { pageId: pageState.id });
                }
            }}
        >
            {/* PDF Layer */}
            <canvas ref={pdfCanvasRef} className="block mx-auto shadow-sm" />

            {/* Annotation Layer (Overlay) */}
            <canvas
                ref={annotationCanvasRef}
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{
                    width: canvasSize.width > 0 ? canvasSize.width : 'auto',
                    height: canvasSize.height > 0 ? canvasSize.height : 'auto'
                }}
            />
        </div>
    );
};
