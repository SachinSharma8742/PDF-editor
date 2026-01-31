import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePDFStore } from '../../../store/pdfStore';
import { Image as ImageIcon, FilePlus, X, Settings2, FileText, Palette } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import clsx from 'clsx';

interface AddPageModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type PageMode = 'image' | 'blank' | 'append';

export const AddPageModal: React.FC<AddPageModalProps> = ({ isOpen, onClose }) => {
    const { addPage, appendPDF, theme } = usePDFStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null);

    // State
    const [mode, setMode] = useState<PageMode>('blank');
    const [width, setWidth] = useState<number>(595);
    const [height, setHeight] = useState<number>(842);
    const [backgroundColor, setBackgroundColor] = useState<string>('#ffffff');
    const [useImageDimensions, setUseImageDimensions] = useState(true);
    const [selectedImage, setSelectedImage] = useState<{ url: string; width: number; height: number } | null>(null);
    const [selectedPDFName, setSelectedPDFName] = useState<string | null>(null);
    const [pdfFile, setPdfFile] = useState<File | null>(null);

    // Reset state on open
    useEffect(() => {
        if (isOpen) {
            setMode('blank');
            setWidth(595);
            setHeight(842);
            setBackgroundColor('#ffffff');
            setSelectedImage(null);
            setSelectedPDFName(null);
            setPdfFile(null);
            setUseImageDimensions(true);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target?.result as string;
                const img = new Image();
                img.onload = () => {
                    setSelectedImage({
                        url: dataUrl,
                        width: img.width,
                        height: img.height
                    });
                    if (useImageDimensions) {
                        setWidth(img.width);
                        setHeight(img.height);
                    }
                };
                img.src = dataUrl;
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePDFUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedPDFName(file.name);
            setPdfFile(file);
        }
    };

    const handleSubmit = async () => {
        if (mode === 'image') {
            if (!selectedImage) return;
            const finalW = useImageDimensions ? selectedImage.width : width;
            const finalH = useImageDimensions ? selectedImage.height : height;
            addPage('image', selectedImage.url, finalW, finalH);
        } else if (mode === 'append') {
            if (!pdfFile) return;
            try {
                const arrayBuffer = await pdfFile.arrayBuffer();
                const pdfDoc = await PDFDocument.load(arrayBuffer);
                appendPDF(pdfDoc, arrayBuffer, pdfDoc.getPageCount());
            } catch (error) {
                console.error('Failed to append PDF', error);
                alert('Error appending PDF');
            }
        } else {
            addPage('blank', undefined, width, height, backgroundColor);
        }
        onClose();
    };

    return createPortal(
        <div className={clsx("fixed inset-0 z-[1000] flex items-center justify-center p-4", theme === 'dark' ? 'dark' : '')}>
            <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />

            <div className="bg-white dark:bg-zinc-900 rounded-[32px] shadow-2xl w-full max-w-[500px] overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-500 flex flex-col max-h-[90vh] border border-gray-100 dark:border-white/10 relative z-10">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-800/30">
                    <div className="flex items-center gap-3">
                        <div className={clsx(
                            "p-2.5 rounded-2xl shadow-sm border",
                            mode === 'image' ? "bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-400" :
                                mode === 'append' ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                                    "bg-purple-50 dark:bg-purple-500/10 border-purple-100 dark:border-purple-500/20 text-purple-600 dark:text-purple-400"
                        )}>
                            {mode === 'image' ? <ImageIcon size={20} /> :
                                mode === 'append' ? <FileText size={20} /> :
                                    <FilePlus size={20} />}
                        </div>
                        <div>
                            <h2 className="text-sm font-black uppercase tracking-[0.15em] text-gray-900 dark:text-zinc-100 leading-none">
                                {mode === 'append' ? 'Append PDF' : 'Add New Page'}
                            </h2>
                            <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1 uppercase font-bold tracking-widest">Configure your layout</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-zinc-100 transition-all p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 space-y-8 overflow-y-auto scrollbar-thin">

                    {/* Mode Selection */}
                    <div className="grid grid-cols-3 gap-2 p-1.5 bg-gray-100/80 dark:bg-zinc-800/50 rounded-2xl border border-gray-200/50 dark:border-white/5 shadow-inner">
                        <button
                            onClick={() => setMode('blank')}
                            className={clsx(
                                "flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300",
                                mode === 'blank' ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-md ring-1 ring-black/5 dark:ring-white/10' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-300'
                            )}
                        >
                            <FilePlus size={18} /> Blank
                        </button>
                        <button
                            onClick={() => setMode('image')}
                            className={clsx(
                                "flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300",
                                mode === 'image' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-md ring-1 ring-black/5 dark:ring-white/10' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-300'
                            )}
                        >
                            <ImageIcon size={18} /> Image
                        </button>
                        <button
                            onClick={() => setMode('append')}
                            className={clsx(
                                "flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300",
                                mode === 'append' ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-md ring-1 ring-black/5 dark:ring-white/10' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-300'
                            )}
                        >
                            <FileText size={18} /> PDF
                        </button>
                    </div>

                    {/* Image Input Section */}
                    {mode === 'image' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Source Image</label>
                            {!selectedImage ? (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full h-40 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-3xl flex flex-col items-center justify-center hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-all text-gray-400 hover:text-blue-600 group active:scale-[0.98]"
                                >
                                    <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl group-hover:scale-110 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/10 transition-all">
                                        <ImageIcon size={32} className="opacity-50" />
                                    </div>
                                    <span className="text-xs font-bold mt-4">Drop or click to upload</span>
                                </button>
                            ) : (
                                <div className="relative group rounded-3xl overflow-hidden border border-gray-200 dark:border-white/10 h-40 bg-gray-50 dark:bg-white/5 flex items-center justify-center p-2 shadow-inner">
                                    <img src={selectedImage.url} alt="Preview" className="max-h-full max-w-full object-contain rounded-xl" />
                                    <button
                                        onClick={() => { setSelectedImage(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                        className="absolute inset-0 bg-zinc-900/80 text-white opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all backdrop-blur-sm"
                                    >
                                        <ImageIcon size={24} className="mb-2" />
                                        <span className="text-xs font-black uppercase tracking-widest">Change Image</span>
                                    </button>
                                </div>
                            )}
                            <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} />
                            {selectedImage && (
                                <div className="flex items-center gap-3 mt-2 p-3 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                                    <input
                                        type="checkbox"
                                        id="useOriginal"
                                        checked={useImageDimensions}
                                        onChange={(e) => {
                                            setUseImageDimensions(e.target.checked);
                                            if (e.target.checked && selectedImage) {
                                                setWidth(selectedImage.width);
                                                setHeight(selectedImage.height);
                                            }
                                        }}
                                        className="w-4 h-4 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500 bg-white dark:bg-zinc-800"
                                    />
                                    <label htmlFor="useOriginal" className="text-xs font-bold text-gray-600 dark:text-zinc-400">Match image original dimensions</label>
                                </div>
                            )}
                        </div>
                    )}

                    {/* PDF Input Section */}
                    {mode === 'append' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Source PDF</label>
                            <button
                                onClick={() => pdfInputRef.current?.click()}
                                className="w-full h-40 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-3xl flex flex-col items-center justify-center hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50/50 dark:hover:bg-emerald-500/5 transition-all text-gray-400 hover:text-emerald-600 group active:scale-[0.98]"
                            >
                                <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl group-hover:scale-110 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/10 transition-all">
                                    <FileText size={32} className="opacity-50" />
                                </div>
                                <span className="text-xs font-bold mt-4 truncate max-w-[80%]">{selectedPDFName || 'Select PDF file to append'}</span>
                            </button>
                            <input type="file" ref={pdfInputRef} accept=".pdf" className="hidden" onChange={handlePDFUpload} />
                        </div>
                    )}

                    {/* Dimensions Section */}
                    {mode !== 'append' && (
                        <div className={clsx("space-y-4 transition-all duration-500", mode === 'image' && useImageDimensions ? 'opacity-30 blur-[1px] pointer-events-none' : 'opacity-100')}>
                            <div className="flex items-center gap-2 mb-2">
                                <Settings2 size={16} className="text-gray-400" />
                                <span className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Dimensions (PX)</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Width</label>
                                    <input
                                        type="number"
                                        value={width}
                                        onChange={(e) => setWidth(Number(e.target.value))}
                                        className="w-full h-12 px-4 bg-gray-100/50 dark:bg-zinc-800/80 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 rounded-xl text-sm font-bold text-gray-900 dark:text-zinc-100 outline-none transition-all shadow-inner"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Height</label>
                                    <input
                                        type="number"
                                        value={height}
                                        onChange={(e) => setHeight(Number(e.target.value))}
                                        className="w-full h-12 px-4 bg-gray-100/50 dark:bg-zinc-800/80 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 rounded-xl text-sm font-bold text-gray-900 dark:text-zinc-100 outline-none transition-all shadow-inner"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 p-1 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-200/50 dark:border-white/5">
                                {[
                                    { label: 'A4', w: 595, h: 842 },
                                    { label: 'Letter', w: 612, h: 792 },
                                    { label: '1080p', w: 1920, h: 1080 }
                                ].map(p => (
                                    <button
                                        key={p.label}
                                        onClick={() => { setWidth(p.w); setHeight(p.h); }}
                                        className="flex-1 py-1.5 text-[9px] font-black uppercase tracking-tighter text-gray-500 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-all active:scale-95"
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Background Color Section - Only for Blank Pages */}
                    {mode === 'blank' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-2 mb-2">
                                <Palette size={16} className="text-gray-400" />
                                <span className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Background Color</span>
                            </div>

                            {/* Color Preview */}
                            <div className="flex items-center gap-4">
                                <div
                                    className="w-16 h-16 rounded-2xl border-2 border-gray-200 dark:border-white/10 shadow-inner"
                                    style={{ backgroundColor: backgroundColor }}
                                />
                                <div className="flex-1 space-y-2">
                                    <input
                                        type="text"
                                        value={backgroundColor}
                                        onChange={(e) => setBackgroundColor(e.target.value)}
                                        placeholder="#ffffff"
                                        className="w-full h-10 px-3 bg-gray-100/50 dark:bg-zinc-800/80 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 rounded-xl text-sm font-mono text-gray-900 dark:text-zinc-100 outline-none transition-all shadow-inner"
                                    />
                                    <input
                                        type="color"
                                        value={backgroundColor}
                                        onChange={(e) => setBackgroundColor(e.target.value)}
                                        className="w-full h-8 rounded-lg cursor-pointer bg-transparent"
                                    />
                                </div>
                            </div>

                            {/* Preset Colors */}
                            <div className="flex gap-2 flex-wrap">
                                {[
                                    { color: '#ffffff', label: 'White' },
                                    { color: '#f3f4f6', label: 'Light Gray' },
                                    { color: '#1f2937', label: 'Dark' },
                                    { color: '#18181b', label: 'Zinc' },
                                    { color: '#fef3c7', label: 'Cream' },
                                    { color: '#dbeafe', label: 'Light Blue' },
                                    { color: '#dcfce7', label: 'Light Green' },
                                    { color: '#fce7f3', label: 'Light Pink' },
                                ].map(preset => (
                                    <button
                                        key={preset.color}
                                        onClick={() => setBackgroundColor(preset.color)}
                                        title={preset.label}
                                        className={clsx(
                                            "w-8 h-8 rounded-xl border-2 transition-all hover:scale-110 active:scale-95",
                                            backgroundColor === preset.color
                                                ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-zinc-900 border-blue-500"
                                                : "border-gray-200 dark:border-white/10 hover:border-gray-400"
                                        )}
                                        style={{ backgroundColor: preset.color }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 dark:border-white/5 bg-gray-50/80 dark:bg-zinc-800/50 flex justify-end gap-3 backdrop-blur-md">
                    <button onClick={onClose} className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-900 dark:text-zinc-500 dark:hover:text-zinc-100 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={(mode === 'image' && !selectedImage) || (mode === 'append' && !pdfFile)}
                        className={clsx(
                            "px-8 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                            mode === 'image' ? "bg-blue-600 text-white shadow-blue-500/20 hover:bg-blue-700" :
                                mode === 'append' ? "bg-emerald-600 text-white shadow-emerald-500/20 hover:bg-emerald-700" :
                                    "bg-zinc-900 dark:bg-blue-600 text-white hover:bg-black dark:hover:bg-blue-700"
                        )}
                    >
                        {mode === 'append' ? 'Append PDF' : 'Create Page'}
                    </button>
                </div>

            </div>
        </div>,
        document.body
    );
};
