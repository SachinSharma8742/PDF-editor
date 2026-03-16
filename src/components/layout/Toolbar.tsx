
import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePDFStore } from '../../store/pdfStore';
import {
    Download,
    ChevronDown,
    Image as ImageIcon,
    Type,
    Undo2,
    Redo2,
    MousePointer2,
    Hand,
    RotateCw,
    Printer,
    Menu,
    Layers,
    Lock,
    Minus,
    Plus,
    Sun,
    Moon,
    FlipHorizontal,
    FlipVertical,
    Pencil,
    Clock
} from 'lucide-react';
import { loadPDF } from '../../utils/pdfOps';
import { saveDocument, saveDocumentFlattened, exportPageAsImage } from '../../utils/exportUtils';
import { useEditorStore } from '../../store/editorStore';
import { TimelineModal } from '../features/editor/TimelineModal';
import clsx from 'clsx';


export const Toolbar: React.FC<{ onMenuClick?: () => void }> = ({ onMenuClick }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const exportBtnRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [exportFormat, setExportFormat] = useState<'standard' | 'flattened' | 'png' | 'print'>('standard');
    const [exportQuality, setExportQuality] = useState(0.8);
    const [isExporting, setIsExporting] = useState(false);
    const [isTimelineOpen, setIsTimelineOpen] = useState(false);

    // Handle click outside to close export menu
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isExportOpen &&
                exportBtnRef.current &&
                !exportBtnRef.current.contains(event.target as Node) &&
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsExportOpen(false);
            }
        };

        if (isExportOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isExportOpen]);

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
        isSelectionMode,
        selectedPageIds,
        originalPdfBytes
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
                await saveDocument(pagesToExport, originalPdfBytes);
            } else if (exportFormat === 'flattened') {
                await saveDocumentFlattened(pagesToExport, pdfDocument, exportQuality);
            } else if (exportFormat === 'png') {
                // For PNG, if no selection is made, default to CURRENT PAGE ONLY
                // instead of all pages (which causes multiple downloads/popups)
                const pagesToExportPng = (isSelectionMode && selectedPageIds.length > 0)
                    ? pagesToExport
                    : pages.filter(p => p.pageNumber === currentPage);

                for (const page of pagesToExportPng) {
                    await exportPageAsImage(page, 'png', exportQuality, pdfDocument);
                }
            } else if (exportFormat === 'print') {
                // Updated to use the new Print Modal
                const pageIdsToPrint = (isSelectionMode && selectedPageIds.length > 0)
                    ? selectedPageIds
                    : null; // null means all pages
                useEditorStore.getState().openPrintModal(pageIdsToPrint);
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
                const currentPageId = pages.find(p => p.pageNumber === currentPage)?.id || `page - ${currentPage} `;
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
            {/* MAIN COMMAND CENTER - Redesigned as Glass Sheet */}
            <div className="pointer-events-auto bg-white/70 dark:bg-[#18181b]/80 backdrop-blur-2xl rounded-2xl border border-zinc-200/60 dark:border-white/5 p-1.5 flex items-center shadow-[0_15px_35px_rgba(0,0,0,0.05)] dark:shadow-2xl transition-all duration-500 overflow-x-auto max-w-[95vw] md:max-w-none no-scrollbar">

                {/* 0. Mobile Menu Toggle */}
                <button
                    onClick={onMenuClick}
                    className="md:hidden p-2.5 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl text-zinc-600 dark:text-zinc-400 border-r border-zinc-200 dark:border-white/10 mr-1.5"
                >
                    <Menu size={18} strokeWidth={2.5} />
                </button>

                {/* 1. History */}
                <div className="flex items-center gap-1 pr-3 mr-3 border-r border-zinc-200 dark:border-white/10">
                    <button onClick={undo} disabled={!canUndo()} className="p-2.5 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 disabled:opacity-20 transition-all active:scale-90">
                        <Undo2 size={18} strokeWidth={2.5} />
                    </button>

                    <button onClick={redo} disabled={!canRedo()} className="p-2.5 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 disabled:opacity-20 transition-all active:scale-90">
                        <Redo2 size={18} strokeWidth={2.5} />
                    </button>

                    <button
                        onClick={() => setIsTimelineOpen(true)}
                        className="p-2.5 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-all active:scale-90"
                        title="Version Timeline"
                    >
                        <Clock size={18} strokeWidth={2.5} />
                    </button>
                </div>

                {/* 2. Tools */}
                <div className="flex items-center gap-1 pr-3 mr-3 border-r border-zinc-200 dark:border-white/10">
                    <button onClick={() => setActiveTool('select')} className={clsx("p-2.5 rounded-xl transition-all duration-300 relative group", activeTool === 'select' ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white")}>
                        <MousePointer2 size={18} strokeWidth={2.5} />
                    </button>

                    <button onClick={() => setActiveTool('pan')} className={clsx("p-2.5 rounded-xl transition-all duration-300 relative group", activeTool === 'pan' ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white")}>
                        <Hand size={18} strokeWidth={2.5} />
                    </button>
                </div>

                {/* 3. Page Orientation */}
                <div className={clsx("flex items-center gap-1 pr-3 mr-3 border-r border-zinc-200 dark:border-white/10", !hasPages && "opacity-20 pointer-events-none")}>
                    <button onClick={() => { const p = pages.find(pg => pg.pageNumber === currentPage); if (p) rotatePage(p.id, 'cw'); }} disabled={!hasPages} className="p-2.5 rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white transition-all active:scale-90">
                        <RotateCw size={18} strokeWidth={2.5} />
                    </button>

                    <button onClick={() => { const p = pages.find(pg => pg.pageNumber === currentPage); if (p) flipPage(p.id, 'horizontal'); }} disabled={!hasPages} className="p-2.5 rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white transition-all active:scale-90">
                        <FlipHorizontal size={18} strokeWidth={2.5} />
                    </button>

                    <button onClick={() => { const p = pages.find(pg => pg.pageNumber === currentPage); if (p) flipPage(p.id, 'vertical'); }} disabled={!hasPages} className="p-2.5 rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white transition-all active:scale-90">
                        <FlipVertical size={18} strokeWidth={2.5} />
                    </button>
                </div>

                {/* 4. Primary Actions */}
                <div className="flex items-center gap-3 pl-1 pr-2">
                    {hasPages && (
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => {
                                    const page = pages.find(p => p.pageNumber === currentPage);
                                    if (page) useEditorStore.getState().openNativeTextStudio(page.id);
                                }}
                                className="px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xl hover:scale-[1.02] transition-all active:scale-95 flex items-center gap-2"
                            >
                                <Type size={16} strokeWidth={3} />
                                <span className="text-[10px] font-black uppercase tracking-[0.15em] hidden sm:inline">Edit Text</span>
                            </button>

                            <button
                                onClick={() => {
                                    const page = pages.find(p => p.pageNumber === currentPage);
                                    if (page) useEditorStore.getState().initEditor(page);
                                }}
                                className="px-4 py-2.5 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/30 hover:scale-[1.02] transition-all active:scale-95 flex items-center gap-2"
                            >
                                <Pencil size={16} strokeWidth={3} />
                                <span className="text-[10px] font-black uppercase tracking-[0.15em] hidden sm:inline">Annotate</span>
                            </button>
                        </div>
                    )}

                    {/* 5. System Controls */}
                    <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 border border-zinc-200 dark:border-white/5">
                        <button onClick={() => setScale(Math.max(0.1, scale - 0.1))} className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-lg text-zinc-500 dark:text-zinc-400 transition-all shadow-sm dark:shadow-none"><Minus size={14} strokeWidth={3} /></button>
                        <span className="text-[10px] w-10 text-center tabular-nums text-zinc-900 dark:text-zinc-100 font-black hidden md:block">{Math.round(scale * 100)}%</span>
                        <button onClick={() => setScale(Math.min(5, scale + 0.1))} className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-lg text-zinc-500 dark:text-zinc-400 transition-all shadow-sm dark:shadow-none"><Plus size={14} strokeWidth={3} /></button>
                    </div>

                    <button onClick={toggleTheme} className="p-2.5 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all active:scale-90 group">
                        {theme === 'dark' ? (
                            <Sun size={18} strokeWidth={2.5} className="group-hover:rotate-90 transition-transform duration-500" />
                        ) : (
                            <Moon size={18} strokeWidth={2.5} className="group-hover:-rotate-12 transition-transform duration-500" />
                        )}
                    </button>

                    {/* Export Button */}
                    {hasPages && (
                        <div ref={exportBtnRef} className="relative">
                            <button
                                onClick={() => setIsExportOpen(!isExportOpen)}
                                className={clsx(
                                    "h-10 px-5 rounded-xl transition-all shadow-xl active:scale-95 flex items-center gap-3 group border",
                                    isExportOpen
                                        ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900"
                                        : "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border-zinc-200 dark:border-white/10"
                                )}
                            >
                                <Download size={16} strokeWidth={3} />
                                <span className="text-[10px] font-black uppercase tracking-[0.15em] hidden lg:inline">Export</span>
                                <ChevronDown size={14} className={clsx("transition-transform duration-500 opacity-40", isExportOpen && "rotate-180")} />
                            </button>

                            {/* Export Dropdown Menu - Portal */}
                            {isExportOpen && createPortal(
                                <div
                                    ref={dropdownRef}
                                    className="fixed z-[9999]"
                                    style={{
                                        top: (exportBtnRef.current?.getBoundingClientRect().bottom || 0) + 8,
                                        left: (exportBtnRef.current?.getBoundingClientRect().right || 0) - 288,
                                    }}
                                >
                                    <div className="w-72 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border border-zinc-200 dark:border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-2xl p-4 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                                        <div className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] px-1">Export Format</div>

                                        <div className="space-y-2">
                                            {(['standard', 'flattened', 'png', 'print'] as const).map(id => {
                                                const f = {
                                                    standard: { icon: Layers, label: 'Standard PDF', desc: 'Vector & Editable' },
                                                    flattened: { icon: Lock, label: 'Flattened PDF', desc: 'Single image layer' },
                                                    png: { icon: ImageIcon, label: 'PNG Images', desc: 'High-res per page' },
                                                    print: { icon: Printer, label: 'Print', desc: 'Native print dialog' }
                                                }[id];

                                                return (
                                                    <button
                                                        key={id}
                                                        onClick={() => setExportFormat(id)}
                                                        className={clsx(
                                                            "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group",
                                                            exportFormat === id
                                                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20 border-blue-500"
                                                                : "bg-zinc-50 dark:bg-white/[0.02] border-zinc-100 dark:border-white/5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.05] hover:text-zinc-900 dark:hover:text-white"
                                                        )}
                                                    >
                                                        <div className={clsx(
                                                            "p-2 rounded-lg border transition-colors",
                                                            exportFormat === id ? "bg-white/20 border-white/20 text-white" : "bg-white dark:bg-black/20 border-zinc-200 dark:border-white/5 text-zinc-400 dark:text-zinc-500"
                                                        )}>
                                                            <f.icon size={14} strokeWidth={2.5} />
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] font-black uppercase tracking-wider mb-0.5">{f.label}</div>
                                                            <div className="text-[9px] opacity-60 font-bold">{f.desc}</div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {exportFormat !== 'standard' && (
                                            <div className="space-y-2 p-3 bg-zinc-100 dark:bg-black/30 rounded-xl border border-zinc-200 dark:border-white/5 shadow-inner dark:shadow-none">
                                                <div className="flex justify-between items-center text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                                                    <span>Quality</span>
                                                    <span className="text-blue-600 dark:text-blue-400 tabular-nums">{Math.round(exportQuality * 100)}%</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0.1" max="1" step="0.05"
                                                    value={exportQuality}
                                                    onChange={(e) => setExportQuality(parseFloat(e.target.value))}
                                                    className="w-full accent-blue-600"
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
                                                <><Download size={14} strokeWidth={3} /> Download {isSelectionMode && selectedPageIds.length > 0 ? `${selectedPageIds.length} Pages` : 'All'}</>
                                            )}
                                        </button>
                                    </div>
                                </div>,
                                document.body
                            )}
                        </div>
                    )}
                </div>
            </div>

            <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileUpload} hidden />
            <input ref={imageInputRef} type="file" accept="image/*" onChange={insertImageCorrectly} hidden />

            {/* Version Timeline Modal */}
            <TimelineModal isOpen={isTimelineOpen} onClose={() => setIsTimelineOpen(false)} />
        </div>
    );
};
