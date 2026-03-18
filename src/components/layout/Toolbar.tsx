
import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePDFStore } from '../../store/pdfStore';
import {
    Download,
    ChevronDown,
    Image as ImageIcon,
    Type,
    Undo2,
    Redo2,
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
    Pencil,
    Clock,
    SlidersHorizontal
} from 'lucide-react';
import { loadPDF } from '../../utils/pdfOps';
import { saveDocument, saveDocumentFlattened, exportPageAsImage } from '../../utils/exportUtils';
import { useEditorStore } from '../../store/editorStore';
import { TimelineModal } from '../features/editor/TimelineModal';
import clsx from 'clsx';
import { CompressionOverlay } from '../features/export/CompressionOverlay';


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
    const [isCompressionOpen, setIsCompressionOpen] = useState(false);
    const [compressionPageIndices, setCompressionPageIndices] = useState<number[]>([]);

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
        theme,
        toggleTheme,
        pdfDocument,
        isSelectionMode,
        selectedPageIds,
        originalPdfBytes
    } = usePDFStore();

    // Check if there are any pages
    const hasPages = pages.length > 0;
    const compactPrimaryActionClass = "group h-10 px-3 rounded-xl transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-95 flex items-center overflow-hidden whitespace-nowrap";
    const compactIconActionClass = "group h-10 px-3 rounded-xl transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-90 flex items-center overflow-hidden whitespace-nowrap";
    const compactPrimaryActionLabelClass = "hidden sm:block max-w-0 overflow-hidden whitespace-nowrap opacity-0 -translate-x-2 ml-0 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:max-w-[120px] group-hover:opacity-100 group-hover:translate-x-0 group-hover:ml-2.5";

    const getTargetPageIndices = () => (
        isSelectionMode && selectedPageIds.length > 0
            ? pages
                .map((page, index) => selectedPageIds.includes(page.id) ? index : -1)
                .filter((index) => index >= 0)
            : pages.map((_, index) => index)
    );

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
                    setActiveTool('pan');
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
                        className={clsx(
                            compactIconActionClass,
                            "text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-zinc-200"
                        )}
                        title="Version Timeline"
                        aria-label="Version Timeline"
                    >
                        <Clock size={18} strokeWidth={2.5} />
                        <span className={clsx(compactPrimaryActionLabelClass, "text-[10px] font-black uppercase tracking-[0.15em]")}>Timeline</span>
                    </button>
                </div>

                {/* 2. Tools */}
                <div className="flex items-center gap-1 pr-3 mr-3 border-r border-zinc-200 dark:border-white/10">
                    <button
                        onClick={() => setActiveTool('pan')}
                        className={clsx(
                            compactIconActionClass,
                            activeTool === 'pan'
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                                : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white"
                        )}
                        aria-label="Pan"
                    >
                        <Hand size={18} strokeWidth={2.5} />
                        <span className={clsx(compactPrimaryActionLabelClass, "text-[10px] font-black uppercase tracking-[0.15em]")}>Pan</span>
                    </button>
                </div>

                {/* 3. Page Orientation */}
                <div className={clsx("flex items-center gap-1 pr-3 mr-3 border-r border-zinc-200 dark:border-white/10", !hasPages && "opacity-20 pointer-events-none")}>
                    <button
                        onClick={() => { const p = pages.find(pg => pg.pageNumber === currentPage); if (p) rotatePage(p.id, 'cw'); }}
                        disabled={!hasPages}
                        className={clsx(
                            compactIconActionClass,
                            "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white"
                        )}
                        aria-label="Rotate"
                    >
                        <RotateCw size={18} strokeWidth={2.5} />
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
                                className={clsx(
                                    compactPrimaryActionClass,
                                    "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xl hover:scale-[1.02] hover:px-4 focus-visible:px-4"
                                )}
                                aria-label="Edit Text"
                            >
                                <Type size={16} strokeWidth={3} />
                                <span
                                    className={clsx(
                                        compactPrimaryActionLabelClass,
                                        "text-[10px] font-black uppercase tracking-[0.15em]"
                                    )}
                                >
                                    Edit Text
                                </span>
                            </button>

                            <button
                                onClick={() => {
                                    const page = pages.find(p => p.pageNumber === currentPage);
                                    if (page) useEditorStore.getState().initEditor(page);
                                }}
                                className={clsx(
                                    compactPrimaryActionClass,
                                    "bg-blue-600 text-white shadow-lg shadow-blue-500/30 hover:scale-[1.02] hover:px-4 focus-visible:px-4"
                                )}
                                aria-label="Annotate"
                            >
                                <Pencil size={16} strokeWidth={3} />
                                <span
                                    className={clsx(
                                        compactPrimaryActionLabelClass,
                                        "text-[10px] font-black uppercase tracking-[0.15em]"
                                    )}
                                >
                                    Annotate
                                </span>
                            </button>
                        </div>
                    )}

                    {/* 5. System Controls */}
                    <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 border border-zinc-200 dark:border-white/5">
                        <button
                            onClick={() => setScale(Math.max(0.1, scale - 0.1))}
                            className="group h-8 px-2 rounded-lg hover:bg-white dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-all duration-300 ease-out shadow-sm dark:shadow-none flex items-center overflow-hidden whitespace-nowrap"
                            aria-label="Zoom Out"
                        >
                            <Minus size={14} strokeWidth={3} />
                        </button>
                        <span className="text-[10px] w-10 text-center tabular-nums text-zinc-900 dark:text-zinc-100 font-black hidden md:block">{Math.round(scale * 100)}%</span>
                        <button
                            onClick={() => setScale(Math.min(5, scale + 0.1))}
                            className="group h-8 px-2 rounded-lg hover:bg-white dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-all duration-300 ease-out shadow-sm dark:shadow-none flex items-center overflow-hidden whitespace-nowrap"
                            aria-label="Zoom In"
                        >
                            <Plus size={14} strokeWidth={3} />
                        </button>
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
                                    compactPrimaryActionClass,
                                    "shadow-xl border",
                                    isExportOpen
                                        ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900"
                                        : "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border-zinc-200 dark:border-white/10"
                                )}
                                aria-label="Export"
                            >
                                <Download size={16} strokeWidth={3} />
                                <span className={clsx(compactPrimaryActionLabelClass, "text-[10px] font-black uppercase tracking-[0.15em]")}>Export</span>
                                <ChevronDown size={14} className={clsx("ml-2 transition-transform duration-500 opacity-40", isExportOpen && "rotate-180")} />
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
                                    <div className="w-72 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-3xl border border-zinc-200/80 dark:border-white/10 rounded-2xl shadow-[0_30px_60px_-12px_rgba(0,0,0,0.15)] dark:shadow-2xl p-4 space-y-4 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-500">
                                        <div className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.2em] px-1">Export Palette</div>

                                        <div className="space-y-1.5">
                                            {(['standard', 'flattened', 'png', 'print'] as const).map(id => {
                                                const f = {
                                                    standard: { icon: Layers, label: 'Standard PDF', desc: 'Preserves vector data' },
                                                    flattened: { icon: Lock, label: 'Flattened PDF', desc: 'Merges all layers' },
                                                    png: { icon: ImageIcon, label: 'PNG Graphics', desc: 'Per-page snapshots' },
                                                    print: { icon: Printer, label: 'System Print', desc: 'Native browser dialog' }
                                                }[id];

                                                return (
                                                    <button
                                                        key={id}
                                                        onClick={() => setExportFormat(id)}
                                                        className={clsx(
                                                            "w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 text-left group/item",
                                                            exportFormat === id
                                                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20 border-blue-500"
                                                                : "bg-zinc-50/50 dark:bg-white/[0.03] border-transparent hover:bg-zinc-100 dark:hover:bg-white/[0.08] hover:border-zinc-200 dark:hover:border-white/10 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                                                        )}
                                                    >
                                                        <div className={clsx(
                                                            "p-2 rounded-lg border transition-all duration-300",
                                                            exportFormat === id 
                                                                ? "bg-white/20 border-white/20 text-white" 
                                                                : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-white/5 text-zinc-400 dark:text-zinc-500 group-hover/item:scale-110 shadow-sm"
                                                        )}>
                                                            <f.icon size={14} strokeWidth={2.5} />
                                                        </div>
                                                        <div>
                                                            <div className="text-[11px] font-black uppercase tracking-wider leading-none mb-1">{f.label}</div>
                                                            <div className={clsx("text-[9px] font-bold uppercase tracking-widest", exportFormat === id ? "text-white/70" : "text-zinc-500 dark:text-zinc-500")}>{f.desc}</div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {exportFormat !== 'standard' && (
                                            <div className="space-y-3 p-4 bg-zinc-50 dark:bg-black/30 rounded-2xl border border-zinc-100 dark:border-white/5 shadow-inner">
                                                <div className="flex justify-between items-center text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                                                    <span>Output Quality</span>
                                                    <span className="text-blue-600 dark:text-blue-400 tabular-nums">{Math.round(exportQuality * 100)}%</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0.1" max="1" step="0.05"
                                                    value={exportQuality}
                                                    onChange={(e) => setExportQuality(parseFloat(e.target.value))}
                                                    className="w-full accent-blue-600 h-1.5 rounded-full cursor-pointer"
                                                />
                                            </div>
                                        )}

                                        <button
                                            onClick={() => {
                                                setCompressionPageIndices(getTargetPageIndices());
                                                setIsCompressionOpen(true);
                                                setIsExportOpen(false);
                                            }}
                                            className="w-full rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-4 text-left transition-all duration-300 hover:border-blue-400/40 hover:bg-blue-500/15"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-xl bg-blue-500/15 p-2 text-blue-300">
                                                    <SlidersHorizontal size={16} strokeWidth={2.5} />
                                                </div>
                                                <div>
                                                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white">Compress PDF</div>
                                                    <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-100/70">
                                                        PDF.co presets and direct download
                                                    </div>
                                                </div>
                                            </div>
                                        </button>

                                        <button
                                            onClick={handleExport}
                                            disabled={isExporting}
                                            className="w-full py-4 bg-zinc-900 dark:bg-blue-600 hover:bg-black dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl shadow-black/10 dark:shadow-blue-900/20 active:scale-[0.98]"
                                        >
                                            {isExporting ? (
                                                <><RotateCw className="animate-spin" size={16} strokeWidth={3} /> Processing</>
                                            ) : (
                                                <><Download size={16} strokeWidth={3} /> Export Document</>
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
            <CompressionOverlay
                isOpen={isCompressionOpen}
                onClose={() => setIsCompressionOpen(false)}
                selectedPageIndices={compressionPageIndices}
            />

        </div>
    );
};
