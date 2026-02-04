import React, { useState } from 'react';
import { usePDFStore } from '../../store/pdfStore';
import {
    FileText, Plus, Upload, CheckSquare, Trash2,
    Layers, RotateCw, Download, Settings,
    ChevronRight, X, Lock, Image as ImageIcon
} from 'lucide-react';
import { AddPageModal } from '../../components/features/page-operations/AddPageModal';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortablePageItem } from './SortablePageItem';
import { PDFDocument } from 'pdf-lib';
import { extractPagesAsPDF, loadPDF } from '../../utils/pdfOps';
import clsx from 'clsx';
import { saveDocument, saveDocumentFlattened, exportPageAsImage } from '../../utils/exportUtils';

type SidebarTab = 'pages' | 'export';

export const Sidebar: React.FC = () => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const {
        pages,
        currentPage,
        selectedPageIds,
        isSelectionMode,
        setIsSelectionMode,
        setCurrentPage,
        togglePageSelection,
        selectAllPages,
        deselectAllPages,
        selectPages,
        deleteSelectedPages,
        reorderPages,
        appendPDF,
        fileName,
        pdfDocument,
        sidebarTab,
        setSidebarTab
    } = usePDFStore();

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handlePageClick = (pageId: string, pageNumber: number) => {
        if (isSelectionMode) {
            togglePageSelection(pageId);
        } else {
            setCurrentPage(pageNumber);
            document.getElementById(`page-${pageNumber}`)?.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = pages.findIndex(p => p.id === active.id);
            const newIndex = pages.findIndex(p => p.id === over.id);
            if (oldIndex !== -1 && newIndex !== -1) {
                reorderPages(oldIndex, newIndex);
            }
        }
    };

    const handleUploadPDF = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const arrayBuffer = ev.target?.result as ArrayBuffer;
                if (!arrayBuffer) return;
                try {
                    usePDFStore.getState().setIsLoading(true);
                    const doc = await loadPDF(arrayBuffer.slice(0));
                    usePDFStore.getState().setPdfDocument(doc, arrayBuffer, file.name);
                } catch (error) {
                    console.error("Failed to load PDF:", error);
                } finally {
                    usePDFStore.getState().setIsLoading(false);
                }
            };
            reader.readAsArrayBuffer(file);
        }
    };

    // Export Logic
    const [exportFormat, setExportFormat] = useState<'standard' | 'flattened' | 'png'>('standard');
    const [exportQuality, setExportQuality] = useState(0.8);
    const [customFileName, setCustomFileName] = useState('');
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        if (!pdfDocument && pages.length === 0) return;
        setIsExporting(true);
        try {
            const name = customFileName || fileName?.replace('.pdf', '') || 'document';
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
        } catch (e) {
            console.error(e);
            alert('Export failed');
        } finally {
            setIsExporting(false);
        }
    };

    const renderPagesContent = () => (
        <>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar pb-24">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={pages.map(p => p.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {pages.map((page) => (
                            <SortablePageItem
                                key={page.id}
                                id={page.id}
                                pageNumber={page.pageNumber}
                                isSelected={selectedPageIds.includes(page.id)}
                                isCurrent={currentPage === page.pageNumber}
                                isSelectionMode={isSelectionMode}
                                onClick={() => handlePageClick(page.id, page.pageNumber)}
                                onToggleSelection={(e: any) => {
                                    e.stopPropagation();
                                    togglePageSelection(page.id);
                                }}
                            />
                        ))}
                    </SortableContext>
                </DndContext>

                {pages.length === 0 && !isSelectionMode && (
                    <label className="w-full py-12 border-2 border-dashed border-zinc-800 bg-zinc-900/50 rounded-2xl flex flex-col items-center justify-center text-zinc-500 hover:border-blue-500/50 hover:bg-blue-500/5 cursor-pointer transition-all group">
                        <Upload size={32} className="mb-3 group-hover:-translate-y-1 transition-transform" />
                        <span className="text-xs font-bold uppercase tracking-widest">Upload PDF</span>
                        <input type="file" accept="application/pdf" className="hidden" onChange={handleUploadPDF} />
                    </label>
                )}
            </div>

            {/* Float Add Button */}
            {!isSelectionMode && pages.length > 0 && (
                <div className="absolute bottom-6 left-4 right-4">
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-xl shadow-blue-900/20 flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px] transition-all active:scale-95"
                    >
                        <Plus size={16} />
                        Add Blank Page
                    </button>
                </div>
            )}
        </>
    );

    const renderExportContent = () => (
        <div className="flex-1 overflow-y-auto p-5 space-y-8 animate-in slide-in-from-right-2 duration-300">
            <div className="space-y-2">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Document Name</label>
                <input
                    type="text"
                    placeholder={fileName || "document"}
                    value={customFileName}
                    onChange={(e) => setCustomFileName(e.target.value)}
                    className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-blue-500/50 transition-all font-mono"
                />
            </div>

            <div className="space-y-4">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Export Engine</label>
                <div className="grid grid-cols-1 gap-2">
                    {[
                        { id: 'standard', icon: Layers, label: 'Standard PDF', desc: 'Vector layers & editable text' },
                        { id: 'flattened', icon: Lock, label: 'Flattened PDF', desc: 'Single image layer, fixed' },
                        { id: 'png', icon: ImageIcon, label: 'Raster Images', desc: 'High-res PNG per page' }
                    ].map(f => (
                        <button
                            key={f.id}
                            onClick={() => setExportFormat(f.id as any)}
                            className={clsx(
                                "flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group",
                                exportFormat === f.id
                                    ? "bg-blue-600/10 border-blue-500/50 text-blue-400"
                                    : "bg-white/[0.02] border-white/5 text-zinc-500 hover:bg-white/[0.05]"
                            )}
                        >
                            <div className={clsx(
                                "p-2.5 rounded-xl border transition-colors",
                                exportFormat === f.id ? "bg-blue-600 border-blue-400 text-white" : "bg-black/20 border-white/5 text-zinc-600 group-hover:text-zinc-400"
                            )}>
                                <f.icon size={18} />
                            </div>
                            <div>
                                <div className="text-[11px] font-black uppercase tracking-wide leading-none mb-1">{f.label}</div>
                                <div className="text-[9px] opacity-60 font-medium">{f.desc}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {exportFormat !== 'standard' && (
                <div className="space-y-4 p-4 bg-black/20 rounded-2xl border border-white/5">
                    <div className="flex justify-between items-center text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                        <span>Quality / DPI</span>
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

            <div className="pt-4">
                <button
                    onClick={handleExport}
                    disabled={isExporting || (pages.length === 0)}
                    className="w-full py-5 bg-white text-black hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl"
                >
                    {isExporting ? <RotateCw className="animate-spin" size={16} /> : <Download size={16} />}
                    {isExporting ? "Processing..." : isSelectionMode ? `Download ${selectedPageIds.length} Selection` : "Download Final PDF"}
                </button>
                <p className="text-[8px] text-zinc-600 text-center mt-4 uppercase tracking-tighter leading-relaxed">
                    Powered by high-performance edge rendering engine v4
                </p>
            </div>
        </div>
    );

    return (
        <div className="w-72 bg-[#18181b] border-r border-white/5 flex flex-col h-full z-30 relative select-none transition-all duration-500 font-sans shadow-2xl">
            {/* Header / Tabs */}
            <div className="pt-6 px-4 space-y-6">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.25em]">Workflow</span>
                    </div>
                    <button className="text-zinc-600 hover:text-white transition-colors">
                        <Settings size={14} />
                    </button>
                </div>

                <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5">
                    <button
                        onClick={() => setSidebarTab('pages')}
                        className={clsx(
                            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            sidebarTab === 'pages' ? "bg-zinc-800 text-white shadow-lg border border-white/10" : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        <FileText size={14} />
                        Pages
                    </button>
                    <button
                        onClick={() => setSidebarTab('export')}
                        className={clsx(
                            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            sidebarTab === 'export' ? "bg-zinc-800 text-white shadow-lg border border-white/10" : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        <Download size={14} />
                        Export
                    </button>
                </div>
            </div>

            {/* Selection Mode Indicator */}
            {sidebarTab === 'pages' && isSelectionMode && (
                <div className="mx-4 mt-6 p-4 bg-blue-600/10 border border-blue-500/30 rounded-2xl animate-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest tabular-nums">
                            {selectedPageIds.length} Selected
                        </span>
                        <button onClick={() => { setIsSelectionMode(false); deselectAllPages(); }} className="text-zinc-400 hover:text-white"><X size={14} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={selectAllPages} className="py-2 bg-white/5 hover:bg-white/10 text-white text-[9px] font-bold uppercase rounded-lg border border-white/5">Select All</button>
                        <button onClick={deleteSelectedPages} className="py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[9px] font-bold uppercase rounded-lg border border-red-500/20">Delete</button>
                    </div>
                </div>
            )}

            <div className="flex-1 flex flex-col overflow-hidden">
                {sidebarTab === 'pages' ? renderPagesContent() : renderExportContent()}
            </div>

            <AddPageModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
        </div>
    );
};
