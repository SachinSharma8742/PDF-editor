import React, { useRef } from 'react';
import { usePDFStore } from '../../store/pdfStore';
import {
    Download,
    MousePointer2,
    PenLine,
    Minus,
    Plus,
    Eraser,
    Image as ImageIcon,
    Type,
    Square,
    Circle as CircleIcon,
    Undo2,
    Redo2,
    Highlighter,
    Trash2,
    Bold,
    Italic,
    Underline,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Group,
    Ungroup,
    Copy,
    BringToFront,
    SendToBack,
    Spline,
    BoxSelect,
    ChevronDown,
    FileText,
    Pencil,
    Sun,
    Moon,
    Palette,
    Layers,
    Type as TypeIcon,
    Hash
} from 'lucide-react';
import { loadPDF } from '../../utils/pdfOps';
import { saveDocument, exportPageAsPNG } from '../../utils/exportUtils';
import { useEditorStore } from '../../store/editorStore';
import clsx from 'clsx';
import { Tooltip } from '../ui/Tooltip';

export const Toolbar: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const [isExportOpen, setIsExportOpen] = React.useState(false);

    const {
        scale,
        setScale,
        activeTool,
        setActiveTool,
        toolPreferences,
        updateToolSettings,
        eraserMode,
        setEraserMode,
        undo,
        redo,
        canUndo,
        canRedo,
        setPdfDocument,
        setIsLoading,
        currentPage,
        addObject,
        pages,
        originalPdfBytes,
        selectedPageIds,
        selectedObjectIds,
        updateObject,
        deleteObjects,
        groupObjects,
        ungroupObjects,
        duplicateObject,
        reorderObject,
        theme,
        toggleTheme
    } = usePDFStore();

    const currentSettings = toolPreferences[activeTool];

    // --- Context Helpers ---
    const isSelectionMode = activeTool === 'select' && selectedObjectIds.length > 0;
    const isMulti = selectedObjectIds.length > 1;
    const firstSelectedId = selectedObjectIds[0];
    const findContext = () => {
        if (!firstSelectedId) return null;
        for (const page of pages) {
            const obj = page.objects.find(o => o.id === firstSelectedId);
            if (obj) return { obj, page };
        }
        return null;
    };
    const ctx = findContext();
    const selectedObj = ctx?.obj;
    const selectedPage = ctx?.page;
    const isGrouped = selectedObj?.groupId;

    // Check if there are any pages
    const hasPages = pages.length > 0;

    const handleObjectChange = (key: string, value: any) => {
        if (!selectedPage) return;
        selectedObjectIds.forEach(id => {
            updateObject(selectedPage.id, id, { [key]: value });
        });
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const insertImageCorrectly = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            const img = new Image();
            img.onload = () => {
                const targetWidth = 200;
                const targetHeight = (img.height / img.width) * targetWidth;
                const currentPageId = pages.find(p => p.pageNumber === currentPage)?.id || `page-${currentPage}`;
                if (currentPageId) {
                    addObject(currentPageId, {
                        id: crypto.randomUUID(),
                        type: 'image',
                        x: 100, y: 100,
                        width: targetWidth, height: targetHeight,
                        src: dataUrl
                    });
                    setActiveTool('select');
                }
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    // Tool Groups
    const drawingTools = [
        { id: 'pen', icon: PenLine, label: 'Pen' },
        { id: 'highlighter', icon: Highlighter, label: 'Highlight' },
        { id: 'eraser', icon: Eraser, label: 'Eraser' },
    ];

    const shapeTools = [
        { id: 'text', icon: Type, label: 'Text' },
        { id: 'rectangle', icon: Square, label: 'Rectangle' },
        { id: 'circle', icon: CircleIcon, label: 'Circle' },
    ];

    const colors = ['#000000', '#df4b26', '#10B981', '#3B82F6', '#6366F1'];
    const fontFamilies = ['Arial', 'Courier New', 'Georgia', 'Times New Roman', 'Verdana', 'Inter'];

    return (
        <div className="flex flex-col items-center gap-3 w-full cursor-default select-none pointer-events-none">
            {/* MAIN COMMAND CENTER */}
            <div className="pointer-events-auto bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl rounded-2xl border border-gray-200/50 dark:border-white/10 p-1.5 flex items-center shadow-2xl shadow-black/10 dark:shadow-black/40 transition-all duration-500">

                {/* 1. History */}
                <div className="flex items-center gap-0.5 pr-2 mr-2 border-r border-gray-200 dark:border-white/10">
                    <Tooltip content="Undo (Ctrl+Z)">
                        <button onClick={undo} disabled={!canUndo()} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-400 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-zinc-200 disabled:opacity-30 transition-all active:scale-95">
                            <Undo2 size={18} strokeWidth={2.5} />
                        </button>
                    </Tooltip>
                    <Tooltip content="Redo (Ctrl+Y)">
                        <button onClick={redo} disabled={!canRedo()} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-400 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-zinc-200 disabled:opacity-30 transition-all active:scale-95">
                            <Redo2 size={18} strokeWidth={2.5} />
                        </button>
                    </Tooltip>
                </div>

                {/* 2. Tools */}
                <div className="flex items-center gap-1 pr-2 mr-2 border-r border-gray-200 dark:border-white/10">
                    <Tooltip content="Select Tool (V)">
                        <button onClick={() => setActiveTool('select')} className={clsx("p-2 rounded-xl transition-all duration-200 relative group", activeTool === 'select' ? "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5")}>
                            <MousePointer2 size={18} strokeWidth={activeTool === 'select' ? 2.5 : 2} />
                        </button>
                    </Tooltip>
                </div>

                <div className={clsx("flex items-center gap-1 pr-2 mr-2 border-r border-gray-200 dark:border-white/10", !hasPages && "opacity-40 pointer-events-none")}>
                    {drawingTools.map((t) => (
                        <Tooltip key={t.id} content={t.label}>
                            <button onClick={() => setActiveTool(t.id as any)} disabled={!hasPages} className={clsx("p-2 rounded-xl transition-all duration-200 relative group", activeTool === t.id ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" : "text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5", !hasPages && "cursor-not-allowed")}>
                                <t.icon size={18} strokeWidth={activeTool === t.id ? 2.5 : 2} />
                            </button>
                        </Tooltip>
                    ))}
                </div>

                <div className={clsx("flex items-center gap-1 pr-2 mr-2 border-r border-gray-200 dark:border-white/10", !hasPages && "opacity-40 pointer-events-none")}>
                    {shapeTools.map((t) => (
                        <Tooltip key={t.id} content={t.label}>
                            <button onClick={() => setActiveTool(t.id as any)} disabled={!hasPages} className={clsx("p-2 rounded-xl transition-all duration-200 relative group", activeTool === t.id ? "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5", !hasPages && "cursor-not-allowed")}>
                                <t.icon size={18} strokeWidth={activeTool === t.id ? 2.5 : 2} />
                            </button>
                        </Tooltip>
                    ))}
                    <Tooltip content="Insert Image">
                        <button onClick={() => imageInputRef.current?.click()} disabled={!hasPages} className={clsx("p-2 rounded-xl text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-100 dark:hover:bg-white/5 transition-all", !hasPages && "cursor-not-allowed")}>
                            <ImageIcon size={18} strokeWidth={2} />
                        </button>
                    </Tooltip>
                </div>

                {/* 5. System Controls */}
                <div className="flex items-center gap-2 pl-1">
                    {hasPages && (
                        <Tooltip content="Advanced Editor">
                            <button onClick={() => { const page = pages.find(p => p.pageNumber === currentPage); if (page) useEditorStore.getState().initEditor(page); }} className="p-2 mr-1 rounded-xl text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all active:scale-95">
                                <Pencil size={18} strokeWidth={2.5} />
                            </button>
                        </Tooltip>
                    )}

                    <div className="flex items-center bg-gray-100 dark:bg-zinc-800 rounded-lg p-0.5 border border-transparent dark:border-white/5">
                        <button onClick={() => setScale(Math.max(0.1, scale - 0.1))} className="p-1 hover:bg-white dark:hover:bg-zinc-700 rounded-md text-gray-500 dark:text-zinc-400 transition-all"><Minus size={12} /></button>
                        <span className="text-[10px] w-8 text-center tabular-nums text-gray-700 dark:text-zinc-300 font-bold">{Math.round(scale * 100)}%</span>
                        <button onClick={() => setScale(Math.min(5, scale + 0.1))} className="p-1 hover:bg-white dark:hover:bg-zinc-700 rounded-md text-gray-500 dark:text-zinc-400 transition-all"><Plus size={12} /></button>
                    </div>

                    <button onClick={toggleTheme} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-400 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-zinc-100 transition-all active:rotate-45 duration-300">
                        {theme === 'dark' ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
                    </button>

                    <div className="relative ml-2">
                        <button onClick={() => setIsExportOpen(!isExportOpen)} className="h-9 px-4 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-gray-100 text-white dark:text-zinc-900 rounded-lg transition-all shadow-lg active:scale-95 flex items-center gap-2 group">
                            <span className="text-xs font-bold tracking-wide">Export</span>
                            <ChevronDown size={12} className={clsx("transition-transform duration-300 opacity-60", isExportOpen ? "rotate-180" : "")} />
                        </button>
                        {isExportOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsExportOpen(false)} />
                                <div className="absolute top-full right-0 mt-3 w-60 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-gray-100 dark:border-white/10 p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col gap-0.5">
                                    <button onClick={() => { saveDocument(pages, originalPdfBytes); setIsExportOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-3 text-gray-700 dark:text-zinc-300 transition-all"><FileText size={14} className="opacity-70" /><span className="text-xs font-medium">Save PDF</span></button>
                                    <button onClick={() => { const cp = pages.find(p => p.pageNumber === currentPage); if (cp) exportPageAsPNG(cp); setIsExportOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-3 text-gray-700 dark:text-zinc-300 transition-all"><ImageIcon size={14} className="opacity-70" /><span className="text-xs font-medium">Export Page Image</span></button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* --- PRO CONTEXTUAL PROPERTIES BAR --- */}
            {/* Conditional Rendering based on active tool */}
            <div className="pointer-events-auto h-12 flex items-center justify-center animate-in fade-in slide-in-from-top-2 duration-300">

                {/* A. PEN / HIGHLIGHTER / ERASER CONTEXT */}
                {['pen', 'highlighter', 'eraser'].includes(activeTool) && (
                    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl rounded-2xl shadow-xl shadow-blue-500/5 border border-gray-200 dark:border-white/10 px-4 py-2 flex items-center gap-4">
                        {/* 1. Size Control */}
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest leading-none">Thickness</span>
                                <span className="text-xs font-bold text-gray-700 dark:text-zinc-300 leading-none">{currentSettings?.size}px</span>
                            </div>
                            <input type="range" min="1" max={activeTool === 'highlighter' ? 40 : 20} value={currentSettings?.size || 1} onChange={(e) => updateToolSettings({ size: Number(e.target.value) })} className="w-24 h-1.5 bg-gray-100 dark:bg-zinc-700 rounded-full accent-blue-600 appearance-none cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors" />
                        </div>

                        <div className="w-px h-6 bg-gray-200 dark:bg-white/10" />

                        {/* 2. Color Control (Not for Eraser) */}
                        {activeTool !== 'eraser' && (
                            <div className="flex items-center gap-3">
                                <span className="text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Color</span>
                                <div className="flex items-center gap-1.5">
                                    {colors.map(c => (
                                        <button key={c} onClick={() => updateToolSettings({ color: c })} className={clsx("w-5 h-5 rounded-md transition-all duration-200 hover:scale-110 shadow-sm", currentSettings?.color === c ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-zinc-900 scale-110" : "hover:ring-1 ring-gray-200 dark:ring-white/20")} style={{ backgroundColor: c }} />
                                    ))}
                                    <div className="relative w-5 h-5 rounded-md overflow-hidden transition-all hover:scale-110 ring-1 ring-gray-200 dark:ring-white/20 shadow-sm">
                                        <input type="color" value={currentSettings?.color || '#000000'} onChange={(e) => updateToolSettings({ color: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                        <div className="absolute inset-0 bg-gradient-to-tr from-purple-500 via-pink-500 to-blue-500" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 3. Opacity (Highlighter Only) */}
                        {activeTool === 'highlighter' && (
                            <>
                                <div className="w-px h-6 bg-gray-200 dark:bg-white/10" />
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest leading-none">Opacity</span>
                                        <span className="text-xs font-bold text-gray-700 dark:text-zinc-300 leading-none">{Math.round((currentSettings?.opacity || 0.5) * 100)}%</span>
                                    </div>
                                    <input type="range" min="10" max="100" value={(currentSettings?.opacity || 0.5) * 100} onChange={(e) => updateToolSettings({ opacity: Number(e.target.value) / 100 })} className="w-24 h-1.5 bg-gray-100 dark:bg-zinc-700 rounded-full accent-blue-600 appearance-none cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors" />
                                </div>
                            </>
                        )}

                        {/* 4. Eraser Mode */}
                        {activeTool === 'eraser' && (
                            <>
                                <div className="w-px h-6 bg-gray-200 dark:bg-white/10" />
                                <div className="flex items-center p-0.5 rounded-lg bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-white/5">
                                    <button onClick={() => setEraserMode('path')} className={clsx("px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all", eraserMode === 'path' ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-500 dark:text-zinc-500 hover:text-gray-900")}>
                                        Drawing
                                    </button>
                                    <button onClick={() => setEraserMode('element')} className={clsx("px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all", eraserMode === 'element' ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-500 dark:text-zinc-500 hover:text-gray-900")}>
                                        Object
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* B. TEXT CONTEXT */}
                {activeTool === 'text' && (
                    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl rounded-2xl shadow-xl border border-gray-200 dark:border-white/10 px-4 py-2 flex items-center gap-4">
                        {/* Font Family */}
                        <div className="flex items-center gap-2">
                            <TypeIcon size={14} className="text-gray-400" />
                            <select
                                value={currentSettings?.fontFamily || 'Arial'}
                                onChange={(e) => updateToolSettings({ fontFamily: e.target.value })}
                                className="bg-transparent text-xs font-bold text-gray-700 dark:text-zinc-200 outline-none cursor-pointer hover:text-blue-600"
                            >
                                {fontFamilies.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>

                        <div className="w-px h-6 bg-gray-200 dark:bg-white/10" />

                        {/* Size */}
                        <div className="flex items-center gap-2">
                            <Hash size={14} className="text-gray-400" />
                            <input
                                type="number"
                                min="8" max="120"
                                value={currentSettings?.fontSize || 16}
                                onChange={(e) => updateToolSettings({ fontSize: Number(e.target.value) })}
                                className="w-12 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded px-1.5 py-1 text-xs font-bold text-center outline-none focus:border-blue-500"
                            />
                        </div>

                        <div className="w-px h-6 bg-gray-200 dark:bg-white/10" />

                        {/* Styles */}
                        <div className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 p-0.5 rounded-lg">
                            <button
                                onClick={() => updateToolSettings({ fontWeight: currentSettings?.fontWeight === 'bold' ? 'normal' : 'bold' })}
                                className={clsx("p-1.5 rounded-md transition-all", currentSettings?.fontWeight === 'bold' ? "bg-white dark:bg-zinc-600 text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-white/5")}
                            >
                                <Bold size={14} />
                            </button>
                            <button
                                onClick={() => updateToolSettings({ fontStyle: currentSettings?.fontStyle?.includes('italic') ? 'normal' : 'italic' })}
                                className={clsx("p-1.5 rounded-md transition-all", currentSettings?.fontStyle?.includes('italic') ? "bg-white dark:bg-zinc-600 text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-white/5")}
                            >
                                <Italic size={14} />
                            </button>
                        </div>

                        <div className="w-px h-6 bg-gray-200 dark:bg-white/10" />

                        {/* Color */}
                        <div className="flex items-center gap-1.5">
                            {colors.slice(0, 3).map(c => (
                                <button key={c} onClick={() => updateToolSettings({ color: c })} className={clsx("w-5 h-5 rounded-md transition-all duration-200 hover:scale-110", currentSettings?.color === c ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-zinc-900 scale-110" : "border border-gray-200 dark:border-white/10")} style={{ backgroundColor: c }} />
                            ))}
                            <div className="relative w-5 h-5 rounded-md overflow-hidden ring-1 ring-gray-200 dark:ring-white/10">
                                <input type="color" value={currentSettings?.color || '#000000'} onChange={(e) => updateToolSettings({ color: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-blue-500 opacity-80" />
                            </div>
                        </div>
                    </div>
                )}

                {/* C. SHAPE CONTEXT (Rect/Circle) */}
                {['rectangle', 'circle'].includes(activeTool) && (
                    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl rounded-2xl shadow-xl border border-gray-200 dark:border-white/10 px-4 py-2 flex items-center gap-4">
                        {/* Stroke */}
                        <div className="flex items-center gap-3">
                            <span className="text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Stroke</span>
                            <div className="flex items-center gap-2">
                                <div className="relative w-6 h-6 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 shadow-sm cursor-pointer hover:scale-105 transition-transform">
                                    <input type="color" value={currentSettings?.color || '#000000'} onChange={(e) => updateToolSettings({ color: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                    <div className="absolute inset-0" style={{ backgroundColor: currentSettings?.color || '#000000' }} />
                                </div>
                                <input type="range" min="1" max="10" value={currentSettings?.size || 2} onChange={(e) => updateToolSettings({ size: Number(e.target.value) })} className="w-16 h-1.5 bg-gray-100 dark:bg-zinc-700 rounded-full accent-blue-600 appearance-none cursor-pointer" />
                            </div>
                        </div>

                        <div className="w-px h-6 bg-gray-200 dark:bg-white/10" />

                        {/* Fill (Mockup mainly, as fill isn't deeply implemented in store settings yet, but UI is ready) */}
                        <div className="flex items-center gap-3">
                            <span className="text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Fill</span>
                            <button
                                className={clsx("w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all hover:scale-105", "border-gray-200 dark:border-white/10 bg-transparent")}
                                title="No Fill"
                            >
                                <div className="w-0.5 h-full bg-red-400 rotate-45" />
                            </button>
                        </div>
                    </div>
                )}

                {/* D. SELECTION CONTEXT (The Pro Editor Part) */}
                {isSelectionMode && selectedObj && (
                    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl rounded-2xl shadow-xl border border-gray-200 dark:border-white/10 px-3 py-1.5 flex items-center gap-2">

                        {/* 1. Basic Actions */}
                        <div className="flex items-center gap-1">
                            <Tooltip content="Duplicate (Ctrl+D)">
                                <button onClick={() => selectedPage && duplicateObject(selectedPage.id, selectedObj.id)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-600 dark:text-zinc-400 transition-all">
                                    <Copy size={16} />
                                </button>
                            </Tooltip>
                            <Tooltip content="Delete (Del)">
                                <button onClick={() => deleteObjects(selectedObjectIds)} className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 rounded-xl text-gray-600 dark:text-zinc-400 transition-all">
                                    <Trash2 size={16} />
                                </button>
                            </Tooltip>
                        </div>

                        <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />

                        {/* 2. Layering */}
                        <div className="flex items-center gap-1">
                            <Tooltip content="Bring to Front">
                                <button onClick={() => selectedPage && reorderObject(selectedPage.id, selectedObj.id, 'front')} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-600 dark:text-zinc-400 transition-all">
                                    <BringToFront size={16} />
                                </button>
                            </Tooltip>
                            <Tooltip content="Send to Back">
                                <button onClick={() => selectedPage && reorderObject(selectedPage.id, selectedObj.id, 'back')} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-600 dark:text-zinc-400 transition-all">
                                    <SendToBack size={16} />
                                </button>
                            </Tooltip>
                        </div>

                        <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />

                        {/* 3. Grouping */}
                        {(isMulti || isGrouped) && (
                            <Tooltip content={isGrouped ? "Ungroup" : "Group"}>
                                <button
                                    onClick={() => selectedPage && (isGrouped ? ungroupObjects(selectedPage.id, selectedObjectIds) : groupObjects(selectedPage.id, selectedObjectIds))}
                                    className={clsx("p-2 rounded-xl transition-all", isGrouped ? "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400" : "hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-zinc-400")}
                                >
                                    {isGrouped ? <Ungroup size={16} /> : <Group size={16} />}
                                </button>
                            </Tooltip>
                        )}

                        {(selectedObj.type === 'text' || selectedObj.type === 'rectangle' || selectedObj.type === 'circle') && (
                            <>
                                <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />
                                {/* Quick Color for Objects */}
                                <div className="flex items-center gap-1.5 px-2">
                                    <div className="relative w-5 h-5 rounded-md overflow-hidden cursor-pointer hover:scale-110 transition-transform ring-1 ring-gray-200 dark:ring-white/20">
                                        <input
                                            type="color"
                                            value={(selectedObj as any).stroke || (selectedObj as any).fill || '#000000'}
                                            onChange={(e) => handleObjectChange(selectedObj.type === 'text' ? 'fill' : 'stroke', e.target.value)}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        <div className="absolute inset-0" style={{ backgroundColor: (selectedObj as any).stroke || (selectedObj as any).fill || '#000000' }} />
                                    </div>

                                    {/* Slider for Stroke/Text Size */}
                                    {(selectedObj.type === 'rectangle' || selectedObj.type === 'circle') && (
                                        <input
                                            type="range" min="1" max="10"
                                            value={selectedObj.strokeWidth || 2}
                                            onChange={(e) => handleObjectChange('strokeWidth', Number(e.target.value))}
                                            className="w-16 h-1.5 bg-gray-100 dark:bg-zinc-700 rounded-full accent-blue-600 appearance-none cursor-pointer"
                                        />
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileUpload} hidden />
            <input ref={imageInputRef} type="file" accept="image/*" onChange={insertImageCorrectly} hidden />
        </div>
    );
};
