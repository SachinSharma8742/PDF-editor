import React from 'react';
import { usePDFStore } from '../../../store/pdfStore';
import { Check, Circle } from 'lucide-react';
import clsx from 'clsx';

interface PageSelectionOverlayProps {
    pageNumber: number;
}

export const PageSelectionOverlay: React.FC<PageSelectionOverlayProps> = ({ pageNumber }) => {
    const { isSelectionMode, selectedPages, togglePageSelection } = usePDFStore();

    if (!isSelectionMode) return null;

    const isSelected = selectedPages.has(pageNumber);

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                togglePageSelection(pageNumber);
            }}
            className={clsx(
                "absolute inset-0 z-20 cursor-pointer transition-all duration-200",
                isSelected ? "bg-blue-500/20 ring-4 ring-inset ring-blue-500" : "hover:bg-black/5"
            )}
        >
            <div className="absolute top-4 right-4">
                <div className={clsx(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-sm",
                    isSelected ? "bg-blue-500 text-white" : "bg-white text-gray-300 hover:text-gray-400"
                )}>
                    {isSelected ? <Check size={20} /> : <Circle size={24} />}
                </div>
            </div>
        </div>
    );
};
