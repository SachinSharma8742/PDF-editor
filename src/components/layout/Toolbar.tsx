import React, { useRef } from 'react';
import { usePDFStore } from '../../store/pdfStore';
import {
    Download,
    Upload,
    MousePointer2,
    Pen,
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
    Group,
    Ungroup,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Palette,
    Spline,
    BoxSelect,
    ChevronDown,
    FileText,
    File,
    Pencil,
    Sun,
    Moon
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
        pdfDocument,
        selectedPageIds,
        // Selection/Object Props
        selectedObjectIds,
        updateObject,
        deleteObjects,
        groupObjects,
        ungroupObjects,
        theme,
        toggleTheme
    } = usePDFStore();

    // Derived Settings for Active Tool (MEMORY FIX)
    const currentSettings = toolPreferences[activeTool];

    // --- Helper Logic for Selection Context ---
    const isSelectionMode = activeTool === 'select' && selectedObjectIds.length > 0;
    const isMulti = selectedObjectIds.length > 1;
    const firstSelectedId = selectedObjectIds[0];

    // Find the object details
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
                    // Clone the buffer for PDF.js to consume/transfer
                    const bufferForPDFjs = arrayBuffer.slice(0);
                    const doc = await loadPDF(bufferForPDFjs);
                    // Store the original (valid) buffer
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

    const tools = [
        { id: 'select', icon: MousePointer2, label: 'Select' },
        { id: 'pen', icon: Pen, label: 'Pen' },
        { id: 'highlighter', icon: Highlighter, label: 'Highlight' },
        { id: 'eraser', icon: Eraser, label: 'Eraser' },
        { id: 'text', icon: Type, label: 'Text' },
        { id: 'rectangle', icon: Square, label: 'Rectangle' },
        { id: 'circle', icon: CircleIcon, label: 'Circle' },
    ];

    const colors = ['#000000', '#df4b26', '#10B981', '#3B82F6', '#6366F1'];

    return (
        <div className="flex flex-col items-center gap-4 w-full">
            {/* MAIN COMMAND CENTER (Top Row) */}
            <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-full border border-gray-200 dark:border-zinc-700 p-2 flex items-center gap-4 text-gray-700 dark:text-gray-200 text-sm z-50">

                {/* 1. View Controls (Undo/Redo + Zoom + Theme) - Left Side */}
                <div className="flex items-center gap-1 pr-4 border-r border-gray-200 dark:border-zinc-700">
                    <Tooltip content="Undo">
                        <button onClick={undo} disabled={!canUndo()} className="p-2.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full text-gray-500 dark:text-gray-400 disabled:opacity-30 transition-colors">
                            <Undo2 size={18} />
                        </button>
                    </Tooltip>
                    <Tooltip content="Redo">
                        <button onClick={redo} disabled={!canRedo()} className="p-2.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full text-gray-500 dark:text-gray-400 disabled:opacity-30 transition-colors">
                            <Redo2 size={18} />
                        </button>
                    </Tooltip>

                    <div className="flex items-center bg-gray-100 dark:bg-zinc-800 rounded-full p-0.5 border border-gray-200 dark:border-zinc-700 ml-2">
                        <button onClick={() => setScale(Math.max(0.1, scale - 0.1))} className="p-1 hover:bg-white dark:hover:bg-zinc-700 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 shadow-sm transition-colors">
                            <Minus size={12} />
                        </button>
                        <span className="text-[10px] w-8 text-center tabular-nums text-gray-600 dark:text-gray-300 font-medium">{Math.round(scale * 100)}%</span>
                        <button onClick={() => setScale(Math.min(5, scale + 0.1))} className="p-1 hover:bg-white dark:hover:bg-zinc-700 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 shadow-sm transition-colors">
                            <Plus size={12} />
                        </button>
                    </div>

                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="ml-2 p-2.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    >
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                </div>

                {/* 2. Tools (Center) */}
                <div className="flex items-center gap-1.5 px-2">
                    {tools.map((t) => (
                        <Tooltip key={t.id} content={t.label}>
                            <button
                                onClick={() => setActiveTool(t.id as any)}
                                className={clsx(
                                    "p-2.5 rounded-full transition-all duration-200 group relative",
                                    activeTool === t.id
                                        ? "bg-gray-900 dark:bg-blue-600 text-white shadow-lg shadow-gray-900/20 dark:shadow-blue-600/30 ring-1 ring-gray-900 dark:ring-blue-600"
                                        : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-zinc-800"
                                )}
                            >
                                <t.icon size={20} className={clsx("transition-transform group-hover:scale-110", t.id === 'highlighter' ? 'stroke-[2.5px]' : '')} />
                                {activeTool === t.id && (
                                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-gray-900 dark:bg-blue-400 rounded-full opacity-0" />
                                )}
                            </button>
                        </Tooltip>
                    ))}

                    <Tooltip content="Insert Image">
                        <button
                            onClick={() => imageInputRef.current?.click()}
                            className="p-2.5 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all"
                        >
                            <ImageIcon size={20} />
                        </button>
                    </Tooltip>

                    <Tooltip content="Edit Page (Advanced)">
                        <button
                            onClick={() => {
                                const page = pages.find(p => p.pageNumber === currentPage);
                                if (page) useEditorStore.getState().initEditor(page);
                            }}
                            className="p-2.5 rounded-full text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all ring-1 ring-blue-100 dark:ring-blue-800 shadow-sm"
                        >
                            <Pencil size={20} />
                        </button>
                    </Tooltip>
                </div>

                {/* 3. Global Actions (Export) */}
                <div className="flex items-center gap-3 pl-4 border-l border-gray-200 dark:border-zinc-700 relative">
                    <div className="relative">
                        <button
                            onClick={() => setIsExportOpen(!isExportOpen)}
                            className="px-4 py-2 bg-gray-900 dark:bg-blue-600 hover:bg-black dark:hover:bg-blue-700 text-white dark:text-white rounded-full transition-all transform active:scale-95 flex items-center gap-2 group"
                        >
                            <Download size={18} />
                            <span className="text-sm font-bold">Export</span>
                            <ChevronDown size={14} className={clsx("transition-transform duration-200", isExportOpen ? "rotate-180" : "")} />
                        </button>

                        {isExportOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsExportOpen(false)} />
                                <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col gap-1">
                                    <button
                                        onClick={() => {
                                            saveDocument(pages, originalPdfBytes);
                                            setIsExportOpen(false);
                                        }}
                                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50 flex items-center gap-3 text-gray-700 transition-colors group"
                                    >
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
                                            <FileText size={18} />
                                        </div>
                                        <div>
                                            <span className="block text-xs font-bold text-gray-900">Save PDF</span>
                                            <span className="block text-[10px] text-gray-400">Download current file</span>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => {
                                            const currentPageObj = pages.find(p => p.pageNumber === currentPage);
                                            if (currentPageObj) exportPageAsPNG(currentPageObj);
                                            setIsExportOpen(false);
                                        }}
                                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50 flex items-center gap-3 text-gray-700 transition-colors group"
                                    >
                                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-100 transition-colors">
                                            <ImageIcon size={18} />
                                        </div>
                                        <div>
                                            <span className="block text-xs font-bold text-gray-900">Export Page</span>
                                            <span className="block text-[10px] text-gray-400">Save current page as PNG</span>
                                        </div>
                                    </button>

                                    <div className="my-1 border-t border-gray-100" />

                                    <button
                                        onClick={() => {
                                            // Ensure we save purely the new pages if needed, but standard save handles it.
                                            // The user asked for "Export as New PDF". 
                                            // Effectively, our current save IS a new PDF (it generates from scratch).
                                            // We'll map this to the same save function for now but label it distinctly if logic differs in future.
                                            // Or we could implement a "Clean Export" without history?
                                            saveDocument(pages, originalPdfBytes);
                                            // Mentally noting: "Export as New PDF" usually implies "Save As". Standard save does this (client side).
                                            setIsExportOpen(false);
                                        }}
                                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50 flex items-center gap-3 text-gray-700 transition-colors group"
                                    >
                                        <div className="p-2 bg-green-50 text-green-600 rounded-lg group-hover:bg-green-100 transition-colors">
                                            <File size={18} />
                                        </div>
                                        <div>
                                            <span className="block text-xs font-bold text-gray-900">Export New PDF</span>
                                            <span className="block text-[10px] text-gray-400">Save as new document</span>
                                        </div>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* SATELLITE BAR (Properties Pill) - Contextual */}

            {/* A. Drawing Tools Satellite */}
            {['pen', 'highlighter', 'eraser', 'text', 'rectangle', 'circle'].includes(activeTool) && !isSelectionMode && (
                <div className="bg-white/95 backdrop-blur-xl rounded-xl shadow-lg shadow-gray-200/60 border border-gray-200/80 h-11 px-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300 transition-all">
                    {/* Color Palette */}
                    {activeTool !== 'eraser' && (
                        <div className="flex items-center gap-2 bg-gradient-to-r from-gray-50 to-gray-100/80 rounded-lg px-2 py-1 border border-gray-200/50 shadow-sm hover:shadow-md transition-all duration-200">
                            <span className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">Color</span>
                            <div className="flex items-center gap-1">
                                {colors.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => updateToolSettings({ color: c })}
                                        className={clsx(
                                            "w-4 h-4 rounded-md transition-all duration-200 hover:scale-110 active:scale-95 border",
                                            currentSettings.color === c
                                                ? "border-blue-500 shadow-md shadow-blue-500/20 scale-105"
                                                : "border-gray-300 hover:border-gray-400"
                                        )}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                                <button
                                    className="w-4 h-4 rounded-md relative overflow-hidden transition-all duration-200 hover:scale-110 active:scale-95 border border-gray-300 hover:border-gray-400"
                                    style={{ backgroundColor: currentSettings.color }}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent" />
                                    <input
                                        type="color"
                                        value={currentSettings.color}
                                        onChange={(e) => updateToolSettings({ color: e.target.value })}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Size Slider */}
                    <div className="flex items-center gap-2 bg-gradient-to-r from-gray-50 to-gray-100/80 rounded-lg px-2 py-1 border border-gray-200/50 shadow-sm hover:shadow-md transition-all duration-200">
                        <span className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">Size</span>
                        <div className="flex items-center gap-1.5 bg-white/60 backdrop-blur-sm rounded-md px-1.5 py-0.5 border border-gray-200/50">
                            <input
                                type="range"
                                min="1" max={activeTool === 'highlighter' ? 30 : (activeTool === 'eraser' ? 100 : 20)}
                                value={currentSettings.size}
                                onChange={(e) => updateToolSettings({ size: Number(e.target.value) })}
                                className="w-14 h-1 accent-blue-500 cursor-pointer appearance-none bg-gradient-to-r from-gray-200 to-gray-300 rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-blue-500/30 [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform"
                            />
                            <span className="text-[9px] font-medium text-gray-500 tabular-nums w-4 text-right">{currentSettings.size}</span>
                        </div>
                    </div>

                    {/* Opacity Slider (Highlighter only) */}
                    {activeTool === 'highlighter' && (
                        <div className="flex items-center gap-2 bg-gradient-to-r from-gray-50 to-gray-100/80 rounded-lg px-2 py-1 border border-gray-200/50 shadow-sm hover:shadow-md transition-all duration-200">
                            <span className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">Opacity</span>
                            <div className="flex items-center gap-1.5 bg-white/60 backdrop-blur-sm rounded-md px-1.5 py-0.5 border border-gray-200/50">
                                <input
                                    type="range"
                                    min="0.1" max="1" step="0.1"
                                    value={currentSettings.opacity}
                                    onChange={(e) => updateToolSettings({ opacity: Number(e.target.value) })}
                                    className="w-12 h-1 accent-blue-500 cursor-pointer appearance-none bg-gradient-to-r from-gray-200 to-gray-300 rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-blue-500/30 [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform"
                                />
                                <span className="text-[9px] font-medium text-gray-500 tabular-nums w-4 text-right">{Math.round((currentSettings.opacity || 1) * 100)}%</span>
                            </div>
                        </div>
                    )}

                    {/* Eraser Mode Toggle */}
                    {activeTool === 'eraser' && (
                        <div className="flex items-center gap-2 bg-gradient-to-r from-gray-50 to-gray-100/80 rounded-lg px-2 py-1 border border-gray-200/50 shadow-sm hover:shadow-md transition-all duration-200">
                            <span className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">Mode</span>
                            <div className="flex items-center gap-0.5 bg-white/80 rounded-md p-0.5 border border-gray-200/50">
                                <button
                                    onClick={() => setEraserMode('path')}
                                    className={clsx(
                                        "px-2 py-1 rounded-md transition-all duration-200 flex items-center gap-1",
                                        eraserMode === 'path'
                                            ? "bg-blue-500 text-white shadow-sm shadow-blue-500/30"
                                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                                    )}
                                    title="Path Eraser (Erase Drawings)"
                                >
                                    <Spline size={12} />
                                    <span className="text-[9px] uppercase font-semibold">Path</span>
                                </button>
                                <button
                                    onClick={() => setEraserMode('element')}
                                    className={clsx(
                                        "px-2 py-1 rounded-md transition-all duration-200 flex items-center gap-1",
                                        eraserMode === 'element'
                                            ? "bg-blue-500 text-white shadow-sm shadow-blue-500/30"
                                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                                    )}
                                    title="Element Eraser (Delete Objects)"
                                >
                                    <BoxSelect size={12} />
                                    <span className="text-[9px] uppercase font-semibold">Element</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* B. Selection Satellite */}
            {isSelectionMode && selectedObj && (
                <div className="bg-white/95 backdrop-blur-xl rounded-xl shadow-lg shadow-gray-200/60 border border-gray-200/80 h-11 px-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300 transition-all">

                    {/* Group/Ungroup */}
                    {(isMulti || isGrouped) && (
                        <div className="flex items-center bg-gradient-to-r from-gray-50 to-gray-100/80 rounded-lg px-2 py-1 border border-gray-200/50 shadow-sm hover:shadow-md transition-all duration-200">
                            <button
                                onClick={() => selectedPage && (isGrouped ? ungroupObjects(selectedPage.id, selectedObjectIds) : groupObjects(selectedPage.id, selectedObjectIds))}
                                className={clsx(
                                    "p-1 rounded-md transition-all duration-200 hover:scale-105 active:scale-95",
                                    "text-gray-600 hover:text-gray-900 hover:bg-white/80"
                                )}
                                title={isGrouped ? "Ungroup" : "Group"}
                            >
                                {isGrouped ? <Ungroup size={14} /> : <Group size={14} />}
                            </button>
                        </div>
                    )}

                    {/* Delete */}
                    <div className="flex items-center bg-gradient-to-r from-red-50 to-red-100/80 rounded-lg px-2 py-1 border border-red-200/50 shadow-sm hover:shadow-md transition-all duration-200">
                        <button
                            onClick={() => deleteObjects(selectedObjectIds)}
                            className="p-1 rounded-md text-red-500 hover:text-red-700 transition-all duration-200 hover:scale-105 active:scale-95 hover:bg-white/80"
                            title="Delete"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>

                    {/* Text Object Controls */}
                    {selectedObj.type === 'text' && (
                        <>
                            {/* Text Style Controls */}
                            <div className="flex items-center gap-2 bg-gradient-to-r from-gray-50 to-gray-100/80 rounded-lg px-2 py-1 border border-gray-200/50 shadow-sm hover:shadow-md transition-all duration-200">
                                <span className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">Style</span>
                                <div className="flex items-center gap-0.5 bg-white/80 rounded-md p-0.5 border border-gray-200/50">
                                    <button
                                        onClick={() => handleObjectChange('fontWeight', selectedObj.fontWeight === 'bold' ? 'normal' : 'bold')}
                                        className={clsx(
                                            "p-1 rounded-md transition-all duration-200 hover:scale-105 active:scale-95",
                                            selectedObj.fontWeight === 'bold'
                                                ? "bg-blue-500 text-white shadow-sm shadow-blue-500/30"
                                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                                        )}
                                        title="Bold"
                                    >
                                        <Bold size={12} />
                                    </button>
                                    <button
                                        onClick={() => handleObjectChange('fontStyle', selectedObj.fontStyle?.includes('italic') ? 'normal' : 'italic')}
                                        className={clsx(
                                            "p-1 rounded-md transition-all duration-200 hover:scale-105 active:scale-95",
                                            selectedObj.fontStyle?.includes('italic')
                                                ? "bg-blue-500 text-white shadow-sm shadow-blue-500/30"
                                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                                        )}
                                        title="Italic"
                                    >
                                        <Italic size={12} />
                                    </button>
                                </div>
                            </div>

                            {/* Text Color Picker */}
                            <div className="flex items-center gap-2 bg-gradient-to-r from-gray-50 to-gray-100/80 rounded-lg px-2 py-1 border border-gray-200/50 shadow-sm hover:shadow-md transition-all duration-200">
                                <span className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">Color</span>
                                <div className="flex items-center gap-1">
                                    {colors.slice(0, 3).map(c => (
                                        <button
                                            key={c}
                                            onClick={() => handleObjectChange('fill', c)}
                                            className={clsx(
                                                "w-4 h-4 rounded-md transition-all duration-200 hover:scale-110 active:scale-95 border",
                                                selectedObj.fill === c
                                                    ? "border-blue-500 shadow-md shadow-blue-500/20 scale-105"
                                                    : "border-gray-300 hover:border-gray-400"
                                            )}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                    <button
                                        className="w-4 h-4 rounded-md relative overflow-hidden transition-all duration-200 hover:scale-110 active:scale-95 border border-gray-300 hover:border-gray-400"
                                        style={{ backgroundColor: selectedObj.fill }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent" />
                                        <input
                                            type="color"
                                            value={selectedObj.fill}
                                            onChange={(e) => handleObjectChange('fill', e.target.value)}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Rectangle/Circle Controls */}
                    {(selectedObj.type === 'rectangle' || selectedObj.type === 'circle') && (
                        <>
                            {/* Fill Control */}
                            <div className="flex items-center gap-2 bg-gradient-to-r from-gray-50 to-gray-100/80 rounded-lg px-2 py-1 border border-gray-200/50 shadow-sm hover:shadow-md transition-all duration-200">
                                <span className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">Fill</span>
                                <div className="flex items-center gap-1">
                                    {/* Transparent Option */}
                                    <button
                                        onClick={() => handleObjectChange('fill', 'transparent')}
                                        className={clsx(
                                            "w-5 h-5 rounded-md relative overflow-hidden transition-all duration-200 hover:scale-105 active:scale-95",
                                            "bg-gradient-to-br from-gray-100 to-gray-200 border-2",
                                            selectedObj.fill === 'transparent'
                                                ? "border-blue-500 shadow-md shadow-blue-500/20"
                                                : "border-gray-300 hover:border-gray-400"
                                        )}
                                        title="No Fill"
                                    >
                                        <div className="absolute inset-0 bg-[linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%)] bg-[length:4px_4px]" />
                                        <div className="absolute top-1/2 left-1/2 w-[120%] h-0.5 bg-gradient-to-r from-red-400 to-red-600 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full shadow-sm" />
                                    </button>

                                    {/* Color Picker */}
                                    <button
                                        className={clsx(
                                            "w-5 h-5 rounded-md relative overflow-hidden transition-all duration-200 hover:scale-105 active:scale-95 border",
                                            selectedObj.fill === 'transparent'
                                                ? "opacity-50 border-gray-300"
                                                : "border-gray-300 hover:border-gray-400 shadow-sm hover:shadow-md"
                                        )}
                                        style={{ backgroundColor: selectedObj.fill === 'transparent' ? '#e5e7eb' : selectedObj.fill }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent" />
                                        <input
                                            type="color"
                                            value={selectedObj.fill === 'transparent' ? '#ffffff' : selectedObj.fill}
                                            onChange={(e) => handleObjectChange('fill', e.target.value)}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                    </button>
                                </div>
                            </div>

                            {/* Stroke Control */}
                            <div className="flex items-center gap-2 bg-gradient-to-r from-gray-50 to-gray-100/80 rounded-lg px-2 py-1 border border-gray-200/50 shadow-sm hover:shadow-md transition-all duration-200">
                                <span className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">Stroke</span>
                                <div className="flex items-center gap-2">
                                    {/* Color Picker */}
                                    <div className="relative group">
                                        <button
                                            className={clsx(
                                                "w-5 h-5 rounded-md relative overflow-hidden transition-all duration-200 hover:scale-105 active:scale-95 border shadow-sm hover:shadow-md",
                                                "border-gray-300 hover:border-gray-400"
                                            )}
                                            style={{ backgroundColor: selectedObj.stroke || '#000000' }}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
                                            <input
                                                type="color"
                                                value={selectedObj.stroke || '#000000'}
                                                onChange={(e) => handleObjectChange('stroke', e.target.value)}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                        </button>
                                    </div>

                                    {/* Stroke Width Slider */}
                                    <div className="flex items-center gap-1.5 bg-white/60 backdrop-blur-sm rounded-md px-1.5 py-0.5 border border-gray-200/50">
                                        <input
                                            type="range"
                                            min="0" max="12"
                                            value={selectedObj.strokeWidth || 0}
                                            onChange={(e) => handleObjectChange('strokeWidth', Number(e.target.value))}
                                            className="w-14 h-1 accent-blue-500 cursor-pointer appearance-none bg-gradient-to-r from-gray-200 to-gray-300 rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-blue-500/30 [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform"
                                        />
                                        <span className="text-[9px] font-medium text-gray-500 tabular-nums w-3 text-right">{selectedObj.strokeWidth || 0}</span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                </div>
            )}

            {/* Hidden Inputs */}
            <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileUpload} hidden />
            <input ref={imageInputRef} type="file" accept="image/*" onChange={insertImageCorrectly} hidden />
        </div>
    );
};
