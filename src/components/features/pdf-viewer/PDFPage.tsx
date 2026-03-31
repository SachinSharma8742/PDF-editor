import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { usePDFStore } from '../../../store/pdfStore';
import { useEditorStore } from '../../../store/editorStore';
import { Loader2 } from 'lucide-react';
import { PageSelectionOverlay } from '../page-operations/PageSelectionOverlay';
import { CanvasLayer } from '../editor/CanvasLayer';
import { PDFTextLayer } from './PDFTextLayer';
import { useShallow } from 'zustand/react/shallow';

interface PDFPageProps {
    pageNumber: number;
}

// Helper to render the background image/canvas
const BackgroundLayer: React.FC<{
    image: HTMLCanvasElement | HTMLImageElement | null;
    width: number;
    height: number;
}> = ({ image, width, height }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !image) return;

        container.innerHTML = '';
        // If it's a canvas, we can append it directly if it's not used elsewhere, 
        // OR draw it to a new canvas. 
        // Since bufferCanvas logic creates a new 'finalBg' canvas, we can append it safely.
        // For Image objects, we might want to clone or separate.

        if (image instanceof HTMLCanvasElement) {
            image.style.width = '100%';
            image.style.height = '100%';
            image.style.display = 'block';
            container.appendChild(image);
        } else {
            // For HTMLImageElement
            const img = image.cloneNode() as HTMLImageElement;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.display = 'block';
            container.appendChild(img);
        }

    }, [image]);

    return (
        <div
            ref={containerRef}
            className="absolute inset-0 z-0 pointer-events-none"
            style={{ width, height }}
        />
    );
};

export const PDFPage = React.memo<PDFPageProps>(({ pageNumber }) => {
    const pdfDocument = usePDFStore(s => s.pdfDocument);
    const scale = usePDFStore(s => s.scale);
    const totalPages = usePDFStore(s => s.pages.length);
    
    // Only re-render if THIS specific page's state actually changes
    const pageState = usePDFStore(useShallow(s => s.pages.find(p => p.pageNumber === pageNumber)));


    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [rendering, setRendering] = useState(false);
    const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
    const [bgImage, setBgImage] = useState<HTMLCanvasElement | HTMLImageElement | null>(null);
    const bufferCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));

    // Effect for syncing fast dimensions on zoom/scale change
    useEffect(() => {
        if (!pageState || pageState.source !== 'pdf' || !pdfDocument) return;
        const indexToFetch = pageState.originalPageIndex;
        if (indexToFetch === undefined) return;

        let isCancelled = false;
        pdfDocument.getPage(indexToFetch).then(page => {
            if (isCancelled) return;
            const baseViewport = page.getViewport({ scale: 1 });
            setDimensions({
                width: Math.floor(baseViewport.width * scale),
                height: Math.floor(baseViewport.height * scale)
            });
        }).catch(() => {});
        
        return () => { isCancelled = true; };
    }, [pdfDocument, pageState?.originalPageIndex, scale, pageState?.source]);

    // Effect for Heavy PDF Rendering (ONCE)
    useEffect(() => {
        if (!pageState || pageState.source !== 'pdf') return;

        let renderTask: any = null;
        let isCancelled = false;

        const renderPage = async () => {
            const indexToFetch = pageState.originalPageIndex;
            if (!pdfDocument || indexToFetch === undefined) return;

            setRendering(true);
            try {
                const page = await pdfDocument.getPage(indexToFetch);
                if (isCancelled) return;

                // Render at a consistent resolution for the background state
                const viewport = page.getViewport({ scale: 2 });
                const bufferCanvas = bufferCanvasRef.current;
                const context = bufferCanvas.getContext('2d');
                if (!context) return;

                bufferCanvas.width = viewport.width;
                bufferCanvas.height = viewport.height;

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport,
                };

                renderTask = page.render(renderContext);
                await renderTask.promise;

                if (!isCancelled) {
                    const finalBg = document.createElement('canvas');
                    finalBg.width = bufferCanvas.width;
                    finalBg.height = bufferCanvas.height;
                    const finalCtx = finalBg.getContext('2d');
                    finalCtx?.drawImage(bufferCanvas, 0, 0);
                    setBgImage(finalBg);
                }
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
    }, [pdfDocument, pageNumber, pageState?.source, pageState?.originalPageIndex, pageState?.rotation]);

    // Handle image-based background
    useEffect(() => {
        if (pageState?.source === 'image' && pageState.content) {
            const img = new Image();
            img.src = pageState.content;
            img.onload = () => {
                setBgImage(img as any);
                setDimensions({
                    width: (pageState.width || img.width) * scale,
                    height: (pageState.height || img.height) * scale
                });
            };
        }
    }, [pageState?.source, pageState?.content, scale]);

    // Effect for Non-PDF Dimensions
    useEffect(() => {
        if (!pageState || pageState.source === 'pdf') return;

        if (pageState.width && pageState.height) {
            setDimensions({
                width: pageState.width * scale,
                height: pageState.height * scale
            });
        }
    }, [pageState, scale]);

    if (!pageState) return null;

    return (
        <div
            id={`page-${pageNumber}`}
            data-page-id={pageState.id}
            ref={wrapperRef}
            className="relative mb-8 bg-white mx-auto scroll-mt-4 transition-all duration-500 shadow-2xl shadow-black/5 dark:shadow-none dark:ring-1 dark:ring-white/10"
            style={{
                width: dimensions ? dimensions.width : 'auto',
                height: dimensions ? dimensions.height : '800px',
                transform: `rotate(${pageState.rotation || 0}deg) scaleX(${pageState.flipX ? -1 : 1}) scaleY(${pageState.flipY ? -1 : 1})`,
                transition: 'transform 0.3s ease-in-out'
            }}
            onContextMenu={(e) => {
                e.preventDefault();
                const { openContextMenu } = useEditorStore.getState();
                openContextMenu(e.clientX, e.clientY, 'page', { pageId: pageState.id });
            }}
        >
            <PageSelectionOverlay pageNumber={pageNumber} pageId={pageState.id!} />

            {/* 1. Background Layer (Original PDF/Image) - Conditional: Only if NOT rendering in CanvasLayer */}
            {dimensions && bgImage && !pageState.objects.some(o => o.type === 'effect') && (
                <BackgroundLayer
                    image={bgImage}
                    width={dimensions.width}
                    height={dimensions.height}
                />
            )}

            {/* 2. Text Edits Overlay (Redactions + New Text) - z-20 (Lowered to sit below CanvasLayer z-30) 
                REMOVED: Now handled inside CanvasLayer to support filters.
            */}
            {/* {dimensions && pageState.source === 'pdf' && (
                <div className="absolute inset-0 z-20 pointer-events-none">
                    <PDFTextLayer
                        pageNumber={pageNumber}
                        scale={scale}
                        viewOnly={true}
                    />
                </div>
            )} */}

            {/* 3. Objects Layer (Detailed Content + Effects) - z-30 */}
            {dimensions && (
                <CanvasLayer
                    pageId={pageState.id!}
                    pageNumber={pageNumber}
                    width={dimensions.width}
                    height={dimensions.height}
                    scale={scale}
                    bgImage={pageState.objects.some(o => o.type === 'effect') ? bgImage : undefined}
                />
            )}

            {/* Watermark Overlay */}
            {pageState.watermark && pageState.watermark.text && dimensions && (
                <div
                    className="absolute inset-0 pointer-events-none overflow-hidden z-[6]"
                    style={{ opacity: pageState.watermark.opacity ?? 0.2 }}
                >
                    {pageState.watermark.isRepeating ? (
                        <div className="flex flex-wrap content-center justify-center gap-16 -rotate-12 scale-150 w-[200%] h-[200%]">
                            {Array.from({ length: 40 }).map((_, i) => (
                                <span
                                    key={i}
                                    style={{
                                        fontSize: (pageState.watermark?.fontSize || 40) * scale,
                                        color: pageState.watermark?.color || '#000000',
                                        fontWeight: 'bold',
                                        userSelect: 'none',
                                        fontFamily: 'sans-serif'
                                    }}
                                >
                                    {pageState.watermark?.text}
                                </span>
                            ))}
                        </div>
                    ) : (
                        (() => {
                            const wm = pageState.watermark!;
                            const position = wm.position || 'center';
                            const fontSize = (wm.fontSize || 80) * scale;
                            const inset = Math.max(20, fontSize * 0.35);
                            const angle = wm.rotate ?? -25;

                            const baseStyle: React.CSSProperties = {
                                position: 'absolute',
                                fontSize,
                                color: wm.color || '#000000',
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap',
                                userSelect: 'none',
                                fontFamily: 'sans-serif',
                            };

                            if (position === 'top-left') {
                                return <span style={{ ...baseStyle, top: inset, left: inset, transform: `rotate(${angle}deg)` }}>{wm.text}</span>;
                            }
                            if (position === 'top-center') {
                                return <span style={{ ...baseStyle, top: inset, left: '50%', transform: `translateX(-50%) rotate(${angle}deg)` }}>{wm.text}</span>;
                            }
                            if (position === 'top-right') {
                                return <span style={{ ...baseStyle, top: inset, right: inset, transform: `rotate(${angle}deg)` }}>{wm.text}</span>;
                            }
                            if (position === 'middle-left') {
                                return <span style={{ ...baseStyle, top: '50%', left: inset, transform: `translateY(-50%) rotate(${angle}deg)` }}>{wm.text}</span>;
                            }
                            if (position === 'middle-right') {
                                return <span style={{ ...baseStyle, top: '50%', right: inset, transform: `translateY(-50%) rotate(${angle}deg)` }}>{wm.text}</span>;
                            }
                            if (position === 'bottom-left') {
                                return <span style={{ ...baseStyle, bottom: inset, left: inset, transform: `rotate(${angle}deg)` }}>{wm.text}</span>;
                            }
                            if (position === 'bottom-center') {
                                return <span style={{ ...baseStyle, bottom: inset, left: '50%', transform: `translateX(-50%) rotate(${angle}deg)` }}>{wm.text}</span>;
                            }
                            if (position === 'bottom-right') {
                                return <span style={{ ...baseStyle, bottom: inset, right: inset, transform: `rotate(${angle}deg)` }}>{wm.text}</span>;
                            }

                            return (
                                <span
                                    style={{
                                        ...baseStyle,
                                        top: '50%',
                                        left: '50%',
                                        transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                                    }}
                                >
                                    {wm.text}
                                </span>
                            );
                        })()
                    )}
                </div>
            )}

            {/* Header/Footer Overlay */}
            {(pageState.structure?.header || pageState.structure?.footer) && dimensions && (
                <div className="absolute inset-0 pointer-events-none z-[7] flex flex-col justify-between p-8">
                    {/* Header */}
                    {pageState.structure?.header?.text ? (
                        <div style={{
                            textAlign: pageState.structure.header.align as any,
                            color: pageState.structure.header.color,
                            fontSize: pageState.structure.header.fontSize * scale,
                            opacity: pageState.structure.header.opacity ?? 1,
                            fontFamily: 'sans-serif',
                            whiteSpace: 'pre-wrap'
                        }}>
                            {pageState.structure.header.text
                                .replace('{{page}}', `${pageState.pageNumber}`)
                                .replace('{{total}}', `${totalPages}`)
                                .replace('{{date}}', new Date().toLocaleDateString())}
                        </div>
                    ) : <div />}

                    {/* Footer */}
                    {pageState.structure?.footer?.text ? (
                        <div style={{
                            textAlign: pageState.structure.footer.align as any,
                            color: pageState.structure.footer.color,
                            fontSize: pageState.structure.footer.fontSize * scale,
                            opacity: pageState.structure.footer.opacity ?? 1,
                            fontFamily: 'sans-serif',
                            whiteSpace: 'pre-wrap'
                        }}>
                            {pageState.structure.footer.text
                                .replace('{{page}}', `${pageState.pageNumber}`)
                                .replace('{{total}}', `${totalPages}`)
                                .replace('{{date}}', new Date().toLocaleDateString())}
                        </div>
                    ) : <div />}
                </div>
            )}

            {rendering && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-[#09090b]/60 backdrop-blur-[2px] z-10 animate-in fade-in duration-300">
                    <div className="flex flex-col items-center gap-3">
                        <div className="relative">
                            <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
                            <Loader2 className="animate-spin text-blue-600 dark:text-blue-400 relative" size={32} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Rendering</span>
                    </div>
                </div>
            )}
        </div>
    );
});
