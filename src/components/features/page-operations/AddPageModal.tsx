import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePDFStore } from '../../../store/pdfStore';
import { Image as ImageIcon, FilePlus, X, Settings2, FileText } from 'lucide-react'; // Added FileText
import { PDFDocument } from 'pdf-lib';

interface AddPageModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type PageMode = 'image' | 'blank' | 'append';

export const AddPageModal: React.FC<AddPageModalProps> = ({ isOpen, onClose }) => {
    const { addPage, appendPDF } = usePDFStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null); // Ref for PDF input

    // State
    const [mode, setMode] = useState<PageMode>('blank');
    const [width, setWidth] = useState<number>(595);
    const [height, setHeight] = useState<number>(842);
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
            addPage('blank', undefined, width, height);
        }
        onClose();
    };

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-[500px] overflow-hidden animate-fadeIn flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        {mode === 'image' ? <ImageIcon size={20} className="text-blue-500" /> :
                            mode === 'append' ? <FileText size={20} className="text-red-500" /> :
                                <FilePlus size={20} className="text-purple-500" />}
                        {mode === 'append' ? 'Append PDF' : 'Add New Page'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-200">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 overflow-y-auto">

                    {/* Mode Selection */}
                    <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 rounded-lg">
                        <button
                            onClick={() => setMode('blank')}
                            className={`flex items-center justify-center gap-2 py-2 px-2 rounded-md text-xs font-medium transition-all ${mode === 'blank' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <FilePlus size={16} /> Blank
                        </button>
                        <button
                            onClick={() => setMode('image')}
                            className={`flex items-center justify-center gap-2 py-2 px-2 rounded-md text-xs font-medium transition-all ${mode === 'image' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <ImageIcon size={16} /> Image
                        </button>
                        <button
                            onClick={() => setMode('append')}
                            className={`flex items-center justify-center gap-2 py-2 px-2 rounded-md text-xs font-medium transition-all ${mode === 'append' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <FileText size={16} /> PDF
                        </button>
                    </div>

                    {/* Image Input Section */}
                    {mode === 'image' && (
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-gray-700">Source Image</label>
                            {!selectedImage ? (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center hover:border-blue-500 hover:bg-blue-50 transition-all text-gray-500 hover:text-blue-600"
                                >
                                    <ImageIcon size={32} className="mb-2 opacity-50" />
                                    <span className="text-sm">Click to upload image</span>
                                </button>
                            ) : (
                                <div className="relative group rounded-lg overflow-hidden border border-gray-200 h-32 bg-gray-50 flex items-center justify-center">
                                    <img src={selectedImage.url} alt="Preview" className="max-h-full max-w-full object-contain" />
                                    <button
                                        onClick={() => { setSelectedImage(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                        className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                    >
                                        Change Image
                                    </button>
                                </div>
                            )}
                            <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} />
                            {selectedImage && (
                                <div className="flex items-center gap-2 mt-2">
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
                                        className="rounded text-blue-600 focus:ring-blue-500"
                                    />
                                    <label htmlFor="useOriginal" className="text-sm text-gray-600">Use original image dimensions</label>
                                </div>
                            )}
                        </div>
                    )}

                    {/* PDF Input Section */}
                    {mode === 'append' && (
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-gray-700">Source PDF</label>
                            <button
                                onClick={() => pdfInputRef.current?.click()}
                                className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center hover:border-red-500 hover:bg-red-50 transition-all text-gray-500 hover:text-red-600"
                            >
                                <FileText size={32} className="mb-2 opacity-50" />
                                <span className="text-sm">{selectedPDFName || 'Click to select PDF'}</span>
                            </button>
                            <input type="file" ref={pdfInputRef} accept=".pdf" className="hidden" onChange={handlePDFUpload} />
                        </div>
                    )}

                    {/* Dimensions Section (Hidden for Append) */}
                    {mode !== 'append' && (
                        <div className={mode === 'image' && useImageDimensions ? 'opacity-50 pointer-events-none' : ''}>
                            <div className="flex items-center gap-2 mb-2 text-gray-700">
                                <Settings2 size={16} />
                                <span className="text-sm font-bold">Page Dimensions (px)</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Width</label>
                                    <input
                                        type="number"
                                        value={width}
                                        onChange={(e) => setWidth(Number(e.target.value))}
                                        className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Height</label>
                                    <input
                                        type="number"
                                        value={height}
                                        onChange={(e) => setHeight(Number(e.target.value))}
                                        className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 mt-2">
                                <button onClick={() => { setWidth(595); setHeight(842); }} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">A4</button>
                                <button onClick={() => { setWidth(612); setHeight(792); }} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">Letter</button>
                                <button onClick={() => { setWidth(1920); setHeight(1080); }} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">1080p</button>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={(mode === 'image' && !selectedImage) || (mode === 'append' && !pdfFile)}
                        className="px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg transform active:scale-95"
                    >
                        {mode === 'append' ? 'Append PDF' : 'Create Page'}
                    </button>
                </div>

            </div>
        </div>,
        document.body
    );
};
