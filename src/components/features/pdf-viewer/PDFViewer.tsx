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

    // Scroll Tracking Effect
    useEffect(() => {
        if (!pdfDocument || pages.length === 0) return;

        // Cleanup previous observer
        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        const options = {
            root: null, // Use the browser viewport/nearest scrollable parent automatically
            threshold: [0, 0.25, 0.5, 0.75, 1],
            rootMargin: '-25% 0px -25% 0px' // Focus on the middle 50% of the screen
        };

        const activeIntersections = new Map<number, number>();

        observerRef.current = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const pageNumber = parseInt(entry.target.id.replace('page-', ''));
                if (!isNaN(pageNumber)) {
                    if (entry.isIntersecting) {
                        activeIntersections.set(pageNumber, entry.intersectionRatio);
                    } else {
                        activeIntersections.delete(pageNumber);
                    }
                }
            });

            // Find page with highest intersection ratio
            let mostVisiblePage = -1;
            let maxRatio = -1;

            activeIntersections.forEach((ratio, pageNum) => {
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
        <div className="flex-1 bg-transparent flex flex-col items-center p-8 transition-all duration-300 ease-out relative">
            {(pages as any[]).map((page: any) => (
                <PDFPage key={page.pageNumber} pageNumber={page.pageNumber} />
            ))}
        </div>
    );
};
