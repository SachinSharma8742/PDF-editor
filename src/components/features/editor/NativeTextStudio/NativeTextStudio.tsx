import React, { useState, useEffect, useRef } from 'react';
import { useEditorStore } from '../../../../store/editorStore';
import { usePDFStore } from '../../../../store/pdfStore';
import { X, Save, Undo2, Redo2, Type, Search, ScanLine, Replace, Scale, ShieldAlert } from 'lucide-react';
import { SinglePageCanvas, type SinglePageCanvasHandle } from './SinglePageCanvas';
import { NativeTextProperties } from '../NativeTextProperties';
import { FindReplacePanel } from './FindReplacePanel';
import { OCRPanel } from './OCRPanel';
import { AdvancedReplacePanel } from './AdvancedReplacePanel';
import { ClausePanel } from './ClausePanel';
import { RiskScorePanel } from './RiskScorePanel';
import type { NativeTextItem } from '../../../../store/editorStore';
import clsx from 'clsx';

export const NativeTextStudio: React.FC = () => {
    const {
        nativeTextStudio,
        closeNativeTextStudio,
        findReplaceState,
        setFindReplaceOpen,
        clearFindReplace,
        ocrState,
        setOCROpen,
        commitNativeTextEdits,
    } = useEditorStore();
    const { pdfDocument, pages, theme } = usePDFStore();
    const [textItems, setTextItems] = useState<Record<string, unknown>[]>([]);
    const canvasRef = useRef<SinglePageCanvasHandle>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [advancedReplaceOpen, setAdvancedReplaceOpen] = useState(false);
    const [clausePanelOpen, setClausePanelOpen] = useState(false);
    const [riskPanelOpen, setRiskPanelOpen] = useState(false);

    const pageState = pages.find(p => p.id === nativeTextStudio.pageId);

    // Load text items from PDF page
    useEffect(() => {
        if (!pdfDocument || !pageState || pageState.source !== 'pdf') return;

        const loadText = async () => {
            try {
                const page = await pdfDocument.getPage(pageState.originalPageIndex!);
                const textContent = await (page as unknown as { getTextContent: () => Promise<{ items: Record<string, unknown>[] }> }).getTextContent();
                const items = textContent.items
                    .filter((item: Record<string, unknown>) => (item.str as string)?.trim())
                    .map((item: Record<string, unknown>) => ({
                        ...item,
                        id: `text-${pageState.pageNumber}-${Number((item.transform as number[])[4]).toFixed(2)}-${Number((item.transform as number[])[5]).toFixed(2)}`,
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
        if (advancedReplaceOpen) setAdvancedReplaceOpen(false);
    };

    const toggleAdvancedReplace = () => {
        setAdvancedReplaceOpen(!advancedReplaceOpen);
        if (findReplaceState.isOpen) setFindReplaceOpen(false);
        if (ocrState.isOpen) setOCROpen(false);
        if (clausePanelOpen) setClausePanelOpen(false);
    };

    const toggleClausePanel = () => {
        setClausePanelOpen(!clausePanelOpen);
        if (findReplaceState.isOpen) setFindReplaceOpen(false);
        if (ocrState.isOpen) setOCROpen(false);
        if (advancedReplaceOpen) setAdvancedReplaceOpen(false);
        if (riskPanelOpen) setRiskPanelOpen(false);
    };

    const toggleRiskPanel = () => {
        setRiskPanelOpen(!riskPanelOpen);
        if (findReplaceState.isOpen) setFindReplaceOpen(false);
        if (ocrState.isOpen) setOCROpen(false);
        if (advancedReplaceOpen) setAdvancedReplaceOpen(false);
        if (clausePanelOpen) setClausePanelOpen(false);
    };

    // Cast textItems to NativeTextItem[] for the AdvancedReplacePanel
    const nativeTextItemsCasted = textItems as unknown as NativeTextItem[];

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-[#18181b] animate-in slide-in-from-bottom-5 duration-300 transition-colors">
            {/* Top Bar */}
            <div className="h-14 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between px-4 md:px-6 bg-white dark:bg-[#18181b] shrink-0 transition-colors">
                <div className="flex items-center gap-3">
                    {/* Mobile Sidebar Toggle */}
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="md:hidden p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                    >
                        <ScanLine size={20} className="rotate-90" />
                    </button>

                    <div className="p-2 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-lg text-indigo-600 dark:text-indigo-400 hidden md:block transition-colors">
                        <Type size={20} />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider hidden md:block">PDF Text Studio</h2>
                        <h2 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider md:hidden">Text Studio</h2>
                    </div>
                </div>

                <div className="flex items-center gap-1 md:gap-2">
                    {/* Find & Replace Toggle */}
                    <button
                        onClick={toggleFindReplace}
                        className={clsx(
                            "p-2 rounded-lg transition-colors flex items-center gap-1.5",
                            findReplaceState.isOpen
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5"
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
                                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30"
                                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5"
                        )}
                        title="OCR Scanner"
                    >
                        <ScanLine size={18} />
                    </button>
                    {/* Advanced Replace Toggle */}
                    <button
                        onClick={toggleAdvancedReplace}
                        className={clsx(
                            "p-2 rounded-lg transition-colors flex items-center gap-1.5",
                            advancedReplaceOpen
                                ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
                                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5"
                        )}
                        title="Advanced Replace"
                    >
                        <Replace size={18} />
                    </button>
                    {/* Clause Detection Toggle */}
                    <button
                        onClick={toggleClausePanel}
                        className={clsx(
                            "p-2 rounded-lg transition-colors flex items-center gap-1.5",
                            clausePanelOpen
                                ? "bg-violet-600 text-white shadow-lg shadow-violet-500/30"
                                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5"
                        )}
                        title="Analyze Clauses"
                    >
                        <Scale size={18} />
                    </button>
                    {/* Risk Analysis Toggle */}
                    <button
                        onClick={toggleRiskPanel}
                        className={clsx(
                            "p-2 rounded-lg transition-colors flex items-center gap-1.5",
                            riskPanelOpen
                                ? "bg-orange-600 text-white shadow-lg shadow-orange-500/30"
                                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5"
                        )}
                        title="Risk Analysis"
                    >
                        <ShieldAlert size={18} />
                    </button>
                    <div className="w-[1px] h-6 bg-zinc-200 dark:bg-white/10 mx-1 hidden md:block" />
                    <button className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors hidden md:block">
                        <Undo2 size={18} />
                    </button>
                    <button className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors hidden md:block">
                        <Redo2 size={18} />
                    </button>
                    <div className="w-[1px] h-6 bg-zinc-200 dark:bg-white/10 mx-1 md:mx-2" />
                    <button
                        onClick={handleSave}
                        className="px-3 py-1.5 md:px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                    >
                        <Save size={14} />
                        <span className="hidden md:inline">Save & Close</span>
                        <span className="md:hidden">Save</span>
                    </button>
                    <button
                        onClick={handleClose}
                        className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Main Workspace */}
            <div className="flex-1 flex overflow-hidden relative transition-colors">

                {/* Sidebar - Properties Panel */}
                <div className={clsx(
                    "bg-zinc-50 dark:bg-[#1e1e20] p-4 pt-24 md:pt-4 overflow-y-auto space-y-4 border-r border-zinc-200 dark:border-white/10 transition-all duration-300 absolute z-20 inset-y-0 left-0 md:relative w-80 shadow-2xl md:shadow-none",
                    isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
                )}>
                    {/* Find & Replace Panel */}
                    <FindReplacePanel textItems={textItems} />

                    {/* Advanced Replace Panel */}
                    <AdvancedReplacePanel textItems={nativeTextItemsCasted} isOpen={advancedReplaceOpen} />

                    {/* OCR Panel */}
                    <OCRPanel canvasRef={canvasRef} textItems={textItems} />

                    {/* Clause Detection Panel */}
                    {clausePanelOpen && <ClausePanel textItems={nativeTextItemsCasted} />}

                    {/* Risk Score Panel */}
                    {riskPanelOpen && <RiskScorePanel textItems={nativeTextItemsCasted} />}

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
                <div className="flex-1 overflow-hidden bg-zinc-100 dark:bg-[#09090b] relative w-full z-0 transition-colors">
                    {/* Dot Grid Background */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none"
                        style={{
                            backgroundImage: theme === 'dark' ? 'radial-gradient(#ffffff 1px, transparent 1px)' : 'radial-gradient(#000000 1px, transparent 1px)',
                            backgroundSize: '20px 20px'
                        }}
                    />

                    <SinglePageCanvas ref={canvasRef} pageId={nativeTextStudio.pageId} />
                </div>

            </div>
        </div>
    );
};
