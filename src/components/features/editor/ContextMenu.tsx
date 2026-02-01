import React, { useEffect, useState, useRef } from 'react';
import { usePDFStore } from '../../../store/pdfStore';
import { useEditorStore } from '../../../store/editorStore';
import { Copy, Trash2, ArrowUp, ArrowDown, Edit3, Upload, ClipboardPaste, Sun, Moon, RotateCcw } from 'lucide-react'; // Added Icons
import { createPortal } from 'react-dom';
import { loadPDF } from '../../../utils/pdfOps'; // Import loadPDF

export const ContextMenu: React.FC = () => {
    const {
        selectedObjectIds,
        deleteObjects,
        duplicateObject,
        reorderObject,
        pages,
        toggleTheme,
        theme,
        setPdfDocument,
        setIsLoading,
        undo,
        redo
    } = usePDFStore();

    const { initEditor } = useEditorStore();

    // Simple state for menu position and visibility
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [targetPageId, setTargetPageId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null); // Ref for hidden input

    // Global right click listener
    useEffect(() => {
        const handleContextMenu = (e: MouseEvent) => {
            // Check if we are right-clicking on a canvas or object

            // NOTE: We allow the menu even if editor is not "active" in the strict sense, 
            // as we want to support Home Page actions (Upload etc)

            // 1. If Object Selected -> Show Object Menu
            if (selectedObjectIds.length > 0) {
                e.preventDefault();
                setPosition({ x: e.pageX, y: e.pageY });
                setTargetPageId(null);
                setVisible(true);
                return;
            }

            // 2. If Clicked on a Page -> Show Page Menu (Edit Page, Delete, Duplicate)
            const target = e.target as HTMLElement;
            const pageIdElement = target.closest('[data-page-id]');

            let foundPageId: string | null = null;

            if (pageIdElement) {
                foundPageId = pageIdElement.getAttribute('data-page-id');
            } else {
                // Fallback to legacy ID check just in case, or for validation
                const pageElement = target.closest('[id^="page-"]');
                if (pageElement) {
                    const pageNumber = parseInt(pageElement.id.replace('page-', ''));
                    const page = usePDFStore.getState().pages.find(p => p.pageNumber === pageNumber);
                    if (page) foundPageId = page.id;
                }
            }

            if (foundPageId) {
                e.preventDefault();
                e.stopPropagation(); // Stop bubbling to prevent double-handling if any
                setPosition({ x: e.pageX, y: e.pageY });
                setTargetPageId(foundPageId);
                setVisible(true);
                return;
            }

            // 3. If Clicked on Background (Home Page) -> Show Global Menu
            // We assume if it wasn't an object or a page, it's the background.
            // But we should verify it's not some other UI element like the sidebar or toolbar.
            // A simple check is if it's within the main scroll container or body, but not inside sidebar/toolbar.
            const isInsideToolbar = target.closest('.toolbar-container') || target.closest('nav') || target.closest('[role="toolbar"]');
            const isInsideSidebar = target.closest('.sidebar-container') || target.closest('aside');

            if (!isInsideToolbar && !isInsideSidebar) {
                e.preventDefault();
                setPosition({ x: e.pageX, y: e.pageY });
                setTargetPageId(null);
                setVisible(true);
            }
        };

        const handleClick = () => setVisible(false);

        // Use capture phase to ensure we catch the event before any child stops it
        document.addEventListener('contextmenu', handleContextMenu, true);
        document.addEventListener('click', handleClick);

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu, true);
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

    const handleDeletePage = () => {
        if (targetPageId) {
            if (confirm('Delete this page?')) {
                usePDFStore.getState().deletePage(targetPageId);
            }
        }
        setVisible(false);
    };

    const handleDuplicatePage = () => {
        if (targetPageId) {
            usePDFStore.getState().duplicatePage(targetPageId);
        }
        setVisible(false);
    };

    // --- Global / Home Actions ---

    const handleUploadClick = () => {
        fileInputRef.current?.click();
        setVisible(false);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const handlePaste = async () => {
        try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                if (item.types.includes('image/png') || item.types.includes('image/jpeg')) {
                    const blob = await item.getType(item.types.includes('image/png') ? 'image/png' : 'image/jpeg');
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        // Insert image logic (Requires active page usually, but for Home we might not have one)
                        // If we have pages, add to current page.
                        const { currentPage, pages, addObject } = usePDFStore.getState();
                        const page = pages.find(p => p.pageNumber === currentPage);
                        if (page) {
                            const img = new Image();
                            img.onload = () => {
                                addObject(page.id, {
                                    id: crypto.randomUUID(),
                                    type: 'image',
                                    x: 100, y: 100,
                                    width: 200, height: (img.height / img.width) * 200,
                                    src: e.target?.result as string
                                });
                            };
                            img.src = e.target?.result as string;
                        } else {
                            alert("Load a PDF first to paste images.");
                        }
                    };
                    reader.readAsDataURL(blob);
                }
            }
        } catch (err) {
            console.error('Failed to read clipboard contents: ', err);
            // Fallback for simple text paste potentially, or just alert
        }
        setVisible(false);
    };


    return createPortal(
        <>
            <div
                ref={menuRef}
                style={{ top: position.y, left: position.x }}
                className="fixed z-[100] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl shadow-black/20 dark:shadow-black/50 border border-gray-100 dark:border-white/10 min-w-[220px] py-1.5 animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
            >
                {/* 1. OBJECT ACTIONS */}
                {selectedObjectIds.length > 0 && (
                    <>
                        <div className="px-3 py-1.5 text-[10px] font-black text-gray-400 dark:text-zinc-600 uppercase tracking-widest">
                            Object Actions
                        </div>
                        <button onClick={handleDelete} className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 dark:text-red-400 flex items-center gap-3 text-sm transition-colors">
                            <Trash2 size={15} /> Delete
                        </button>

                        <button
                            onClick={handleDuplicate}
                            disabled={selectedObjectIds.length !== 1}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200 disabled:text-gray-400 dark:disabled:text-zinc-600 flex items-center gap-3 text-sm transition-colors"
                        >
                            <Copy size={15} /> Duplicate
                        </button>

                        <div className="h-px bg-gray-100 dark:bg-white/5 my-1" />

                        <button
                            onClick={() => handleLayering('front')}
                            disabled={selectedObjectIds.length !== 1}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200 disabled:text-gray-400 dark:disabled:text-zinc-600 flex items-center gap-3 text-sm transition-colors"
                        >
                            <ArrowUp size={15} /> Bring to Front
                        </button>
                        <button
                            onClick={() => handleLayering('back')}
                            disabled={selectedObjectIds.length !== 1}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200 disabled:text-gray-400 dark:disabled:text-zinc-600 flex items-center gap-3 text-sm transition-colors"
                        >
                            <ArrowDown size={15} /> Send to Back
                        </button>
                    </>
                )}

                {/* 2. PAGE ACTIONS */}
                {selectedObjectIds.length === 0 && targetPageId && (
                    <>
                        <div className="px-3 py-1.5 text-[10px] font-black text-gray-400 dark:text-zinc-600 uppercase tracking-widest">
                            Page Actions
                        </div>

                        <button
                            onClick={handleEditPage}
                            className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center gap-3 text-sm font-medium transition-colors"
                        >
                            <Edit3 size={15} /> Edit Page
                        </button>

                        <button
                            onClick={handleDuplicatePage}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-zinc-200 flex items-center gap-3 text-sm font-medium transition-colors"
                        >
                            <Copy size={15} /> Duplicate Page
                        </button>

                        <div className="h-px bg-gray-100 dark:bg-white/5 my-1" />

                        <button
                            onClick={handleDeletePage}
                            className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 dark:text-red-400 flex items-center gap-3 text-sm font-medium transition-colors"
                        >
                            <Trash2 size={15} /> Delete Page
                        </button>
                    </>
                )}

                {/* 3. GLOBAL / HOME ACTIONS (Default if nothing else matches) */}
                {selectedObjectIds.length === 0 && !targetPageId && (
                    <>
                        <div className="px-3 py-1.5 text-[10px] font-black text-gray-400 dark:text-zinc-600 uppercase tracking-widest">
                            Editor Actions
                        </div>

                        <button
                            onClick={handleUploadClick}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-zinc-200 flex items-center gap-3 text-sm font-medium transition-colors"
                        >
                            <Upload size={15} className="text-blue-500" /> Upload PDF
                        </button>

                        <button
                            onClick={handlePaste}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-zinc-200 flex items-center gap-3 text-sm font-medium transition-colors"
                        >
                            <ClipboardPaste size={15} className="text-orange-500" /> Paste
                        </button>

                        <div className="h-px bg-gray-100 dark:bg-white/5 my-1" />

                        <button
                            onClick={() => { toggleTheme(); setVisible(false); }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-zinc-200 flex items-center gap-3 text-sm font-medium transition-colors"
                        >
                            {theme === 'dark' ? <Sun size={15} className="text-yellow-400" /> : <Moon size={15} className="text-indigo-400" />}
                            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                        </button>
                    </>
                )}
            </div>
            {/* Hidden Input for Upload */}
            <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
            />
        </>,
        document.body
    );
};
