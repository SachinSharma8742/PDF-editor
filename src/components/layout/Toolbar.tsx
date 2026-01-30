import React, { useRef } from 'react';
import { usePDFStore } from '../../store/pdfStore';
import {
    Download,
    Upload,
    Trash2,
    MousePointer2,
    Pen,
    Minus,
    Plus,
    Palette,
    Eraser,
    Image as ImageIcon,
    FileImage,
    FileText
} from 'lucide-react';
import { loadPDF, extractPagesAsPNG, extractPagesAsPDF } from '../../utils/pdfOps';
import { saveDocument } from '../../utils/exportUtils';
import clsx from 'clsx';

export const Toolbar: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const {
        pdfDocument,
        scale,
        setScale,
        isSelectionMode,
        toggleSelectionMode,
        selectedPages,
        deleteSelectedPages,
        activeTool,
        setActiveTool,
        brushColor,
        setBrushColor,
        pages,
        originalPdfBytes,
        currentPage,
        addImageToPage,
        setPdfDocument,
        setIsLoading
    } = usePDFStore();

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const arrayBuffer = ev.target?.result as ArrayBuffer;
                if (!arrayBuffer) return;

                try {
                    setIsLoading(true);
                    const doc = await loadPDF(arrayBuffer);
                    setPdfDocument(doc, arrayBuffer);
                } catch (error) {
                    console.error("Failed to load PDF:", error);
                    alert("Error loading PDF. Please try another file.");
                } finally {
                    setIsLoading(false);
                }
            };
            reader.readAsArrayBuffer(file);
        }
        // Reset input
        e.target.value = '';
    };

    const handleImageInsert = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target?.result as string;
                const img = new Image();
                img.onload = () => {
                    // Default to center of page or top left
                    // Use 200px width or reasonable size
                    const targetWidth = 200;
                    const targetHeight = (img.height / img.width) * targetWidth;

                    addImageToPage(currentPage, {
                        id: `img-${Date.now()}`,
                        url: dataUrl,
                        x: 50,
                        y: 50,
                        width: targetWidth,
                        height: targetHeight,
                        rotation: 0
                    });
                };
                img.src = dataUrl;
            };
            reader.readAsDataURL(file);
        }
        // Reset input
        if (imageInputRef.current) imageInputRef.current.value = '';
    };

    const handleSave = async () => {
        await saveDocument(pages, originalPdfBytes);
    };

    const handleExtractPNG = () => {
        extractPagesAsPNG(pdfDocument, selectedPages);
    };

    const handleExtractPDF = () => {
        if (originalPdfBytes) extractPagesAsPDF(originalPdfBytes, selectedPages);
    };

    return (
        <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shadow-sm z-20 sticky top-0">
            {/* Left: File Ops */}
            <div className="flex items-center space-x-2">
                <button
                    onClick={() => document.getElementById('pdf-upload-input')?.click()}
                    className="flex items-center text-gray-700 hover:text-blue-600 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
                >
                    <Upload size={18} className="mr-2" />
                    <span className="text-sm font-medium">Open</span>
                </button>
                <button
                    onClick={handleSave}
                    className="flex items-center text-gray-700 hover:text-blue-600 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
                >
                    <Download size={18} className="mr-2" />
                    <span className="text-sm font-medium">Save</span>
                </button>
            </div>

            {/* Center: Tools */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1 space-x-1">
                <button
                    onClick={toggleSelectionMode}
                    className={clsx(
                        "p-2 rounded-md transition-all",
                        isSelectionMode ? "bg-white text-blue-600 shadow-sm" : "hover:bg-gray-200 text-gray-600"
                    )}
                    title="Select Pages"
                >
                    <MousePointer2 size={18} />
                </button>

                <div className="w-px h-6 bg-gray-300 mx-2" />

                <button
                    onClick={() => !isSelectionMode && setActiveTool('select')}
                    className={clsx(
                        "p-2 rounded-md transition-all",
                        !isSelectionMode && activeTool === 'select' ? "bg-white text-blue-600 shadow-sm" : "hover:bg-gray-200 text-gray-600",
                        isSelectionMode && "opacity-50 cursor-not-allowed"
                    )}
                    title="Select objects"
                    disabled={isSelectionMode}
                >
                    <MousePointer2 size={18} className="rotate-90" />
                </button>

                <button
                    onClick={() => !isSelectionMode && setActiveTool('pen')}
                    className={clsx(
                        "p-2 rounded-md transition-all",
                        !isSelectionMode && activeTool === 'pen' ? "bg-white text-blue-600 shadow-sm" : "hover:bg-gray-200 text-gray-600",
                        isSelectionMode && "opacity-50 cursor-not-allowed"
                    )}
                    title="Pen"
                    disabled={isSelectionMode}
                >
                    <Pen size={18} />
                </button>

                <button
                    onClick={() => !isSelectionMode && setActiveTool('highlighter')}
                    className={clsx(
                        "p-2 rounded-md transition-all",
                        !isSelectionMode && activeTool === 'highlighter' ? "bg-white text-blue-600 shadow-sm" : "hover:bg-gray-200 text-gray-600",
                        isSelectionMode && "opacity-50 cursor-not-allowed"
                    )}
                    title="Highlighter"
                    disabled={isSelectionMode}
                >
                    <div className="w-4 h-4 bg-yellow-200 border border-gray-400 rounded-sm" />
                </button>

                <button
                    onClick={() => !isSelectionMode && setActiveTool('eraser')}
                    className={clsx(
                        "p-2 rounded-md transition-all",
                        !isSelectionMode && activeTool === 'eraser' ? "bg-white text-blue-600 shadow-sm" : "hover:bg-gray-200 text-gray-600",
                        isSelectionMode && "opacity-50 cursor-not-allowed"
                    )}
                    title="Eraser"
                    disabled={isSelectionMode}
                >
                    <Eraser size={18} />
                </button>

                <button
                    onClick={() => !isSelectionMode && imageInputRef.current?.click()}
                    className={clsx(
                        "p-2 rounded-md transition-all",
                        "hover:bg-gray-200 text-gray-600",
                        isSelectionMode && "opacity-50 cursor-not-allowed"
                    )}
                    title="Insert Image"
                    disabled={isSelectionMode}
                >
                    <ImageIcon size={18} />
                </button>
                <input type="file" ref={imageInputRef} hidden accept="image/*" onChange={handleImageInsert} />
                <input type="file" id="pdf-upload-input" hidden accept="application/pdf" onChange={handleFileUpload} />

                {/* Color/Size Controls (Visible if Pen/Highlighter) */}
                {(!isSelectionMode && (activeTool === 'pen' || activeTool === 'highlighter')) && (
                    <>
                        <div className="w-px h-6 bg-gray-300 mx-2" />
                        <div className="flex items-center space-x-2 px-2">
                            <input
                                type="color"
                                value={brushColor}
                                onChange={(e) => setBrushColor(e.target.value)}
                                className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                            />
                        </div>
                    </>
                )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center space-x-3">
                {isSelectionMode && selectedPages.size > 0 && (
                    <>
                        <span className="text-sm text-gray-500">{selectedPages.size} selected</span>
                        <div className="h-4 w-px bg-gray-300" />
                        <button
                            onClick={handleExtractPNG}
                            className="text-gray-600 hover:text-blue-600 text-sm font-medium flex items-center"
                        >
                            <FileImage size={16} className="mr-1" /> PNG
                        </button>
                        <button
                            onClick={handleExtractPDF}
                            className="text-gray-600 hover:text-blue-600 text-sm font-medium flex items-center"
                        >
                            <FileText size={16} className="mr-1" /> PDF
                        </button>
                        <button
                            onClick={deleteSelectedPages}
                            className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50"
                        >
                            <Trash2 size={18} />
                        </button>
                    </>
                )}

                <div className="flex items-center bg-gray-100 rounded-md">
                    <button onClick={() => setScale(Math.max(0.5, scale - 0.1))} className="p-1 hover:bg-gray-200 rounded-l">
                        <Minus size={14} />
                    </button>
                    <span className="px-2 text-xs font-semibold w-12 text-center">
                        {Math.round(scale * 100)}%
                    </span>
                    <button onClick={() => setScale(Math.min(3, scale + 0.1))} className="p-1 hover:bg-gray-200 rounded-r">
                        <Plus size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};
