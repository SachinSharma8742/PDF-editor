import React, { useEffect, useRef, useState } from 'react';
import { usePDFStore } from '../../../../store/pdfStore';
import { CanvasLayer } from '../CanvasLayer';
import { PDFTextLayer } from '../../pdf-viewer/PDFTextLayer';
import { useEditorStore } from '../../../../store/editorStore';

interface SinglePageCanvasProps {
    pageId: string;
}

export const SinglePageCanvas: React.FC<SinglePageCanvasProps> = ({ pageId }) => {
    const { pages, pdfDocument } = usePDFStore();
    const { nativeTextStudio } = useEditorStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

    const pageState = pages.find(p => p.id === pageId);

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
};
