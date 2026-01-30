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
    onToggleSelection: (e: React.MouseEvent) => void;
}

export const SortablePageItem: React.FC<SortablePageItemProps> = ({
    id,
    pageNumber,
    isSelected,
    isCurrent,
    isSelectionMode,
    onClick,
    onToggleSelection
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
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={clsx(
                "relative group cursor-pointer transition-all duration-300 rounded-[22px] p-3 mb-4",
                isSelected
                    ? "bg-blue-50/60 ring-2 ring-blue-500 shadow-xl shadow-blue-500/10"
                    : "bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200",
                isCurrent && !isSelectionMode && !isSelected ? "ring-2 ring-blue-500/30 ring-offset-2" : ""
            )}
            onClick={onClick}
        >
            {/* Selection Checkbox - Smarter Overlay */}
            {(isSelectionMode || isSelected) && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelection(e);
                    }}
                    className={clsx(
                        "absolute top-4 right-4 z-20 w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-300 shadow-sm overflow-hidden",
                        isSelected
                            ? "bg-blue-600 text-white shadow-blue-500/30 scale-110"
                            : "bg-white/90 backdrop-blur-md border border-gray-200 text-gray-400 opacity-0 group-hover:opacity-100 hover:border-blue-400 hover:scale-105 active:scale-90"
                    )}
                >
                    <div className="relative">
                        {isSelected ? (
                            <CheckCircle2 size={14} className="animate-in zoom-in-50 duration-300" />
                        ) : (
                            <Circle size={14} className="group-hover/checkbox:text-blue-500 transition-colors" />
                        )}
                    </div>
                </button>
            )}

            <div className="flex justify-between items-center mb-3 px-1">
                <div className="flex items-center gap-2">
                    {!isSelectionMode && (
                        <div {...attributes} {...listeners} className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing transition-colors">
                            <GripVertical size={16} />
                        </div>
                    )}
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] leading-none">
                        Page {pageNumber}
                    </span>
                </div>
                {isCurrent && !isSelectionMode && !isSelected && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">
                        <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-[8px] font-bold text-blue-600 uppercase tracking-tighter">Viewing</span>
                    </div>
                )}
            </div>

            <div className={clsx(
                "aspect-[1/1.414] bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center overflow-hidden relative transition-all duration-500",
                isSelected ? "scale-[0.96] rounded-lg shadow-inner" : "group-hover:scale-[1.02]"
            )}>
                <PDFThumbnail pageNumber={pageNumber} />

                {/* Visual state overlays */}
                <div className={clsx(
                    "absolute inset-0 transition-opacity duration-300 pointer-events-none",
                    isSelected ? "bg-blue-600/5 opacity-100" : "opacity-0"
                )} />
            </div>
        </div>
    );
};
