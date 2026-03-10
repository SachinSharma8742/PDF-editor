import React, { useState, useCallback, useRef } from 'react';
import { X, Upload, Loader2, ArrowLeftRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { compareDocuments, getPageCount, disposeCompareWorker } from '../../../utils/documentCompare';
import type { ComparisonResult, ComparisonProgress } from '../../../utils/documentCompare';
import { usePDFStore } from '../../../store/pdfStore';

interface CompareModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CompareModal: React.FC<CompareModalProps> = ({ isOpen, onClose }) => {
    const theme = usePDFStore(s => s.theme);

    const [fileA, setFileA] = useState<File | null>(null);
    const [fileB, setFileB] = useState<File | null>(null);
    const [pageCountA, setPageCountA] = useState(0);
    const [pageCountB, setPageCountB] = useState(0);

    const [isComparing, setIsComparing] = useState(false);
    const [progress, setProgress] = useState<ComparisonProgress | null>(null);
    const [results, setResults] = useState<ComparisonResult[]>([]);
    const [currentPage, setCurrentPage] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const fileInputARef = useRef<HTMLInputElement>(null);
    const fileInputBRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = useCallback(async (
        file: File,
        side: 'A' | 'B'
    ) => {
        try {
            const count = await getPageCount(file);
            if (side === 'A') {
                setFileA(file);
                setPageCountA(count);
            } else {
                setFileB(file);
                setPageCountB(count);
            }
            setResults([]);
            setError(null);
        } catch {
            setError(`Failed to load ${side === 'A' ? 'Document A' : 'Document B'}`);
        }
    }, []);

    const handleCompare = useCallback(async () => {
        if (!fileA || !fileB) return;

        setIsComparing(true);
        setError(null);
        setResults([]);
        setCurrentPage(0);

        try {
            const compareResults = await compareDocuments(
                fileA,
                fileB,
                30,
                (p) => setProgress(p)
            );
            setResults(compareResults);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Comparison failed';
            setError(message);
        } finally {
            setIsComparing(false);
            setProgress(null);
        }
    }, [fileA, fileB]);

    const handleClose = useCallback(() => {
        disposeCompareWorker();
        setFileA(null);
        setFileB(null);
        setPageCountA(0);
        setPageCountB(0);
        setResults([]);
        setError(null);
        setProgress(null);
        onClose();
    }, [onClose]);

    if (!isOpen) return null;

    const isDark = theme === 'dark';
    const currentResult = results[currentPage];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`relative w-full max-w-6xl max-h-[90vh] mx-4 rounded-2xl overflow-hidden flex flex-col ${isDark ? 'bg-[#1e1e22] text-white' : 'bg-white text-gray-900'}`}>
                {/* Header */}
                <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                    <div className="flex items-center gap-3">
                        <ArrowLeftRight size={20} className="text-blue-400" />
                        <h2 className="text-lg font-bold">Compare Documents</h2>
                    </div>
                    <button
                        onClick={handleClose}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {results.length === 0 ? (
                        /* Upload Zone */
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Document A */}
                                <UploadZone
                                    label="Document A (Original)"
                                    file={fileA}
                                    pageCount={pageCountA}
                                    isDark={isDark}
                                    inputRef={fileInputARef}
                                    onSelect={(f) => handleFileSelect(f, 'A')}
                                />
                                {/* Document B */}
                                <UploadZone
                                    label="Document B (Modified)"
                                    file={fileB}
                                    pageCount={pageCountB}
                                    isDark={isDark}
                                    inputRef={fileInputBRef}
                                    onSelect={(f) => handleFileSelect(f, 'B')}
                                />
                            </div>

                            {/* Compare Button */}
                            <div className="flex justify-center">
                                <button
                                    onClick={handleCompare}
                                    disabled={!fileA || !fileB || isComparing}
                                    className={`px-8 py-3 rounded-xl font-semibold text-white transition-all ${!fileA || !fileB || isComparing
                                            ? 'bg-gray-500 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl'
                                        }`}
                                >
                                    {isComparing ? (
                                        <span className="flex items-center gap-2">
                                            <Loader2 size={18} className="animate-spin" />
                                            {progress
                                                ? `${progress.stage} (${progress.pageNumber}/${progress.totalPages})`
                                                : 'Comparing...'}
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            <ArrowLeftRight size={18} />
                                            Compare Documents
                                        </span>
                                    )}
                                </button>
                            </div>

                            {error && (
                                <div className="text-center text-red-400 text-sm font-medium">
                                    {error}
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Results View */
                        <div className="space-y-4">
                            {/* Page Navigation */}
                            <div className="flex items-center justify-between">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                                    disabled={currentPage === 0}
                                    className={`p-2 rounded-lg transition-colors ${currentPage === 0
                                            ? 'opacity-30 cursor-not-allowed'
                                            : isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                                        }`}
                                >
                                    <ChevronLeft size={20} />
                                </button>

                                <div className="text-center">
                                    <span className="font-semibold">
                                        Page {currentResult?.pageNumber || 1} of {results.length}
                                    </span>
                                    {currentResult && (
                                        <span className={`ml-3 text-sm ${currentResult.changePercent > 5 ? 'text-red-400' :
                                                currentResult.changePercent > 0 ? 'text-yellow-400' :
                                                    'text-green-400'
                                            }`}>
                                            {currentResult.changePercent}% changed
                                        </span>
                                    )}
                                </div>

                                <button
                                    onClick={() => setCurrentPage(p => Math.min(results.length - 1, p + 1))}
                                    disabled={currentPage === results.length - 1}
                                    className={`p-2 rounded-lg transition-colors ${currentPage === results.length - 1
                                            ? 'opacity-30 cursor-not-allowed'
                                            : isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                                        }`}
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>

                            {/* Side-by-Side View */}
                            {currentResult && (
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <p className={`text-xs font-semibold text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            Document A
                                        </p>
                                        <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                                            <img
                                                src={currentResult.pageA}
                                                alt={`Page ${currentResult.pageNumber} - A`}
                                                className="w-full object-contain max-h-[50vh]"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <p className={`text-xs font-semibold text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            Differences
                                        </p>
                                        <div className={`rounded-xl overflow-hidden border relative ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                                            <img
                                                src={currentResult.pageA}
                                                alt="Base"
                                                className="w-full object-contain max-h-[50vh]"
                                            />
                                            <img
                                                src={currentResult.diffOverlay}
                                                alt="Diff overlay"
                                                className="absolute inset-0 w-full h-full object-contain"
                                                style={{ mixBlendMode: 'normal' }}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <p className={`text-xs font-semibold text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            Document B
                                        </p>
                                        <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                                            <img
                                                src={currentResult.pageB}
                                                alt={`Page ${currentResult.pageNumber} - B`}
                                                className="w-full object-contain max-h-[50vh]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Back to upload */}
                            <div className="flex justify-center pt-4">
                                <button
                                    onClick={() => { setResults([]); setCurrentPage(0); }}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'
                                        }`}
                                >
                                    Compare Different Documents
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Sub-component ─────────────────────────────────────────────

interface UploadZoneProps {
    label: string;
    file: File | null;
    pageCount: number;
    isDark: boolean;
    inputRef: React.RefObject<HTMLInputElement | null>;
    onSelect: (file: File) => void;
}

const UploadZone: React.FC<UploadZoneProps> = ({
    label, file, pageCount, isDark, inputRef, onSelect
}) => {
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) onSelect(droppedFile);
    }, [onSelect]);

    return (
        <div
            className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${isDark
                    ? 'border-white/20 hover:border-blue-400/50 bg-white/5'
                    : 'border-gray-300 hover:border-blue-400 bg-gray-50'
                }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
        >
            <input
                ref={inputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onSelect(f);
                }}
            />

            {file ? (
                <div className="space-y-2">
                    <div className={`text-sm font-semibold ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                        {file.name}
                    </div>
                    <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {pageCount} page{pageCount !== 1 ? 's' : ''} • {(file.size / 1024).toFixed(0)} KB
                    </div>
                    <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Click to change
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    <Upload size={32} className={isDark ? 'text-gray-500 mx-auto' : 'text-gray-400 mx-auto'} />
                    <p className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {label}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Drop PDF or image here, or click to browse
                    </p>
                </div>
            )}
        </div>
    );
};
