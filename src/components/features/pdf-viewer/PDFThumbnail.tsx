import React, { useEffect, useRef, useState } from 'react';
import { usePDFStore } from '../../../store/pdfStore';
import { FileText, Image as ImageIcon } from 'lucide-react';
import clsx from 'clsx';
import * as pdfjsLib from 'pdfjs-dist';

interface PDFThumbnailProps {
    pageNumber: number;
    width?: number; // Target width for the thumbnail
}

export const PDFThumbnail: React.FC<PDFThumbnailProps> = ({ pageNumber, width = 120 }) => {
    const { pdfDocument, pages } = usePDFStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [rendering, setRendering] = useState(false);
    const pageState = pages.find(p => p.pageNumber === pageNumber);

    useEffect(() => {
        if (!pageState || pageState.source !== 'pdf' || !pdfDocument || !canvasRef.current) return;

        let renderTask: any = null;

        const render = async () => {
            try {
                setRendering(true);
                // Source pages are 1-indexed in PDF
                const indexToFetch = pageState.originalPageIndex;
                if (!indexToFetch) return;

                const page = await pdfDocument.getPage(indexToFetch);
                const viewport = page.getViewport({ scale: 1 });

                // Calculate scale to fit target width
                const scale = width / viewport.width;
                const scaledViewport = page.getViewport({ scale });

                const canvas = canvasRef.current;
                if (!canvas) return;

                const context = canvas.getContext('2d');
                if (!context) return;

                canvas.width = scaledViewport.width;
                canvas.height = scaledViewport.height;

                renderTask = page.render({
                    canvasContext: context,
                    viewport: scaledViewport,
                });

                await renderTask.promise;
            } catch (err) {
                console.error('Thumbnail render error:', err);
            } finally {
                setRendering(false);
            }
        };

        render();

        return () => {
            if (renderTask) {
                renderTask.cancel();
            }
        };
    }, [pdfDocument, pageNumber, pageState, width]);

    if (!pageState) return null;

    if (pageState.source === 'image' && pageState.content) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 overflow-hidden">
                <img src={pageState.content} alt={`Page ${pageNumber}`} className="max-w-full max-h-full object-contain" />
            </div>
        );
    }

    if (pageState.source === 'blank') {
        return (
            <div className="w-full h-full bg-white border border-gray-100 flex items-center justify-center">
                <span className="text-[10px] text-gray-300">Blank</span>
            </div>
        );
    }

    return (
        <div className={clsx("w-full h-full bg-white flex items-center justify-center relative", rendering ? "animate-pulse bg-gray-200" : "")}>
            <canvas ref={canvasRef} className="block mx-auto shadow-sm" />
        </div>
    );
};
