import React, { useEffect, useRef, useState } from 'react';
import { usePDFStore, type PDFObject } from '../../../store/pdfStore';
import { useEditorStore } from '../../../store/editorStore';
import { ThumbnailCache } from '../../../utils/thumbnailCache';
import clsx from 'clsx';
// import * as pdfjsLib from 'pdfjs-dist'; // Not directly used, store has it

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
                ctx.lineTo(x + obj.points[i] * scale, y + obj.points[1 + 1] * scale);
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
    const { pdfDocument, pages, fileName } = usePDFStore();
    const { openContextMenu } = useEditorStore();
    const containerRef = useRef<HTMLDivElement>(null);
    const annotationCanvasRef = useRef<HTMLCanvasElement>(null);

    // State
    const [isVisible, setIsVisible] = useState(false);
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [rendering, setRendering] = useState(false);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const [scaleFactor, setScaleFactor] = useState(1);

    const pageState = pages.find(p => p.pageNumber === pageNumber);

    // 1. Intersection Observer (Lazy Loading)
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect(); // Once loaded, keep it (or we could unload to save MEM, but caching handles reload speed)
                }
            },
            { rootMargin: '200px' } // Load when within 200px of viewport
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, []);

    // 2. Render PDF Layer (with Caching)
    useEffect(() => {
        if (!isVisible || !pageState || pageState.source !== 'pdf' || !pdfDocument) return;

        // Key for cache: Filename + PageIndex + Width
        // Ideally we use a hash, but fileName is a decent proxy for now alongside page count/size checks if we had them.
        const cacheKey = ThumbnailCache.getKey(fileName || 'untitled', pageState.originalPageIndex || 0, width);
        let isCancelled = false;

        // Set rendering true immediately to show spinner while loading
        setRendering(true);

        const render = async () => {
            // Check Cache First
            const cachedBlob = await ThumbnailCache.get(cacheKey);
            if (cachedBlob && !isCancelled) {
                const url = URL.createObjectURL(cachedBlob);
                setImageSrc(url);
                setRendering(false); // Clear spinner once cache is loaded

                // We still need dimensions to set up annotation layer
                const img = new Image();
                img.onload = () => {
                    setCanvasSize({ width: img.width, height: img.height });
                    // Calculate scale relative to original PageState check? 
                    // Actually we rendered it at 'width'.
                    // So scale factor = img.width / pageState.width.
                    if (pageState.width) {
                        setScaleFactor(img.width / pageState.width);
                    }
                };
                img.src = url;
                return;
            }

            // Render fresh (rendering already true)
            try {
                const page = await pdfDocument.getPage(pageState.originalPageIndex);
                if (isCancelled) return;

                const viewport = page.getViewport({ scale: 1 });
                const boxScale = width / viewport.width;
                const scaledViewport = page.getViewport({ scale: boxScale });

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                if (!context) return;

                canvas.width = scaledViewport.width;
                canvas.height = scaledViewport.height;

                await page.render({
                    canvasContext: context,
                    viewport: scaledViewport,
                }).promise;

                if (isCancelled) return;

                // Save to Cache
                canvas.toBlob(async (blob) => {
                    if (blob) {
                        await ThumbnailCache.save(cacheKey, blob);
                        if (!isCancelled) {
                            const url = URL.createObjectURL(blob);
                            setImageSrc(url);
                            setCanvasSize({ width: canvas.width, height: canvas.height });
                            setScaleFactor(boxScale);
                        }
                    }
                });

            } catch (error) {
                console.error('Thumbnail render error:', error);
            } finally {
                if (!isCancelled) setRendering(false);
            }
        };

        render();

        return () => {
            isCancelled = true;
            // Cleanup object URLs if needed? usually React handles simple src swaps but good practice if heavily unloading
        };
    }, [isVisible, pageState?.id, pageState?.originalPageIndex, width, pdfDocument, fileName]); // Re-run if page changes

    // 3. Render Annotation Layer (Drawings, Objects)
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

    }, [pageState?.objects, canvasSize, scaleFactor]);

    if (!pageState) return null;

    // Handle Image Source Pages
    if (pageState.source === 'image' && pageState.content) {
        return (
            <div
                ref={containerRef}
                className="w-full h-full flex items-center justify-center bg-gray-100 overflow-hidden relative"
                onContextMenu={(e) => {
                    e.preventDefault();
                    openContextMenu(e.clientX, e.clientY, 'thumbnail', { pageId: pageState.id });
                }}
            >
                {isVisible ? (
                    <>
                        <img src={pageState.content} alt={`Page ${pageNumber}`} className="max-w-full max-h-full object-contain" />
                        <canvas
                            ref={annotationCanvasRef}
                            className="absolute inset-0 pointer-events-none mx-auto"
                            style={{ width: '100%', height: '100%' }}
                        />
                    </>
                ) : (
                    <div className="w-full h-full animate-pulse bg-gray-200" />
                )}
            </div>
        );
    }

    // Handle Blank Pages
    if (pageState.source === 'blank') {
        const bgColor = pageState.backgroundColor || '#ffffff';
        const isDark = bgColor !== '#ffffff' && bgColor !== 'white';

        // Calculate thumbnail dimensions for blank page
        const aspectRatio = pageState.height / pageState.width;
        const thumbWidth = width;
        const thumbHeight = width * aspectRatio;
        const blankScale = thumbWidth / pageState.width;

        return (
            <div ref={containerRef} className="w-full h-full"
                onContextMenu={(e) => {
                    e.preventDefault();
                    openContextMenu(e.clientX, e.clientY, 'thumbnail', { pageId: pageState.id });
                }}
            >
                <BlankThumbnail
                    bgColor={bgColor}
                    isDark={isDark}
                    thumbWidth={thumbWidth}
                    thumbHeight={thumbHeight}
                    blankScale={blankScale}
                    objects={pageState.objects}
                />
            </div>

        );
    }

    // Standard PDF Page
    return (
        <div
            ref={containerRef}
            className={clsx(
                "w-full h-full bg-white flex items-center justify-center relative transition-colors",
                rendering ? "bg-gray-50" : ""
            )}
            style={{ minHeight: width * 1.414 }} // Approx A4 aspect ratio placeholder
            onContextMenu={(e) => {
                e.preventDefault();
                openContextMenu(e.clientX, e.clientY, 'thumbnail', { pageId: pageState.id });
            }}
        >
            {!isVisible || rendering ? (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : null}

            {imageSrc && (
                <img
                    src={imageSrc}
                    className="block shadow-sm object-contain max-w-full max-h-full"
                    alt={`Page ${pageNumber}`}
                />
            )}

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
