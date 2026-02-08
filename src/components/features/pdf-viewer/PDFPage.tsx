import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { usePDFStore } from '../../../store/pdfStore';
import { useEditorStore } from '../../../store/editorStore';
import { Loader2 } from 'lucide-react';
import { PageSelectionOverlay } from '../page-operations/PageSelectionOverlay';
import { CanvasLayer } from '../editor/CanvasLayer';
import { PDFTextLayer } from './PDFTextLayer';

interface PDFPageProps {
    pageNumber: number;
}

export const PDFPage: React.FC<PDFPageProps> = ({ pageNumber }) => {
    const { pdfDocument, scale, pages } = usePDFStore();
    const pageState = pages.find(p => p.pageNumber === pageNumber);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [rendering, setRendering] = useState(false);
    const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

    // Effect for PDF Rendering
    useEffect(() => {
        if (!pageState || pageState.source !== 'pdf') return;

        let renderTask: any = null;
        let isCancelled = false;

        const renderPage = async () => {
            // Use originalPageIndex for PDF fetching
            const indexToFetch = pageState.originalPageIndex;
            if (!pdfDocument || !canvasRef.current || !indexToFetch) return;

            setRendering(true);
            try {
                const page = await pdfDocument.getPage(indexToFetch);

                if (isCancelled) return;

                const viewport = page.getViewport({ scale });

                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');

                if (!context) return;

                const outputScale = window.devicePixelRatio || 1;
                const cssWidth = Math.floor(viewport.width);
                const cssHeight = Math.floor(viewport.height);

                canvas.width = Math.floor(viewport.width * outputScale);
                canvas.height = Math.floor(viewport.height * outputScale);
                canvas.style.width = cssWidth + "px";
                canvas.style.height = cssHeight + "px";

                setDimensions({ width: cssWidth, height: cssHeight });

                const transform = outputScale !== 1
                    ? [outputScale, 0, 0, outputScale, 0, 0]
                    : undefined;

                const renderContext = {
                    canvasContext: context,
                    transform: transform,
                    viewport: viewport,
                };

                // Cancel previous render if any (though logic below handles it via cleanup)
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
            if (renderTask) {
                renderTask.cancel();
            }
        };
    }, [pdfDocument, pageNumber, scale, pageState]); // Depend on pageState to catch index changes

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

            {/* Content Layer */}
            {pageState.source === 'pdf' && (
                <canvas ref={canvasRef} className="block" />
            )}

            {pageState.source === 'image' && pageState.content && dimensions && (
                <img
                    src={pageState.content}
                    alt={`Page ${pageNumber}`}
                    style={{ width: dimensions.width, height: dimensions.height, display: 'block' }}
                />
            )}

            {pageState.source === 'blank' && dimensions && (
                <div style={{
                    width: dimensions.width,
                    height: dimensions.height,
                    backgroundColor: pageState.backgroundColor || '#ffffff'
                }} />
            )}

            {/* Text Edits Overlay - Shows pending edits in view mode */}
            {dimensions && pageState.source === 'pdf' && (
                <PDFTextLayer
                    pageNumber={pageNumber}
                    scale={scale}
                    viewOnly={true}
                />
            )}

            {/* Editing Layer */}
            {dimensions && (
                <CanvasLayer
                    pageId={pageState.id!}
                    pageNumber={pageNumber}
                    width={dimensions.width}
                    height={dimensions.height}
                    scale={scale}
                />
            )}

            {/* Watermark Overlay */}
            {pageState.watermark && pageState.watermark.text && dimensions && (
                <div
                    className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center z-[6]"
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
                        <span
                            style={{
                                fontSize: (pageState.watermark.fontSize || 80) * scale,
                                color: pageState.watermark.color || '#000000',
                                transform: `rotate(${pageState.watermark.rotate || -45}deg)`,
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap',
                                userSelect: 'none',
                                fontFamily: 'sans-serif'
                            }}
                        >
                            {pageState.watermark.text}
                        </span>
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
                                .replace('{{total}}', `${pages.length}`)
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
                                .replace('{{total}}', `${pages.length}`)
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
};
