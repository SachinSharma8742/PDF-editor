import React, { useState } from 'react';
import { X, Image as ImageIcon, Layers, Download, Lock } from 'lucide-react';
import { Button } from '../ui/Button';
import { useEditorStore } from '../../store/editorStore';
import { usePDFStore } from '../../store/pdfStore';
import { saveDocument, saveDocumentFlattened, exportPageAsImage } from '../../utils/exportUtils';
import { CompressionOverlay } from '../features/export/CompressionOverlay';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
    const [format, setFormat] = useState<'pdf-standard' | 'pdf-flattened' | 'png'>('pdf-standard');
    const [quality, setQuality] = useState<number>(0.8); // 0 to 1
    const [isExporting, setIsExporting] = useState(false);
    const [isCompressionOpen, setIsCompressionOpen] = useState(false);

    // Future: Password state
    // const [password, setPassword] = useState('');

    const { pages, pdfDocument, originalPdfBytes } = usePDFStore();
    const { currentPage } = useEditorStore();

    if (!isOpen) return null;

    const handleExport = async () => {
        setIsExporting(true);

        try {
            if (format === 'pdf-standard') {
                await saveDocument(pages, originalPdfBytes);

            } else if (format === 'pdf-flattened') {
                await saveDocumentFlattened(pages, pdfDocument, quality);
            } else if (format === 'png') {
                // Export current page only? Or all?
                // Let's do current page for now as 'Image Export' usually implies single view
                const activePage = currentPage;
                if (activePage) {
                    await exportPageAsImage(activePage, 'png', quality, pdfDocument);
                }
            }
        } catch (error) {
            console.error("Export failed", error);
            alert("Export failed. See console.");
        } finally {
            setIsExporting(false);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e1e20] w-[400px] rounded-xl shadow-2xl border border-white/10 overflow-hidden text-zinc-200 font-sans">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#27272a]">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-zinc-300">Export Document</h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-md transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-6">

                    {/* Format Selection */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Format</label>
                        <div className="grid grid-cols-1 gap-2">
                            <button
                                onClick={() => setFormat('pdf-standard')}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${format === 'pdf-standard'
                                        ? 'bg-blue-600/10 border-blue-500/50 text-blue-400'
                                        : 'bg-zinc-800 border-white/5 hover:bg-zinc-700 text-zinc-400'
                                    }`}
                            >
                                <Layers size={18} />
                                <div className="text-left">
                                    <div className="text-sm font-semibold">Standard PDF</div>
                                    <div className="text-[10px] opacity-70">Layers preserved, editable</div>
                                </div>
                            </button>

                            <button
                                onClick={() => setFormat('pdf-flattened')}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${format === 'pdf-flattened'
                                        ? 'bg-blue-600/10 border-blue-500/50 text-blue-400'
                                        : 'bg-zinc-800 border-white/5 hover:bg-zinc-700 text-zinc-400'
                                    }`}
                            >
                                <Lock size={18} />
                                <div className="text-left">
                                    <div className="text-sm font-semibold">Flattened PDF</div>
                                    <div className="text-[10px] opacity-70">Single layer, read-only</div>
                                </div>
                            </button>

                            <button
                                onClick={() => setFormat('png')}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${format === 'png'
                                        ? 'bg-blue-600/10 border-blue-500/50 text-blue-400'
                                        : 'bg-zinc-800 border-white/5 hover:bg-zinc-700 text-zinc-400'
                                    }`}
                            >
                                <ImageIcon size={18} />
                                <div className="text-left">
                                    <div className="text-sm font-semibold">Image (PNG)</div>
                                    <div className="text-[10px] opacity-70">Current page as high-res image</div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Quality Slider (Only for flattened/image) */}
                    {(format === 'pdf-flattened' || format === 'png') && (
                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                            <div className="flex justify-between">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Quality / Compression</label>
                                <span className="text-xs text-zinc-400">{Math.round(quality * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min="0.1"
                                max="1"
                                step="0.1"
                                value={quality}
                                onChange={(e) => setQuality(parseFloat(e.target.value))}
                                className="w-full accent-blue-500"
                            />
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 bg-[#18181b] flex justify-end gap-3">
                    <Button
                        variant="outline"
                        onClick={() => setIsCompressionOpen(true)}
                        disabled={isExporting}
                    >
                        Compress with PDF.co
                    </Button>
                    <Button variant="ghost" onClick={onClose} disabled={isExporting}>
                        Cancel
                    </Button>
                    <Button onClick={handleExport} disabled={isExporting} className="bg-blue-600 hover:bg-blue-500 w-32 justify-center">
                        {isExporting ? 'Exporting...' : (
                            <>
                                <Download size={16} className="mr-2" />
                                Export
                            </>
                        )}
                    </Button>
                </div>
            </div>

            <CompressionOverlay
                isOpen={isCompressionOpen}
                onClose={() => setIsCompressionOpen(false)}
                selectedPageIndices={pages.map((_, index) => index)}
            />
        </div>
    );
};
