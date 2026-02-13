import React, { useEffect, useState, useRef } from 'react';
import { X, Printer, Loader2, AlertCircle } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { usePDFStore } from '../../store/pdfStore';
import { renderPageToBlob, printBlobs } from '../../utils/exportUtils';
import { Button } from '../ui/Button';

export const PrintModal = () => {
    const { printModal, closePrintModal } = useEditorStore();
    const { pages, pdfDocument } = usePDFStore();
    const [blobUrls, setBlobUrls] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const isMounted = useRef(false);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    // Generate previews when modal opens
    useEffect(() => {
        if (!printModal.isOpen) {
            // Cleanup URLs when closed
            if (blobUrls.length > 0) {
                blobUrls.forEach(url => URL.revokeObjectURL(url));
                setBlobUrls([]);
            }
            return;
        }

        const generatePreviews = async () => {
            setIsLoading(true);
            setProgress(0);
            setError(null);
            const urls: string[] = [];

            try {
                // Determine which pages to print
                const pagesToPrint = printModal.pageIds
                    ? pages.filter(p => printModal.pageIds!.includes(p.id))
                    : pages;

                if (pagesToPrint.length === 0) {
                    setError("No pages selected to print.");
                    setIsLoading(false);
                    return;
                }

                for (let i = 0; i < pagesToPrint.length; i++) {
                    if (!isMounted.current) return;

                    const page = pagesToPrint[i];
                    // Render for preview (lower quality/resolution might be enough for preview, 
                    // but we might want to use the SAME blob for printing to save time?
                    // actually renderPageToBlob defaults to scale=2. 
                    const { blob } = await renderPageToBlob(page, 'png', 0.8, pdfDocument);

                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        urls.push(url);
                    }
                    setProgress(Math.round(((i + 1) / pagesToPrint.length) * 100));
                }

                if (isMounted.current) {
                    setBlobUrls(urls);
                } else {
                    // Cleanup if unmounted
                    urls.forEach(u => URL.revokeObjectURL(u));
                }
            } catch (e: any) {
                console.error("Preview generation failed", e);
                setError("Failed to generate print preview.");
            } finally {
                if (isMounted.current) setIsLoading(false);
            }
        };

        generatePreviews();

    }, [printModal.isOpen, printModal.pageIds, pages, pdfDocument]);

    // Handle Print
    const handlePrint = async () => {
        await printBlobs(blobUrls);
        // We typically don't close modal immediately, or we can?
        // User needs to interact with system dialog.
        // Let's keep modal open so they can retry if needed, or close it manually.
    };

    if (!printModal.isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e1e20] w-[90vw] md:w-[600px] max-h-[90vh] rounded-xl shadow-2xl border border-white/10 flex flex-col text-zinc-200 font-sans">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#27272a]">
                    <div className="flex items-center gap-3">
                        <Printer className="text-blue-400" size={20} />
                        <h3 className="font-bold text-lg text-zinc-100">Print Preview</h3>
                    </div>
                    <button onClick={closePrintModal} className="p-2 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 min-h-[300px] bg-zinc-900/50">

                    {isLoading ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-4">
                            <Loader2 className="animate-spin text-blue-500" size={40} />
                            <div className="text-zinc-400 text-sm font-medium">Preparing pages... {progress}%</div>
                        </div>
                    ) : error ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-4 text-red-400">
                            <AlertCircle size={40} />
                            <div className="font-medium">{error}</div>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {blobUrls.map((url, index) => (
                                <div key={index} className="flex flex-col items-center gap-2">
                                    <div className="relative group shadow-2xl">
                                        <img
                                            src={url}
                                            alt={`Page ${index + 1}`}
                                            className="max-w-full w-[400px] bg-white border border-white/10"
                                        />
                                        <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-white/90 backdrop-blur-md">
                                            Page {index + 1}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 bg-[#18181b] flex justify-end gap-3 rounded-b-xl">
                    <Button variant="ghost" onClick={closePrintModal} className="text-zinc-400 hover:text-white">
                        Cancel
                    </Button>
                    <Button
                        onClick={handlePrint}
                        disabled={isLoading || blobUrls.length === 0}
                        className="bg-blue-600 hover:bg-blue-500 min-w-[120px]"
                    >
                        <Printer size={16} className="mr-2" />
                        Print
                    </Button>
                </div>
            </div>
        </div>
    );
};
