import React, { useEffect, useRef } from 'react';
import { usePDFStore } from '../../../store/pdfStore';
import { PDFPage } from './PDFPage';
import { FileText } from 'lucide-react';


export const PDFViewer: React.FC = () => {
    const {
        pages,
        pdfDocument,
        undo,
        redo,
        deleteObjects,
        selectedObjectIds,
        setCurrentPage
    } = usePDFStore();


    const observerRef = useRef<IntersectionObserver | null>(null);
    const activeIntersections = useRef<Map<number, number>>(new Map());

    // Scroll Tracking Effect
    useEffect(() => {
        if (!pdfDocument || pages.length === 0) return;

        // Cleanup state on re-init
        activeIntersections.current.clear();

        // Cleanup previous observer
        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        const options = {
            root: null, // Use the browser viewport/nearest scrollable parent automatically
            threshold: [0, 0.25, 0.5, 0.75, 1],
            rootMargin: '-25% 0px -25% 0px' // Focus on the middle 50% of the screen
        };

        observerRef.current = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const pageNumber = parseInt(entry.target.id.replace('page-', ''));
                if (!isNaN(pageNumber)) {
                    if (entry.isIntersecting) {
                        activeIntersections.current.set(pageNumber, entry.intersectionRatio);
                    } else {
                        activeIntersections.current.delete(pageNumber);
                    }
                }
            });

            // Find page with highest intersection ratio
            let mostVisiblePage = -1;
            let maxRatio = -1;

            activeIntersections.current.forEach((ratio, pageNum) => {
                if (ratio > maxRatio) {
                    maxRatio = ratio;
                    mostVisiblePage = pageNum;
                }
            });

            if (mostVisiblePage !== -1) {
                const { currentPage } = usePDFStore.getState();
                if (mostVisiblePage !== currentPage) {
                    setCurrentPage(mostVisiblePage);
                }
            }
        }, options);

        // Wait for components to mount and register with observer
        const timeoutId = setTimeout(() => {
            pages.forEach(page => {
                const element = document.getElementById(`page-${page.pageNumber}`);
                if (element && observerRef.current) {
                    observerRef.current.observe(element);
                }
            });
        }, 150);

        return () => {
            if (observerRef.current) observerRef.current.disconnect();
            clearTimeout(timeoutId);
        };
    }, [pdfDocument, pages, setCurrentPage]); // Re-run when pages are added, removed, or reordered

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore inputs
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

            // Delete
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedObjectIds.length > 0) {
                    deleteObjects(selectedObjectIds);
                }
            }

            // Undo/Redo
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                redo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedObjectIds, undo, redo, deleteObjects]);



    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-Fit Scale on Load
    useEffect(() => {
        if (!pdfDocument || pages.length === 0 || !containerRef.current) return;

        const fitToWidth = () => {
            const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
            const padding = 32; // 2rem/p-8 approx or p-4 * 2
            const availableWidth = containerWidth - padding;

            // Find the widest page to ensure everything fits
            const maxPageWidth = Math.max(...pages.map(p => p.width));

            if (maxPageWidth > 0) {
                // Calculate scale to fit
                const fitScale = availableWidth / maxPageWidth;

                // If the natural scale (1) is too big for the screen, scale down.
                // Or if we purely want "Fit Width" behavior, we just set it.
                // Let's settle on: Scale down if too big, but don't scale up huge amounts automatically (capped at 1.5 or something?)
                // Actually, standard "Fit Width" usually just sets it.
                // User asked: "when i load an large image... scale gets overflow... automatically adjust size to fit"

                // So if fitScale < 1 (needs shrinking), definitely apply it.
                // If it fits naturally (fitScale >= 1), we might stick to 1.0 or user preference? 
                // Let's go with: Apply fitScale if it's significantly different from 1, but maybe cap max at 1.0 for initial load if user prefers 100%.
                // However, "Fit Width" is usually the best mobile default.

                // Let's cap at 1.0 to avoid upscaling small images too much, but allow downscaling.
                const targetScale = Math.min(fitScale, 1.0); // Don't auto-zoom in, only auto-zoom out.

                // Only apply if we are significantly off (avoid micro-adjustments)
                // And only on "first load" effectively? 
                // We can't easily track "first load" without a ref/state. 
                // But this effect runs on pdfDocument change, which is effectively load.

                // We'll update only if the current scale is causing overflow (scale > fitScale)
                // OR just force fit-width on load. content-overflow implies we should force fit-width.

                usePDFStore.getState().setScale(targetScale * 0.95); // 0.95 safety margin
            }
        };

        // Small delay to ensure layout is settled (sidebar, etc)
        const timeout = setTimeout(fitToWidth, 100);
        return () => clearTimeout(timeout);

    }, [pdfDocument, pages.length]); // Run when document/pages change

    if (!pdfDocument && pages.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-zinc-600 animate-in fade-in duration-700">
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
                    <div className="relative bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl">
                        <FileText size={48} className="text-gray-200 dark:text-zinc-700" />
                    </div>
                </div>
                <p className="text-sm font-black uppercase tracking-[0.2em]">No document loaded</p>
                <p className="text-[10px] mt-2 opacity-50 uppercase tracking-widest">Upload a PDF to start editing</p>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="flex-1 bg-transparent flex flex-col items-center p-4 md:p-8 transition-all duration-300 ease-out relative w-full overflow-x-hidden"
        >
            {(pages as any[]).map((page: any) => (
                <PDFPage key={page.pageNumber} pageNumber={page.pageNumber} />
            ))}
        </div>
    );
};
