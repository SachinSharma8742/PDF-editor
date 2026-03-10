
import React, { useState } from 'react';
import { usePDFStore } from '../../store/pdfStore';
import {
    Plus, Upload, Trash2,
    Settings, BoxSelect, Download, Copy,
    RefreshCw, FolderOpen, Info, HelpCircle, Printer, ArrowLeftRight
} from 'lucide-react';
import { AddPageModal } from '../../components/features/page-operations/AddPageModal';
import { useEditorStore } from '../../store/editorStore';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortablePageItem } from './SortablePageItem';
import { loadPDF } from '../../utils/pdfOps';
import { saveDocument } from '../../utils/exportUtils';
import clsx from 'clsx';
import { CompareModal } from '../features/editor/CompareModal';

export const Sidebar: React.FC = () => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isCompareOpen, setIsCompareOpen] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

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
        deleteSelectedPages,
        duplicateSelectedPages,
        reorderPages,
        fileName,
        originalPdfBytes,
        reset
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
        if (e.target) e.target.value = '';
    };

    const handleResetDocument = () => {
        if (pages.length > 0) {
            if (confirm('Are you sure you want to close this document? All unsaved changes will be lost.')) {
                reset();
                setIsSettingsOpen(false);
            }
        }
    };

    return (
        <div className="w-[85vw] max-w-[288px] md:w-72 bg-[#18181b] border-r border-white/5 flex flex-col h-full z-30 relative select-none transition-all duration-500 font-sans shadow-2xl">
            {/* Hidden file input for Open PDF */}
            <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleUploadPDF}
            />

            {/* Header - Sticky with Blur */}
            <div className="sticky top-0 z-20 pt-6 px-4 pb-4 bg-[#18181b]/95 backdrop-blur-xl">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] flex-shrink-0" />
                        <span
                            className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] truncate"
                            title={fileName || undefined}
                        >
                            {fileName ? fileName.replace('.pdf', '') : 'No Document'}
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        {/* Select Mode Toggle Button */}
                        {pages.length > 0 && (
                            <button
                                onClick={() => {
                                    if (isSelectionMode) {
                                        setIsSelectionMode(false);
                                        deselectAllPages();
                                    } else {
                                        setIsSelectionMode(true);
                                    }
                                }}
                                className={clsx(
                                    "p-2 rounded-xl transition-all relative border",
                                    isSelectionMode
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/40 border-blue-400/50"
                                        : "bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 border-white/10"
                                )}
                                title={isSelectionMode ? "Exit Selection Mode" : "Select Pages"}
                            >
                                <BoxSelect size={16} strokeWidth={2.5} />
                                {isSelectionMode && selectedPageIds.length > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-md">
                                        {selectedPageIds.length}
                                    </span>
                                )}
                            </button>
                        )}

                        {/* Settings Button with Toggle Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                className={clsx(
                                    "p-2 rounded-xl transition-all border",
                                    isSettingsOpen
                                        ? "bg-zinc-700 text-white border-white/20"
                                        : "bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 border-white/10"
                                )}
                            >
                                <Settings size={16} strokeWidth={2.5} />
                            </button>

                            {/* Backdrop to close on click outside */}
                            {isSettingsOpen && (
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setIsSettingsOpen(false)}
                                />
                            )}

                            {/* Settings Dropdown */}
                            {isSettingsOpen && (
                                <div className="absolute top-full right-0 mt-2 w-56 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                                    <div className="p-2 space-y-1">
                                        {/* Open New PDF */}
                                        <button
                                            onClick={() => {
                                                fileInputRef.current?.click();
                                                setIsSettingsOpen(false);
                                            }}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-all text-left group"
                                        >
                                            <FolderOpen size={14} className="text-blue-400" />
                                            <span className="text-[11px] font-semibold">Open New PDF</span>
                                        </button>

                                        {/* Compare Documents */}
                                        <button
                                            onClick={() => {
                                                setIsCompareOpen(true);
                                                setIsSettingsOpen(false);
                                            }}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-all text-left group"
                                        >
                                            <ArrowLeftRight size={14} className="text-purple-400" />
                                            <span className="text-[11px] font-semibold">Compare Documents</span>
                                        </button>

                                        {/* Reset/Close Document */}
                                        {pages.length > 0 && (
                                            <button
                                                onClick={handleResetDocument}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all text-left group"
                                            >
                                                <RefreshCw size={14} className="text-red-400" />
                                                <span className="text-[11px] font-semibold">Close Document</span>
                                            </button>
                                        )}

                                        <div className="border-t border-white/5 my-2" />

                                        {/* About */}
                                        <button
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-all text-left group"
                                        >
                                            <Info size={14} className="text-zinc-500" />
                                            <span className="text-[11px] font-semibold">About</span>
                                        </button>

                                        {/* Help */}
                                        <button
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-all text-left group"
                                        >
                                            <HelpCircle size={14} className="text-zinc-500" />
                                            <span className="text-[11px] font-semibold">Help & Shortcuts</span>
                                        </button>

                                        <div className="border-t border-white/5 my-2" />


                                        {/* Clear Data */}
                                        <button
                                            onClick={async () => {
                                                if (confirm('Are you sure you want to clear all app data? This will reset the application to its initial state.')) {
                                                    try {
                                                        const { clear } = await import('idb-keyval');
                                                        await clear();
                                                        localStorage.clear();
                                                        sessionStorage.clear();
                                                        window.location.reload();
                                                    } catch (e) {
                                                        console.error('Failed to clear data:', e);
                                                        // Fallback
                                                        localStorage.clear();
                                                        sessionStorage.clear();
                                                        window.location.reload();
                                                    }
                                                }
                                            }}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all text-left group"
                                        >
                                            <Trash2 size={14} className="text-zinc-500 group-hover:text-red-400 decoration-red-900" />
                                            <span className="text-[11px] font-semibold">Reset App Data</span>
                                        </button>
                                    </div>

                                    {/* Footer */}
                                    <div className="px-3 py-2 bg-black/30 border-t border-white/5">
                                        <p className="text-[9px] text-zinc-600 text-center">PDF Editor v1.0</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Selection Mode Panel - compact 2-row */}
            {isSelectionMode && (
                <div className="mx-3 mb-3 bg-[#1a1a1d] rounded-xl border border-white/5 overflow-hidden animate-in slide-in-from-top-2 duration-300">
                    {/* Row 1: status + controls */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.7)] shrink-0" />
                        <span className="text-[11px] font-black text-blue-400 tabular-nums">{selectedPageIds.length}</span>
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">selected</span>
                        <button onClick={selectAllPages} className="ml-auto px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[9px] font-bold uppercase rounded-md border border-white/5 transition-all">All</button>
                        <button onClick={deselectAllPages} className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[9px] font-bold uppercase rounded-md border border-white/5 transition-all">None</button>
                        <button
                            onClick={() => { setIsSelectionMode(false); deselectAllPages(); }}
                            className="px-2.5 py-0.5 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black uppercase tracking-wider rounded-md transition-all active:scale-95"
                        >Done</button>
                    </div>
                    {/* Row 2: action buttons */}
                    <div className="flex items-center justify-around px-2 py-1.5">
                        <button
                            onClick={deleteSelectedPages}
                            disabled={selectedPageIds.length === 0}
                            className="flex flex-col items-center gap-0.5 p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-30"
                            title="Delete"
                        >
                            <Trash2 size={14} />
                            <span className="text-[8px] font-bold uppercase">Delete</span>
                        </button>
                        <button
                            onClick={async () => {
                                if (selectedPageIds.length > 0) {
                                    const selectedPages = pages.filter(p => selectedPageIds.includes(p.id));
                                    await saveDocument(selectedPages, originalPdfBytes);
                                    setIsSelectionMode(false);
                                    deselectAllPages();
                                }
                            }}
                            disabled={selectedPageIds.length === 0}
                            className="flex flex-col items-center gap-0.5 p-2 rounded-lg text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all disabled:opacity-30"
                            title="Export"
                        >
                            <Download size={14} />
                            <span className="text-[8px] font-bold uppercase">Export</span>
                        </button>
                        <button
                            onClick={() => useEditorStore.getState().openPrintModal(selectedPageIds)}
                            disabled={selectedPageIds.length === 0}
                            className="flex flex-col items-center gap-0.5 p-2 rounded-lg text-zinc-500 hover:text-teal-400 hover:bg-teal-500/10 transition-all disabled:opacity-30"
                            title="Print"
                        >
                            <Printer size={14} />
                            <span className="text-[8px] font-bold uppercase">Print</span>
                        </button>
                        <button
                            onClick={duplicateSelectedPages}
                            disabled={selectedPageIds.length === 0}
                            className="flex flex-col items-center gap-0.5 p-2 rounded-lg text-zinc-500 hover:text-purple-400 hover:bg-purple-500/10 transition-all disabled:opacity-30"
                            title="Clone"
                        >
                            <Copy size={14} />
                            <span className="text-[8px] font-bold uppercase">Clone</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Pages Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
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
                                    onToggleSelection={(e: React.MouseEvent) => {
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
                {!isSelectionMode && pages.length >= 0 && (
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
            </div>

            <AddPageModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
            <CompareModal isOpen={isCompareOpen} onClose={() => setIsCompareOpen(false)} />
        </div>
    );
};
