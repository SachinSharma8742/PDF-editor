import React, { useEffect, useRef } from 'react';
import {
    Copy, Trash2, RotateCw, RotateCcw,
    ArrowUpToLine, ArrowDownToLine, MoreVertical
} from 'lucide-react';
import { usePDFStore } from '../../../store/pdfStore';

interface PageContextMenuProps {
    x: number;
    y: number;
    pageId: string;
    onClose: () => void;
}

export const PageContextMenu: React.FC<PageContextMenuProps> = ({ x, y, pageId, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const {
        duplicatePage,
        deletePage,
        rotatePage,
        pages,
        reorderPages
    } = usePDFStore();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleScroll = () => onClose();

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('scroll', handleScroll, true);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('scroll', handleScroll, true);
        };
    }, [onClose]);

    // Ensure menu stays within viewport
    const style: React.CSSProperties = {
        top: Math.min(y, window.innerHeight - 300),
        left: Math.min(x, window.innerWidth - 200),
    };

    const handleAction = (action: () => void) => {
        action();
        onClose();
    };

    const pageIndex = pages.findIndex(p => p.id === pageId);

    return (
        <div
            ref={menuRef}
            className="fixed z-50 w-48 bg-[#1e1e20] border border-white/10 rounded-lg shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-100"
            style={style}
        >
            <div className="px-3 py-2 border-b border-white/5 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                Page Actions
            </div>

            <button
                onClick={() => handleAction(() => duplicatePage(pageId))}
                className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition-colors"
            >
                <Copy size={13} /> Duplicate
            </button>

            <button
                onClick={() => handleAction(() => rotatePage(pageId, 'cw'))}
                className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition-colors"
            >
                <RotateCw size={13} /> Rotate CW
            </button>

            <button
                onClick={() => handleAction(() => rotatePage(pageId, 'ccw'))}
                className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition-colors"
            >
                <RotateCcw size={13} /> Rotate CCW
            </button>

            <div className="h-px bg-white/5 my-1" />

            <button
                onClick={() => handleAction(() => deletePage(pageId))}
                className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500 hover:text-white flex items-center gap-2 transition-colors"
            >
                <Trash2 size={13} /> Delete
            </button>
        </div>
    );
};
