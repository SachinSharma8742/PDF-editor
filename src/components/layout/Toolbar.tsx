import React, { useRef, useState } from 'react';
import { usePDFStore } from '../../store/pdfStore';
import {
    MousePointer2,
    Hand,
    Minus,
    Plus,
    Undo2,
    Redo2,
    Pencil,
    Sun,
    Moon,
    RotateCw,
    FlipHorizontal,
    FlipVertical,
    Download,
    Layers,
    Lock,
    Image as ImageIcon,
    ChevronDown,
    Type
} from 'lucide-react';
import { loadPDF } from '../../utils/pdfOps';
import { saveDocument, saveDocumentFlattened, exportPageAsImage } from '../../utils/exportUtils';
import { useEditorStore } from '../../store/editorStore';
import clsx from 'clsx';
import { Tooltip } from '../ui/Tooltip';

export const Toolbar: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [exportFormat, setExportFormat] = useState<'standard' | 'flattened' | 'png'>('standard');
    const [exportQuality, setExportQuality] = useState(0.8);
    const [isExporting, setIsExporting] = useState(false);

    const {
        scale,
        setScale,
        activeTool,
        setActiveTool,
        undo,
        redo,
        canUndo,
        canRedo,
        setPdfDocument,
        setIsLoading,
        currentPage,
        addObject,
        pages,
        rotatePage,
        flipPage,
        theme,
        toggleTheme,
        pdfDocument,
        fileName,
        isSelectionMode,
        selectedPageIds
    } = usePDFStore();

    // Check if there are any pages
    const hasPages = pages.length > 0;

    // Export handler
    const handleExport = async () => {
        if (!pdfDocument && pages.length === 0) return;
        setIsExporting(true);
        try {
            const pagesToExport = isSelectionMode && selectedPageIds.length > 0
                ? pages.filter(p => selectedPageIds.includes(p.id))
                : pages;

            if (exportFormat === 'standard') {
                const originalBytes = await pdfDocument?.getData();
                await saveDocument(pagesToExport, originalBytes?.buffer || null);
            } else if (exportFormat === 'flattened') {
                await saveDocumentFlattened(pagesToExport, pdfDocument, exportQuality);
            } else if (exportFormat === 'png') {
                for (const page of pagesToExport) {
                    await exportPageAsImage(page, 'png', exportQuality, pdfDocument);
                }
            }
            setIsExportOpen(false);
        } catch (e) {
            console.error(e);
            alert('Export failed');
        } finally {
            setIsExporting(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const arrayBuffer = ev.target?.result as ArrayBuffer;
                if (!arrayBuffer) return;
                try {
                    setIsLoading(true);
                    const doc = await loadPDF(arrayBuffer.slice(0));
                    setPdfDocument(doc, arrayBuffer, file.name);
                } catch (error) {
                    console.error("Failed to load PDF:", error);
                    alert("Error loading PDF");
                } finally {
                    setIsLoading(false);
                }
            };
            reader.readAsArrayBuffer(file);
        }
        e.target.value = '';
    };

    const insertImageCorrectly = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            const img = new Image();
            img.onload = () => {
                const targetWidth = 200;
                const targetHeight = (img.height / img.width) * targetWidth;
                const currentPageId = pages.find(p => p.pageNumber === currentPage)?.id || `page-${currentPage}`;
                if (currentPageId) {
                    addObject(currentPageId, {
                        id: crypto.randomUUID(),
                        type: 'image',
                        x: 100, y: 100,
                        width: targetWidth, height: targetHeight,
                        src: dataUrl
                    });
                    setActiveTool('select');
                }
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    return (
        <div className="flex flex-col items-center gap-3 w-full cursor-default select-none pointer-events-none">
            {/* MAIN COMMAND CENTER */}
            <div className="pointer-events-auto bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl rounded-2xl border border-gray-200/50 dark:border-white/10 p-1.5 flex items-center shadow-2xl shadow-black/10 dark:shadow-black/40 transition-all duration-500">

                {/* 1. History */}
                <div className="flex items-center gap-0.5 pr-2 mr-2 border-r border-gray-200 dark:border-white/10">

                    <button onClick={undo} disabled={!canUndo()} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-400 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-zinc-200 disabled:opacity-30 transition-all active:scale-95">
                        <Undo2 size={18} strokeWidth={2.5} />
                    </button>


                    <button onClick={redo} disabled={!canRedo()} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-400 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-zinc-200 disabled:opacity-30 transition-all active:scale-95">
                        <Redo2 size={18} strokeWidth={2.5} />
                    </button>

                </div>

                {/* 2. Tools */}
                <div className="flex items-center gap-1 pr-2 mr-2 border-r border-gray-200 dark:border-white/10">

                    <button onClick={() => setActiveTool('select')} className={clsx("p-2 rounded-xl transition-all duration-200 relative group", activeTool === 'select' ? "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5")}>
                        <MousePointer2 size={18} strokeWidth={activeTool === 'select' ? 2.5 : 2} />
                    </button>


                    <button onClick={() => setActiveTool('pan')} className={clsx("p-2 rounded-xl transition-all duration-200 relative group", activeTool === 'pan' ? "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5")}>
                        <Hand size={18} strokeWidth={activeTool === 'pan' ? 2.5 : 2} />
                    </button>

                </div>

                {/* 3. Text Editing Mode - Opens Studio */}


                <div className={clsx("flex items-center gap-1 pr-2 mr-2 border-r border-gray-200 dark:border-white/10", !hasPages && "opacity-40 pointer-events-none")}>

                    <button onClick={() => { const p = pages.find(pg => pg.pageNumber === currentPage); if (p) rotatePage(p.id, 'cw'); }} disabled={!hasPages} className={clsx("p-2 rounded-xl transition-all duration-200 relative group text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5", !hasPages && "cursor-not-allowed")}>
                        <RotateCw size={18} strokeWidth={2} />
                    </button>


                    <button onClick={() => { const p = pages.find(pg => pg.pageNumber === currentPage); if (p) flipPage(p.id, 'horizontal'); }} disabled={!hasPages} className={clsx("p-2 rounded-xl transition-all duration-200 relative group text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5", !hasPages && "cursor-not-allowed")}>
                        <FlipHorizontal size={18} strokeWidth={2} />
                    </button>


                    <button onClick={() => { const p = pages.find(pg => pg.pageNumber === currentPage); if (p) flipPage(p.id, 'vertical'); }} disabled={!hasPages} className={clsx("p-2 rounded-xl transition-all duration-200 relative group text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5", !hasPages && "cursor-not-allowed")}>
                        <FlipVertical size={18} strokeWidth={2} />
                    </button>

                </div>
                <div className="flex items-center gap-1 pr-2 mr-2 border-r border-gray-200 dark:border-white/10">

                    <button
                        onClick={() => {
                            // Directly use pdfStore - no editor initialization needed
                            const page = pages.find(p => p.pageNumber === currentPage);
                            if (page) {
                                useEditorStore.getState().openNativeTextStudio(page.id);
                            } else {
                                alert("Please load a PDF first.");
                            }
                        }}
                        className="p-2 rounded-xl text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all duration-200 relative group"
                    >
                        <Type size={18} strokeWidth={2} />
                    </button>

                </div>

                {/* 5. System Controls */}
                <div className="flex items-center gap-2 pl-1">
                    {hasPages && (

                        <button
                            onClick={() => { const page = pages.find(p => p.pageNumber === currentPage); if (page) useEditorStore.getState().initEditor(page); }}
                            className="p-2.5 mr-1 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 transition-all active:scale-95 border border-indigo-400/30"
                        >
                            <Pencil size={18} strokeWidth={2.5} />
                        </button>

                    )}

                    <div className="flex items-center bg-gray-100 dark:bg-zinc-800 rounded-lg p-0.5 border border-transparent dark:border-white/5">
                        <button onClick={() => setScale(Math.max(0.1, scale - 0.1))} className="p-1 hover:bg-white dark:hover:bg-zinc-700 rounded-md text-gray-500 dark:text-zinc-400 transition-all"><Minus size={12} /></button>
                        <span className="text-[10px] w-8 text-center tabular-nums text-gray-700 dark:text-zinc-300 font-bold">{Math.round(scale * 100)}%</span>
                        <button onClick={() => setScale(Math.min(5, scale + 0.1))} className="p-1 hover:bg-white dark:hover:bg-zinc-700 rounded-md text-gray-500 dark:text-zinc-400 transition-all"><Plus size={12} /></button>
                    </div>


                    <button onClick={toggleTheme} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-400 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-zinc-100 transition-all duration-300 [&:active>svg]:rotate-45">
                        <span className="block transition-transform duration-300">
                            {theme === 'dark' ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
                        </span>
                    </button>


                    {/* Export Button with Hover Dropdown */}
                    {hasPages && (
                        <div
                            className="relative ml-2 group/export"
                            onMouseEnter={() => setIsExportOpen(true)}
                            onMouseLeave={() => setIsExportOpen(false)}
                        >
                            <button
                                className="h-9 px-4 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-gray-100 text-white dark:text-zinc-900 rounded-xl transition-all shadow-lg active:scale-95 flex items-center gap-2 group"
                            >
                                <Download size={14} strokeWidth={2.5} />
                                <span className="text-xs font-bold tracking-wide">Export</span>
                                <ChevronDown size={12} className={clsx("transition-transform duration-300 opacity-60", isExportOpen && "rotate-180")} />
                            </button>

                            {/* Invisible bridge to prevent hover loss */}
                            {isExportOpen && (
                                <div className="absolute top-full left-0 right-0 h-2" />
                            )}

                            {/* Export Dropdown Menu */}
                            {isExportOpen && (
                                <div className="absolute top-full right-0 mt-2 w-72 bg-zinc-900 dark:bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl shadow-black/50 p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                                    <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">Export Format</div>

                                    <div className="space-y-2">
                                        {[
                                            { id: 'standard', icon: Layers, label: 'Standard PDF', desc: 'Vector layers & editable' },
                                            { id: 'flattened', icon: Lock, label: 'Flattened PDF', desc: 'Single image layer' },
                                            { id: 'png', icon: ImageIcon, label: 'PNG Images', desc: 'High-res per page' }
                                        ].map(f => (
                                            <button
                                                key={f.id}
                                                onClick={() => setExportFormat(f.id as any)}
                                                className={clsx(
                                                    "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group",
                                                    exportFormat === f.id
                                                        ? "bg-blue-600/20 border-blue-500/50 text-blue-400"
                                                        : "bg-white/[0.02] border-white/5 text-zinc-400 hover:bg-white/[0.05] hover:text-white"
                                                )}
                                            >
                                                <div className={clsx(
                                                    "p-2 rounded-lg border transition-colors",
                                                    exportFormat === f.id ? "bg-blue-600 border-blue-400 text-white" : "bg-black/20 border-white/5 text-zinc-500"
                                                )}>
                                                    <f.icon size={14} />
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-black uppercase tracking-wide leading-none mb-0.5">{f.label}</div>
                                                    <div className="text-[9px] opacity-60">{f.desc}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>

                                    {exportFormat !== 'standard' && (
                                        <div className="space-y-2 p-3 bg-black/30 rounded-xl border border-white/5">
                                            <div className="flex justify-between items-center text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                                                <span>Quality</span>
                                                <span className="text-blue-400 tabular-nums">{Math.round(exportQuality * 100)}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0.1" max="1" step="0.05"
                                                value={exportQuality}
                                                onChange={(e) => setExportQuality(parseFloat(e.target.value))}
                                                className="w-full accent-blue-500"
                                            />
                                        </div>
                                    )}

                                    <button
                                        onClick={handleExport}
                                        disabled={isExporting}
                                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                                    >
                                        {isExporting ? (
                                            <><RotateCw className="animate-spin" size={14} /> Processing...</>
                                        ) : (
                                            <><Download size={14} /> Download {isSelectionMode && selectedPageIds.length > 0 ? `${selectedPageIds.length} Pages` : 'All'}</>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Removed Contextual Properties Bar - Now handled by EditorLeftPanel */}

            <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileUpload} hidden />
            <input ref={imageInputRef} type="file" accept="image/*" onChange={insertImageCorrectly} hidden />
        </div>
    );
};
