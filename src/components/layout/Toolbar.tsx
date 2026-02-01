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
    RotateCw,
    FlipHorizontal,
    FlipVertical,
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
        rotatePage,
        flipPage,
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
                    <Tooltip content="Rotate Page">
                        <button onClick={() => { const p = pages.find(pg => pg.pageNumber === currentPage); if (p) rotatePage(p.id, 'cw'); }} disabled={!hasPages} className={clsx("p-2 rounded-xl transition-all duration-200 relative group text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5", !hasPages && "cursor-not-allowed")}>
                            <RotateCw size={18} strokeWidth={2} />
                        </button>
                    </Tooltip>
                    <Tooltip content="Flip Horizontal">
                        <button onClick={() => { const p = pages.find(pg => pg.pageNumber === currentPage); if (p) flipPage(p.id, 'horizontal'); }} disabled={!hasPages} className={clsx("p-2 rounded-xl transition-all duration-200 relative group text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5", !hasPages && "cursor-not-allowed")}>
                            <FlipHorizontal size={18} strokeWidth={2} />
                        </button>
                    </Tooltip>
                    <Tooltip content="Flip Vertical">
                        <button onClick={() => { const p = pages.find(pg => pg.pageNumber === currentPage); if (p) flipPage(p.id, 'vertical'); }} disabled={!hasPages} className={clsx("p-2 rounded-xl transition-all duration-200 relative group text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5", !hasPages && "cursor-not-allowed")}>
                            <FlipVertical size={18} strokeWidth={2} />
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

            {/* Removed Contextual Properties Bar - Now handled by EditorLeftPanel */}

            <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileUpload} hidden />
            <input ref={imageInputRef} type="file" accept="image/*" onChange={insertImageCorrectly} hidden />
        </div>
    );
};
