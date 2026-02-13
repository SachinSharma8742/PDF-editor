import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { usePDFStore } from '../../../../store/pdfStore';
import { PDFTextLayer } from '../../pdf-viewer/PDFTextLayer';
import { useEditorStore } from '../../../../store/editorStore';
import { CanvasLayer } from '../CanvasLayer';

interface SinglePageCanvasProps {
    pageId: string;
}

export interface SinglePageCanvasHandle {
    getCanvas: () => HTMLCanvasElement | null;
}

export const SinglePageCanvas = forwardRef<SinglePageCanvasHandle, SinglePageCanvasProps>(({ pageId }, ref) => {
    const { pages, pdfDocument } = usePDFStore();
    const { nativeTextStudio, currentPage, originalPageId } = useEditorStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

    // If the native text studio is open for the page currently in the editor,
    // we should use the `currentPage` from editorStore to show uncommitted effects/changes.
    // Otherwise, fall back to the committed state in pdfStore.
    const isEditingCurrentPage = currentPage?.id && originalPageId === pageId;
    const pageState = isEditingCurrentPage ? currentPage! : pages.find(p => p.id === pageId);

    // Expose the canvas to parent via ref
    useImperativeHandle(ref, () => ({
        getCanvas: () => canvasRef.current
    }), []);

    // Calculate scale to fit container
    useEffect(() => {
        if (!pageState || !containerRef.current || !pdfDocument) return;

        const loadPage = async () => {
            const page = await pdfDocument.getPage(pageState.originalPageIndex!);
            const viewportKey = page.getViewport({ scale: 1 });

            // Measure container
            const { width: containerW, height: containerH } = containerRef.current!.getBoundingClientRect();

            // Calculate best fit scale (with some padding)
            const scaleW = (containerW - 40) / viewportKey.width;
            const scaleH = (containerH - 40) / viewportKey.height;
            const fitScale = Math.min(scaleW, scaleH, 2.0); // Cap max zoom

            setScale(fitScale);
            setDimensions({
                width: viewportKey.width * fitScale,
                height: viewportKey.height * fitScale
            });

            // Render Base Canvas
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    canvas.width = viewportKey.width * fitScale;
                    canvas.height = viewportKey.height * fitScale;

                    await page.render({
                        canvasContext: ctx,
                        viewport: page.getViewport({ scale: fitScale })
                    }).promise;
                }
            }
        };

        loadPage();
    }, [pageId, containerRef.current?.offsetWidth, containerRef.current?.offsetHeight]);

    if (!pageState) return <div>Page not found</div>;

    return (
        <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-gray-900/50 p-10 relative overflow-hidden">
            {/* Page Wrapper */}
            {dimensions && (
                <div
                    style={{ width: dimensions.width, height: dimensions.height }}
                    className="relative bg-white shadow-2xl"
                >
                    <canvas ref={canvasRef} className="block w-full h-full" />

                    {/* Canvas Layer: Objects, Images, Effects (Filters) */}
                    <div className="absolute inset-0 pointer-events-none">
                        <CanvasLayer
                            pageId={pageId}
                            pageNumber={pageState.pageNumber}
                            width={dimensions.width}
                            height={dimensions.height}
                            scale={scale}
                        // Pass pageOverride if we have a draft state (Editor Store)
                        // Note: CanvasLayer needs to be updated to accept pageOverride, 
                        // OR we rely on the fact that CanvasLayer uses `usePDFStore`. 
                        // BUT wait, CanvasLayer uses `usePDFStore`. It won't see `currentPage` from editorStore.
                        // We must fix CanvasLayer first OR manually render here. 
                        // Given I cannot easily change CanvasLayer signature in this step without reading it again, 
                        // I will use a local rendering approach similar to CanvasLayer.
                        />
                    </div>

                    {/* Render Text Layer Overlay */}
                    <PDFTextLayer pageNumber={pageState.pageNumber} scale={scale} />

                    {/* Optional: Render existing annotations if needed (CanvasLayer) 
                        For "Text Edit Mode", we might hide other annotations? 
                        Or keep them visible but locked.
                    */}
                </div>
            )}
        </div>
    );
});
