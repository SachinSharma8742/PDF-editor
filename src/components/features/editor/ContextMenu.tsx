import React, { useEffect, useState, useRef } from 'react';
import { usePDFStore } from '../../../store/pdfStore';
import { useEditorStore } from '../../../store/editorStore';
import { Copy, Trash2, ArrowUp, ArrowDown, Edit3 } from 'lucide-react';
import { createPortal } from 'react-dom';

export const ContextMenu: React.FC = () => {
    const {
        selectedObjectIds,
        deleteObjects,
        duplicateObject,
        reorderObject,
        pages,
    } = usePDFStore();

    const { initEditor } = useEditorStore();

    // Simple state for menu position and visibility
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [targetPageId, setTargetPageId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Global right click listener
    useEffect(() => {
        const handleContextMenu = (e: MouseEvent) => {
            // Check if we are right-clicking on a canvas or object

            // 1. If Object Selected -> Show Object Menu
            if (selectedObjectIds.length > 0) {
                e.preventDefault();
                setPosition({ x: e.pageX, y: e.pageY });
                setTargetPageId(null);
                setVisible(true);
                return;
            }

            // 2. If Clicked on a Page -> Show Page Menu (Edit Page)
            const target = e.target as HTMLElement;
            const pageElement = target.closest('[id^="page-"]');
            if (pageElement) {
                const pageNumber = parseInt(pageElement.id.replace('page-', ''));
                const page = usePDFStore.getState().pages.find(p => p.pageNumber === pageNumber);
                if (page) {
                    e.preventDefault();
                    setPosition({ x: e.pageX, y: e.pageY });
                    setTargetPageId(page.id);
                    setVisible(true);
                }
            }
        };

        const handleClick = () => setVisible(false);

        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('click', handleClick);

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('click', handleClick);
        };
    }, [selectedObjectIds]);

    if (!visible) return null;

    const getObjectContext = () => {
        if (selectedObjectIds.length === 0) return null;
        const objId = selectedObjectIds[0];
        // Find page containing this object
        const page = pages.find(p => p.objects.some(o => o.id === objId));
        return page ? { pageId: page.id, objectId: objId } : null;
    };

    const handleDelete = () => {
        if (selectedObjectIds.length > 0) {
            deleteObjects(selectedObjectIds);
        }
        setVisible(false);
    }

    const handleDuplicate = () => {
        const ctx = getObjectContext();
        if (ctx) {
            duplicateObject(ctx.pageId, ctx.objectId);
        }
        setVisible(false);
    };

    const handleLayering = (direction: 'front' | 'back') => {
        const ctx = getObjectContext();
        if (ctx) {
            reorderObject(ctx.pageId, ctx.objectId, direction);
        }
        setVisible(false);
    };

    const handleEditPage = () => {
        if (targetPageId) {
            const page = pages.find(p => p.id === targetPageId);
            if (page) {
                initEditor(page);
            }
        }
        setVisible(false);
    };

    return createPortal(
        <div
            ref={menuRef}
            style={{ top: position.y, left: position.x }}
            className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-100 min-w-[200px] py-2 animate-in fade-in zoom-in-95 duration-100"
        >
            {/* Object Actions */}
            {selectedObjectIds.length > 0 && (
                <>
                    <button onClick={handleDelete} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 text-sm transition-colors">
                        <Trash2 size={16} /> Delete
                    </button>
                    <div className="h-px bg-gray-100 my-1 confirm-delete" />

                    <button
                        onClick={handleDuplicate}
                        disabled={selectedObjectIds.length !== 1}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 disabled:text-gray-400 flex items-center gap-2 text-sm transition-colors"
                    >
                        <div className="flex-1 flex gap-2 items-center">
                            <Copy size={16} /> Duplicate
                        </div>
                        <span className="text-xs text-gray-400">Ctrl+D</span>
                    </button>

                    <div className="h-px bg-gray-100 my-1" />
                    <div className="px-4 py-1 text-xs text-gray-400 font-medium uppercase tracking-wider">Layering</div>

                    <button
                        onClick={() => handleLayering('front')}
                        disabled={selectedObjectIds.length !== 1}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 disabled:text-gray-400 flex items-center gap-2 text-sm transition-colors"
                    >
                        <ArrowUp size={16} /> Bring to Front
                    </button>
                    <button
                        onClick={() => handleLayering('back')}
                        disabled={selectedObjectIds.length !== 1}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 disabled:text-gray-400 flex items-center gap-2 text-sm transition-colors"
                    >
                        <ArrowDown size={16} /> Send to Back
                    </button>
                </>
            )}

            {/* Page Actions */}
            {selectedObjectIds.length === 0 && targetPageId && (
                <button
                    onClick={handleEditPage}
                    className="w-full text-left px-4 py-2 hover:bg-blue-50 text-blue-600 flex items-center gap-2 text-sm transition-colors"
                >
                    <Edit3 size={16} /> Edit Page
                </button>
            )}
        </div>,
        document.body
    );
};
