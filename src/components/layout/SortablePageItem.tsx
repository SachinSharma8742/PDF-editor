import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, CheckCircle2, Circle } from 'lucide-react';
import clsx from 'clsx';
import { PDFThumbnail } from "../features/pdf-viewer/PDFThumbnail";

interface SortablePageItemProps {
    id: string; // page-{n}
    pageNumber: number;
    isSelected: boolean;
    isCurrent: boolean;
    isSelectionMode: boolean;
    onClick: () => void;
}

export const SortablePageItem: React.FC<SortablePageItemProps> = ({
    id,
    pageNumber,
    isSelected,
    isCurrent,
    isSelectionMode,
    onClick
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id, disabled: isSelectionMode });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={clsx(
                "relative group cursor-pointer transition-colors duration-200 rounded-lg border-2 p-2 bg-white shadow-sm hover:shadow-md mb-2",
                isSelectionMode && isSelected ? "border-blue-500 ring-1 ring-blue-500" : "border-transparent hover:border-gray-300",
                !isSelectionMode && isCurrent ? "border-blue-500" : ""
            )}
            onClick={onClick}
        >
            <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-gray-500 flex items-center">
                    {!isSelectionMode && (
                        <div {...attributes} {...listeners} className="mr-2 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing outline-none">
                            <GripVertical size={14} />
                        </div>
                    )}
                    Page {pageNumber}
                </span>
                {isSelectionMode && (
                    <div className={clsx("text-blue-500 transition-opacity", isSelected ? "opacity-100" : "opacity-30 group-hover:opacity-100")}>
                        {isSelected ? <CheckCircle2 size={16} fill="currentColor" className="text-white" /> : <Circle size={16} />}
                    </div>
                )}
            </div>

            <div className="aspect-[1/1.414] bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-gray-300 overflow-hidden relative">
                <PDFThumbnail pageNumber={pageNumber} />
            </div>
        </div>
    );
};
