import React, { useRef, useEffect } from 'react';
import { usePDFStore } from '../../../store/pdfStore';
import { useEditorStore } from '../../../store/editorStore';
import { Copy, Trash2, ArrowUp, ArrowDown, Edit3, ClipboardPaste, Split, StickyNote, RefreshCw, Ruler, Image } from 'lucide-react';
import { createPortal } from 'react-dom';

type ContextMenuPayload = {
    objectIds?: string[];
    pageId?: string;
    x?: number;
    y?: number;
};

export const ContextMenu: React.FC = () => {
    const { pages } = usePDFStore();

    const {
        contextMenu,
        closeContextMenu,
        initEditor,
        currentPage,
        addObject,
        updateObject,
        deleteObjects: editorDeleteObjects,
        duplicateObject: editorDuplicateObject,
        reorderObject: editorReorderObject,
        openShapeEditor
    } = useEditorStore();

    const menuRef = useRef<HTMLDivElement>(null);

    // Close on click outside or escape
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                closeContextMenu();
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeContextMenu();
            }
        };

        if (contextMenu.isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [contextMenu.isOpen, closeContextMenu]);

    if (!contextMenu.isOpen) return null;

    const { x, y, type } = contextMenu;
    const data = (contextMenu.data ?? {}) as ContextMenuPayload;
    const objectIds = data.objectIds ?? [];
    const pageId = data.pageId;

    // --- Actions ---

    const handleObjectAction = (action: () => void) => {
        action();
        closeContextMenu();
    };

    const handlePageAction = (action: () => void) => {
        action();
        closeContextMenu();
    };

    // --- Render Sections ---

    // --- Render Sections ---

    // ...


    // ...

    const renderObjectMenu = () => (
        <>
            <div className="px-3 py-1.5 text-[10px] font-black text-gray-400 dark:text-zinc-600 uppercase tracking-widest">
                Object
            </div>
            <button key="del" onClick={() => handleObjectAction(() => editorDeleteObjects(data?.objectIds || []))} className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 dark:text-red-400 flex items-center gap-3 text-sm transition-colors">
                <Trash2 size={15} /> Delete
            </button>

            {/* Edit Image Option */}
            {objectIds.length === 1 && (() => {
                const obj = currentPage?.objects.find(o => o.id === objectIds[0]);
                if (obj && obj.type === 'image' && obj.src) {
                    return (
                        <button
                            key="edit-image"
                            onClick={() => handleObjectAction(() => useEditorStore.getState().openImageStudio(obj.src!, obj.id, (obj as any).editParams))}
                            className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center gap-3 text-sm transition-colors"
                        >
                            <Image size={15} /> Edit Image
                        </button>
                    );
                }
                return null;
            })()}

            {/* Edit Shape Option */}
            {objectIds.length === 1 && (() => {
                const obj = currentPage?.objects.find(o => o.id === objectIds[0]);
                const isShape = obj && ['rectangle', 'circle', 'triangle', 'star', 'polygon', 'ellipse', 'heart', 'cloud', 'lightning', 'drop', 'callout-bubble'].includes(obj.type);

                if (isShape) return (
                    <button
                        key="edit-shape"
                        onClick={() => handleObjectAction(() => openShapeEditor('edit'))}
                        className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center gap-3 text-sm transition-colors"
                    >
                        <Edit3 size={15} /> Edit Shape
                    </button>
                );
                return null;
            })()}

            {/* Edit Text Option */}
            {objectIds.length === 1 && (() => {
                const obj = currentPage?.objects.find(o => o.id === objectIds[0]);
                if (obj && obj.type === 'text') {
                    return (
                        <button
                            key="edit-text"
                            onClick={() => handleObjectAction(() => useEditorStore.getState().openTextStudio('edit', obj.id))}
                            className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center gap-3 text-sm transition-colors"
                        >
                            <Edit3 size={15} /> Edit Text
                        </button>
                    );
                }
                return null;
            })()}

            <button key="dup" onClick={() => handleObjectAction(() => editorDuplicateObject(data?.objectIds || []))} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200 flex items-center gap-3 text-sm transition-colors">
                <Copy size={15} /> Duplicate
            </button>
            <div className="h-px bg-gray-100 dark:bg-white/5 my-1" />

            {objectIds.length > 1 && (
                <button
                    onClick={() => handleObjectAction(() => useEditorStore.getState().groupObjects(objectIds))}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200 flex items-center gap-3 text-sm transition-colors"
                >
                    <Split size={15} /> Group Objects
                </button>
            )}

            {objectIds.some((id: string) => currentPage?.objects.find(o => o.id === id)?.groupId) && (
                <button
                    onClick={() => handleObjectAction(() => useEditorStore.getState().ungroupObjects(objectIds))}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200 flex items-center gap-3 text-sm transition-colors"
                >
                    <RefreshCw size={15} /> Ungroup
                </button>
            )}

            <button
                onClick={() => handleObjectAction(() => {
                    data?.objectIds?.forEach((id: string) => {
                        const obj = currentPage?.objects.find(o => o.id === id);
                        if (obj) updateObject(id, { isLocked: !obj.isLocked });
                    });
                })}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200 flex items-center gap-3 text-sm transition-colors"
            >
                {currentPage?.objects.find(o => o.id === objectIds[0])?.isLocked ? (
                    <><ArrowUp size={15} className="rotate-180" /> Unlock</>
                ) : (
                    <><ArrowUp size={15} /> Lock</>
                )}
            </button>

            <div className="h-px bg-gray-100 dark:bg-white/5 my-1" />
            <button key="front" onClick={() => handleObjectAction(() => editorReorderObject(objectIds[0], 'front'))} disabled={objectIds.length !== 1} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200 disabled:opacity-50 flex items-center gap-3 text-sm transition-colors">
                <ArrowUp size={15} /> Bring to Front
            </button>
            <button key="back" onClick={() => handleObjectAction(() => editorReorderObject(objectIds[0], 'back'))} disabled={objectIds.length !== 1} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200 disabled:opacity-50 flex items-center gap-3 text-sm transition-colors">
                <ArrowDown size={15} /> Send to Back
            </button>
            {currentPage?.objects.find(o => o.id === objectIds[0])?.type === 'measure' && (
                <>
                    <button key="calibrate" onClick={() => handleObjectAction(() => {
                        const obj = currentPage?.objects.find(o => o.id === objectIds[0]);
                        if (obj && obj.type === 'measure' && obj.points) {
                            const [x1, y1, x2, y2] = obj.points;
                            const distPx = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

                            const knownDistStr = prompt(`Enter the actual distance for this measurement (current: ${Math.round(distPx)}px):`);
                            if (knownDistStr) {
                                const knownDist = parseFloat(knownDistStr);
                                if (!isNaN(knownDist) && knownDist > 0) {
                                    const unit = prompt("Enter the unit (e.g. cm, m, inch):", "cm") || "cm";
                                    // Scale = px / unit
                                    const newScale = distPx / knownDist;
                                    usePDFStore.getState().setCalibration(newScale, unit);
                                }
                            }
                        }
                    })} className="w-full text-left px-4 py-2 hover:bg-green-50 dark:hover:bg-green-900/10 text-green-600 dark:text-green-400 flex items-center gap-3 text-sm transition-colors">
                        <Ruler size={15} /> Calibrate Scale
                    </button>
                    <div className="h-px bg-gray-100 dark:bg-white/5 my-1" />
                </>
            )}
        </>
    );

    const renderPageMenu = () => (
        <>
            <div className="px-3 py-1.5 text-[10px] font-black text-gray-400 dark:text-zinc-600 uppercase tracking-widest">
                Page
            </div>
            <button key="edit" onClick={() => handlePageAction(async () => {
                // If we are on Home page list, finding page by ID. If in editor, existing logic applies.
                const page = pages.find(p => p.id === pageId);
                if (page) initEditor(page);
            })} className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center gap-3 text-sm font-medium transition-colors">
                <Edit3 size={15} /> Edit Page
            </button>
            <button key="dup_page" onClick={() => pageId && handlePageAction(() => usePDFStore.getState().duplicatePage(pageId))} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-zinc-200 flex items-center gap-3 text-sm font-medium transition-colors">
                <Copy size={15} /> Duplicate Page
            </button>
            <div className="h-px bg-gray-100 dark:bg-white/5 my-1" />
            <button key="del_page" onClick={() => pageId && handlePageAction(() => { if (confirm('Delete page?')) usePDFStore.getState().deletePage(pageId); })} className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 dark:text-red-400 flex items-center gap-3 text-sm font-medium transition-colors">
                <Trash2 size={15} /> Delete Page
            </button>
        </>
    );

    const renderThumbnailMenu = () => renderPageMenu(); // Thumbnails share page actions mostly

    const renderEditorBackgroundMenu = () => (
        <>
            <div className="px-3 py-1.5 text-[10px] font-black text-gray-400 dark:text-zinc-600 uppercase tracking-widest">
                Editor
            </div>
            <button
                onClick={() => {
                    addObject({
                        id: crypto.randomUUID(),
                        type: 'text',
                        x: (data?.x || 100), // Use click position if available (need to map store coords)
                        y: (data?.y || 100),
                        text: 'New Text',
                        fontSize: 24,
                        fill: '#000000',
                        width: 200,
                        height: 50
                    });
                    closeContextMenu();
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-zinc-200 flex items-center gap-3 text-sm font-medium transition-colors"
            >
                <StickyNote size={15} /> Add Text Here
            </button>

            <button
                onClick={async () => {
                    try {
                        const items = await navigator.clipboard.read();
                        // Paste logic similar to before, but adapted
                        for (const item of items) {
                            if (item.types.includes('image/png') || item.types.includes('image/jpeg')) {
                                const blob = await item.getType(item.types.includes('image/png') ? 'image/png' : 'image/jpeg');
                                const reader = new FileReader();
                                reader.onload = (e) => {
                                    addObject({
                                        id: crypto.randomUUID(),
                                        type: 'image',
                                        x: data?.x || 100, y: data?.y || 100,
                                        width: 200, height: 200, // Placeholder aspect
                                        src: e.target?.result as string
                                    });
                                };
                                reader.readAsDataURL(blob);
                            }
                        }
                    } catch (e) { console.error(e); }
                    closeContextMenu();
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-zinc-200 flex items-center gap-3 text-sm font-medium transition-colors"
            >
                <ClipboardPaste size={15} /> Paste
            </button>
            <div className="h-px bg-gray-100 dark:bg-white/5 my-1" />
            {renderPageMenu()}
        </>
    );

    return createPortal(
        <div
            ref={menuRef}
            style={{
                top: Math.min(y, window.innerHeight - 300), // Prevent overflow bottom
                left: Math.min(x, window.innerWidth - 220), // Prevent overflow right
            }}
            className="fixed z-[9999] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl shadow-black/20 dark:shadow-black/50 border border-gray-100 dark:border-white/10 min-w-[220px] py-1.5 animate-in fade-in zoom-in-95 duration-100 origin-top-left overflow-hidden"
            onContextMenu={(e) => e.preventDefault()}
        >
            {type === 'object' && renderObjectMenu()}
            {type === 'page' && renderPageMenu()}
            {type === 'thumbnail' && renderThumbnailMenu()}
            {type === 'editor-background' && renderEditorBackgroundMenu()}
        </div>,
        document.body
    );
};
