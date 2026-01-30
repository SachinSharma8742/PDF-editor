import React, { useState } from 'react';
import { usePDFStore } from '../../store/pdfStore';
import { FileText, Plus, Upload, CheckSquare, Trash2, Copy, Layers } from 'lucide-react';
import { AddPageModal } from '../../components/features/page-operations/AddPageModal';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortablePageItem } from './SortablePageItem';
import { PDFDocument } from 'pdf-lib';
import { extractPagesAsPDF, loadPDF } from '../../utils/pdfOps';
import clsx from 'clsx';

export const Sidebar: React.FC = () => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    const {
        pages,
        currentPage,
        selectedPageIds,
        setCurrentPage,
        togglePageSelection,
        selectAllPages,
        deselectAllPages,
        deleteSelectedPages,
        duplicateSelectedPages,
        reorderPages,
        appendPDF,
        fileName
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

    const handleSelectionToggle = (e: React.MouseEvent, pageId: string) => {
        e.stopPropagation();
        togglePageSelection(pageId);
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

    const handleMergePDF = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const arrayBuffer = await file.arrayBuffer();
            // Clone for PDF-lib to avoid detachment if it happens (though pdf-lib usually behaves well, pdfjs is the culprit usually)
            // But consistency is key.
            const bufferForDoc = arrayBuffer.slice(0);
            const pdfDoc = await PDFDocument.load(bufferForDoc);

            // Wait! appendPDF replaces originalPdfBytes?
            // If so, it might break previous pages?
            // Let's at least ensure we don't store a detached buffer.
            appendPDF(pdfDoc, arrayBuffer, pdfDoc.getPageCount());
            e.target.value = '';
        } catch (error) {
            console.error('Merge failed', error);
            alert('Failed to merge PDF.');
        }
    };

    const handleExportSelected = () => {
        const { originalPdfBytes } = usePDFStore.getState();
        if (!originalPdfBytes) return;

        extractPagesAsPDF(originalPdfBytes, pages, selectedPageIds);
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
                    // Clone for PDF.js
                    const bufferForPDFjs = arrayBuffer.slice(0);
                    const doc = await loadPDF(bufferForPDFjs);
                    usePDFStore.getState().setPdfDocument(doc, arrayBuffer, file.name);
                } catch (error) {
                    console.error("Failed to load PDF:", error);
                    alert("Error loading PDF");
                } finally {
                    usePDFStore.getState().setIsLoading(false);
                }
            };
            reader.readAsArrayBuffer(file);
        }
    };

    const handleDeleteSelected = () => {
        if (selectedPageIds.length === 0) return;
        if (confirm(`Delete ${selectedPageIds.length} page(s)?`)) {
            deleteSelectedPages();
            if (pages.length === selectedPageIds.length) {
                setIsSelectionMode(false);
            }
        }
    };

    const handleDuplicateSelected = () => {
        duplicateSelectedPages();
    };

    const toggleSelectionMode = () => {
        if (isSelectionMode) {
            deselectAllPages();
        }
        setIsSelectionMode(!isSelectionMode);
    };

    const renderHeader = () => {
        return (
            <div className={clsx(
                "sticky top-0 z-40 transition-all duration-500 border-b border-gray-200/50 dark:border-zinc-800/50",
                isSelectionMode ? "bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl shadow-sm" : "bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl"
            )}>
                <div className="p-4 flex flex-col gap-4">
                    {isSelectionMode ? (
                        /* Smart & Compact Selection Mode - Focus on actions, remove redundant title */
                        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex justify-between items-center px-0.5">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.4)] animate-pulse" />
                                    <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] leading-none">
                                        Selection Mode
                                    </span>
                                </div>

                                <button
                                    onClick={toggleSelectionMode}
                                    className="px-4 py-2 rounded-xl bg-gray-900 dark:bg-blue-600 text-white dark:text-white text-[10px] font-black uppercase tracking-[0.1em] hover:bg-gray-800 dark:hover:bg-blue-700 transition-all active:scale-95 shadow-md shadow-gray-200 dark:shadow-blue-600/30"
                                >
                                    Done
                                </button>
                            </div>

                            {/* Optimized Selection Action Bar */}
                            <div className="relative overflow-hidden rounded-2xl border border-blue-100 dark:border-blue-900/30 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-900/10 dark:to-zinc-900 p-3.5 shadow-sm">
                                <div className="relative z-10 flex flex-col gap-3.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-blue-600/60 dark:text-blue-400/60 uppercase tracking-widest tabular-nums">
                                            {selectedPageIds.length === 0
                                                ? "0 PAGES SELECTED"
                                                : `${selectedPageIds.length} SELECTED`}
                                        </span>
                                        <div className="flex items-center gap-1 bg-white/80 dark:bg-zinc-800/80 p-0.5 rounded-lg border border-blue-100/50 dark:border-blue-900/30 shadow-sm">
                                            <button
                                                onClick={selectAllPages}
                                                className="text-[9px] px-2.5 py-1 rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all font-black uppercase tracking-tight active:scale-95"
                                            >
                                                All
                                            </button>
                                            <div className="w-px h-2.5 bg-blue-100/50 dark:bg-blue-800/30 mx-0.5" />
                                            <button
                                                onClick={deselectAllPages}
                                                className="text-[9px] px-2.5 py-1 rounded-md text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all font-black uppercase tracking-tight active:scale-95"
                                            >
                                                None
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleDeleteSelected}
                                            disabled={selectedPageIds.length === 0}
                                            className={clsx(
                                                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border shadow-sm active:scale-95",
                                                selectedPageIds.length > 0
                                                    ? "bg-white dark:bg-zinc-800 border-red-100 dark:border-red-900/30 text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500"
                                                    : "bg-gray-50 dark:bg-zinc-800/50 border-transparent text-gray-300 dark:text-gray-600 opacity-60 cursor-not-allowed shadow-none"
                                            )}
                                        >
                                            <Trash2 size={13} />
                                            <span>Delete</span>
                                        </button>

                                        <button
                                            onClick={handleExportSelected}
                                            disabled={selectedPageIds.length === 0}
                                            className={clsx(
                                                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border shadow-sm active:scale-95",
                                                selectedPageIds.length > 0
                                                    ? "bg-blue-600 border-blue-600 text-white hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/20"
                                                    : "bg-gray-50 dark:bg-zinc-800/50 border-transparent text-gray-300 dark:text-gray-600 opacity-60 cursor-not-allowed shadow-none"
                                            )}
                                        >
                                            <FileText size={13} />
                                            <span>Export</span>
                                        </button>

                                        <button
                                            onClick={handleDuplicateSelected}
                                            disabled={selectedPageIds.length === 0}
                                            className={clsx(
                                                "p-3 rounded-xl transition-all duration-300 border shadow-sm active:scale-95",
                                                selectedPageIds.length > 0
                                                    ? "bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 hover:bg-gray-900 dark:hover:bg-zinc-700 hover:text-white hover:border-gray-900"
                                                    : "bg-gray-50 dark:bg-zinc-800/50 border-transparent text-gray-300 dark:text-gray-600 opacity-60 cursor-not-allowed shadow-none"
                                            )}
                                            title="Clone Pages"
                                        >
                                            <Copy size={13} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Standard Header */
                        <div className="flex justify-between items-center px-0.5 animate-in fade-in zoom-in-95 duration-300 overflow-hidden">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 p-2 rounded-xl border border-blue-500/10 flex-shrink-0">
                                    <Layers size={18} className="text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <h2
                                        className="font-extrabold text-gray-900 dark:text-gray-100 text-[11px] uppercase tracking-[0.15em] leading-none truncate max-w-[130px]"
                                        title={fileName || "Documents"}
                                    >
                                        {fileName || "Documents"}
                                    </h2>
                                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1.5">
                                        <span className="w-1 h-1 rounded-full bg-blue-400" />
                                        {pages.length} {pages.length === 1 ? 'Page' : 'Pages'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                                {pages.length > 0 && (
                                    <button
                                        onClick={toggleSelectionMode}
                                        className="px-3 py-2.5 rounded-xl transition-all duration-300 flex items-center gap-2 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-500 dark:text-gray-400 hover:border-blue-200 hover:text-blue-600 active:scale-95 shadow-sm active:shadow-none"
                                        title="Enter Selection Mode"
                                    >
                                        <CheckSquare size={16} />
                                    </button>
                                )}

                                {pages.length > 0 && (
                                    <button
                                        onClick={() => setIsAddModalOpen(true)}
                                        className="p-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-gray-400 dark:text-gray-500 hover:border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-all active:scale-95 hover:shadow-sm"
                                        title="Add Blank Page"
                                    >
                                        <Plus size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="w-64 bg-gray-50 dark:bg-zinc-950 border-r border-gray-200 dark:border-zinc-800 flex flex-col h-full z-30 relative select-none transition-colors duration-200">
            {renderHeader()}

            <AddPageModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />

            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin pb-24">
                {/* Page List */}
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
                                onToggleSelection={(e: any) => handleSelectionToggle(e, page.id)}
                            />
                        ))}
                    </SortableContext>
                </DndContext>

                {/* Bottom Add Action Cards - Hidden in Selection Mode */}
                {!isSelectionMode && (
                    <div className="mt-4 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {/* Empty State: Show Upload PDF (Primary) */}
                        {pages.length === 0 && (
                            <label className="w-full py-4 border-2 border-dashed border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl flex flex-col items-center justify-center text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:border-blue-400 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-all group shadow-sm">
                                <Upload size={24} className="mb-2 group-hover:scale-110 transition-transform" />
                                <span className="text-sm font-bold">Upload PDF</span>
                                <span className="text-xs text-blue-400 mt-1">Start a new project</span>
                                <input
                                    type="file"
                                    accept="application/pdf"
                                    className="hidden"
                                    onChange={handleUploadPDF}
                                />
                            </label>
                        )}

                        {/* Non-Empty State: Show Append PDF (Primary) */}
                        {pages.length > 0 && (
                            <label className="w-full py-3 border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-700 hover:shadow-md cursor-pointer transition-all active:scale-[0.98]">
                                <FileText size={16} />
                                <span className="text-xs font-bold uppercase tracking-wider">Append PDF File</span>
                                <input
                                    type="file"
                                    accept=".pdf"
                                    className="hidden"
                                    onChange={handleMergePDF}
                                />
                            </label>
                        )}

                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className={`w-full py-3 border border-gray-200 dark:border-zinc-800 rounded-xl flex items-center justify-center gap-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-700 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-all group ${pages.length === 0 ? 'bg-white dark:bg-zinc-900' : 'border-dashed'}`}
                        >
                            <Plus size={16} className="group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-bold uppercase tracking-wider">Add Blank Page</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
