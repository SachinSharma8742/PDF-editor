import React, { useState, useEffect, useRef } from 'react';
import { useEditorStore } from '../../../../store/editorStore';
import { usePDFStore } from '../../../../store/pdfStore';
import { X, Save, Undo2, Redo2, Type, Search, ScanLine } from 'lucide-react';
import { SinglePageCanvas, type SinglePageCanvasHandle } from './SinglePageCanvas';
import { NativeTextProperties } from '../NativeTextProperties';
import { FindReplacePanel } from './FindReplacePanel';
import { OCRPanel } from './OCRPanel';
import * as pdfjsLib from 'pdfjs-dist';
import clsx from 'clsx';

export const NativeTextStudio: React.FC = () => {
    const {
        nativeTextStudio,
        closeNativeTextStudio,
        pendingNativeTextEdits,
        findReplaceState,
        setFindReplaceOpen,
        clearFindReplace,
        ocrState,
        setOCROpen,
        startOCR,
        commitNativeTextEdits,
        updateNativeTextEdit
    } = useEditorStore();
    const { pdfDocument, pages } = usePDFStore();
    const [textItems, setTextItems] = useState<any[]>([]);
    const canvasRef = useRef<SinglePageCanvasHandle>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const pageState = pages.find(p => p.id === nativeTextStudio.pageId);

    // Load text items from PDF page
    useEffect(() => {
        if (!pdfDocument || !pageState || pageState.source !== 'pdf') return;

        const loadText = async () => {
            try {
                const page = await pdfDocument.getPage(pageState.originalPageIndex!);
                const textContent = await page.getTextContent();
                const items = textContent.items
                    .filter((item: any) => item.str?.trim())
                    .map((item: any) => ({
                        ...item,
                        id: `text-${pageState.pageNumber}-${Number(item.transform[4]).toFixed(2)}-${Number(item.transform[5]).toFixed(2)}`,
                        text: item.str
                    }));
                setTextItems(items);
            } catch (err) {
                console.error("Error loading text items:", err);
            }
        };
        loadText();
    }, [pdfDocument, pageState]);

    if (!nativeTextStudio.isOpen || !nativeTextStudio.pageId) return null;

    const handleSave = () => {
        commitNativeTextEdits();
        clearFindReplace();
        closeNativeTextStudio();
    };

    const handleClose = () => {
        // Clear pending edits if cancelling? 
        // Or should we keep them if they re-open?
        // Usually cancel means discard.
        // We need a way to clear pending edits without committing. 
        // We can just iterate and reset? Or add a clear action?
        // For now, let's just close. The store keeps pending edits until committed or cleared.
        // If we want discard, we should add `clearNativeTextEdits` to editorStore. 
        // Let's implement a quick clear by setting empty object if needed, but for now just close.
        // Actually, let's manually clear pending edits to be safe/correct for "Cancel".
        useEditorStore.setState({ pendingNativeTextEdits: {}, activeNativeTextItem: null });

        clearFindReplace();
        closeNativeTextStudio();
    };

    const toggleFindReplace = () => {
        setFindReplaceOpen(!findReplaceState.isOpen);
        if (ocrState.isOpen) setOCROpen(false);
    };

    const toggleOCR = () => {
        setOCROpen(!ocrState.isOpen);
        if (findReplaceState.isOpen) setFindReplaceOpen(false);
    };

    const handleOCRScan = async () => {
        const canvas = canvasRef.current?.getCanvas();
        if (canvas) {
            const dataUrl = canvas.toDataURL('image/png');
            await startOCR(dataUrl);
        }
    };



    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-[#18181b] animate-in slide-in-from-bottom-5 duration-300">
            {/* Top Bar */}
            <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 md:px-6 bg-[#18181b] shrink-0">
                <div className="flex items-center gap-3">
                    {/* Mobile Sidebar Toggle */}
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="md:hidden p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5"
                    >
                        <ScanLine size={20} className="rotate-90" />
                    </button>

                    <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400 hidden md:block">
                        <Type size={20} />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider hidden md:block">PDF Text Studio</h2>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider md:hidden">Text Studio</h2>
                    </div>
                </div>

                <div className="flex items-center gap-1 md:gap-2">
                    {/* Find & Replace Toggle */}
                    <button
                        onClick={toggleFindReplace}
                        className={clsx(
                            "p-2 rounded-lg transition-colors flex items-center gap-1.5",
                            findReplaceState.isOpen
                                ? "bg-indigo-600 text-white"
                                : "text-zinc-400 hover:text-white hover:bg-white/5"
                        )}
                        title="Find & Replace"
                    >
                        <Search size={18} />
                    </button>
                    {/* OCR Toggle */}
                    <button
                        onClick={toggleOCR}
                        className={clsx(
                            "p-2 rounded-lg transition-colors flex items-center gap-1.5",
                            ocrState.isOpen
                                ? "bg-emerald-600 text-white"
                                : "text-zinc-400 hover:text-white hover:bg-white/5"
                        )}
                        title="OCR Scanner"
                    >
                        <ScanLine size={18} />
                    </button>
                    <div className="w-[1px] h-6 bg-white/10 mx-1 hidden md:block" />
                    <button className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors hidden md:block">
                        <Undo2 size={18} />
                    </button>
                    <button className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors hidden md:block">
                        <Redo2 size={18} />
                    </button>
                    <div className="w-[1px] h-6 bg-white/10 mx-1 md:mx-2" />
                    <button
                        onClick={handleSave}
                        className="px-3 py-1.5 md:px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Save size={14} />
                        <span className="hidden md:inline">Save & Close</span>
                        <span className="md:hidden">Save</span>
                    </button>
                    <button
                        onClick={handleClose}
                        className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Main Workspace */}
            <div className="flex-1 flex overflow-hidden relative">

                {/* Sidebar - Properties Panel */}
                <div className={clsx(
                    "bg-[#1e1e20] p-4 pt-24 md:pt-4 overflow-y-auto space-y-4 border-r border-white/10 transition-all duration-300 absolute z-20 inset-y-0 left-0 md:relative w-80 shadow-2xl md:shadow-none",
                    isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
                )}>
                    {/* Find & Replace Panel */}
                    <FindReplacePanel textItems={textItems} />

                    {/* OCR Panel */}
                    <OCRPanel canvasRef={canvasRef} />

                    {/* Text Properties */}
                    <NativeTextProperties />
                </div>

                {/* Backdrop for mobile sidebar */}
                {isSidebarOpen && (
                    <div
                        className="absolute inset-0 bg-black/50 z-10 md:hidden backdrop-blur-sm"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}

                {/* Canvas Area */}
                <div className="flex-1 overflow-hidden bg-[#09090b] relative w-full z-0">
                    {/* Dot Grid Background */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none"
                        style={{
                            backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
                            backgroundSize: '20px 20px'
                        }}
                    />

                    <SinglePageCanvas ref={canvasRef} pageId={nativeTextStudio.pageId} />
                </div>

            </div>
        </div>
    );
};
