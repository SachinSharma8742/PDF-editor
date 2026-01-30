import React, { useState } from 'react';
import { usePDFStore } from '../../store/pdfStore';
import { FileText, Plus } from 'lucide-react';
import { AddPageModal } from '../../components/features/page-operations/AddPageModal';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortablePageItem } from './SortablePageItem';

export const Sidebar: React.FC = () => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const {
        pages,
        currentPage,
        selectedPages,
        isSelectionMode,
        setCurrentPage,
        togglePageSelection,
        reorderPages
    } = usePDFStore();

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handlePageClick = (pageNumber: number) => {
        if (isSelectionMode) {
            togglePageSelection(pageNumber);
        } else {
            setCurrentPage(pageNumber);
            document.getElementById(`page-${pageNumber}`)?.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = pages.findIndex(p => `page-${p.pageNumber}` === active.id);
            const newIndex = pages.findIndex(p => `page-${p.pageNumber}` === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                reorderPages(oldIndex, newIndex);
            }
        }
    };

    const renderHeader = () => (
        <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center">
            <h2 className="font-semibold text-gray-700">Pages ({pages.length})</h2>
            <button
                onClick={() => setIsAddModalOpen(true)}
                className="p-1 hover:bg-gray-100 rounded text-blue-600 transition-colors"
                title="Add Page"
            >
                <Plus size={20} />
            </button>
        </div>
    );

    return (
        <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
            {renderHeader()}

            <AddPageModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />

            {pages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-4 text-gray-400">
                    <FileText size={48} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm text-center">No pages.</p>
                    <p className="text-xs text-center mt-1">Open a PDF or add a page.</p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={pages.map(p => `page-${p.pageNumber}`)}
                            strategy={verticalListSortingStrategy}
                        >
                            {pages.map((page) => (
                                <SortablePageItem
                                    key={`page-${page.pageNumber}`}
                                    id={`page-${page.pageNumber}`}
                                    pageNumber={page.pageNumber}
                                    isSelected={selectedPages.has(page.pageNumber)}
                                    isCurrent={currentPage === page.pageNumber}
                                    isSelectionMode={isSelectionMode}
                                    onClick={() => handlePageClick(page.pageNumber)}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                </div>
            )}
        </div>
    );
};
