import React, { useRef, useCallback } from 'react';
import { useEditorStore } from '../../../../store/editorStore';
import { ScanLine, Copy, Trash2, X, Loader2, Check } from 'lucide-react';
import clsx from 'clsx';
import type { SinglePageCanvasHandle } from './SinglePageCanvas';

interface OCRPanelProps {
    canvasRef?: React.RefObject<SinglePageCanvasHandle | null>;
}

export const OCRPanel: React.FC<OCRPanelProps> = ({ canvasRef }) => {
    const {
        ocrState,
        startOCR,
        clearOCRResult,
        setOCROpen
    } = useEditorStore();

    const { isOpen, isProcessing, progress, result, error } = ocrState;
    const [copied, setCopied] = React.useState(false);

    const handleScan = useCallback(async () => {
        const canvas = canvasRef?.current?.getCanvas();
        if (!canvas) {
            console.error('No canvas reference available');
            return;
        }
        // Convert canvas to data URL for Tesseract
        const dataUrl = canvas.toDataURL('image/png');
        await startOCR(dataUrl);
    }, [canvasRef, startOCR]);

    const handleCopy = useCallback(() => {
        if (result) {
            navigator.clipboard.writeText(result);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [result]);

    if (!isOpen) return null;

    return (
        <div className="bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-white/10 p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <ScanLine size={12} className="text-emerald-400" />
                    OCR Scanner
                </h3>
                <button
                    onClick={() => setOCROpen(false)}
                    className="p-1 text-zinc-400 hover:text-white rounded hover:bg-white/10 transition-colors"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Scan Button */}
            <button
                onClick={handleScan}
                disabled={isProcessing}
                className={clsx(
                    "w-full py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                    isProcessing
                        ? "bg-zinc-700 text-zinc-400 cursor-wait"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white"
                )}
            >
                {isProcessing ? (
                    <>
                        <Loader2 size={16} className="animate-spin" />
                        Scanning... {progress}%
                    </>
                ) : (
                    <>
                        <ScanLine size={16} />
                        Scan Page for Text
                    </>
                )}
            </button>

            {/* Progress Bar */}
            {isProcessing && (
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-xs">
                    {error}
                </div>
            )}

            {/* Results */}
            {result && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Recognized Text</span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleCopy}
                                className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-white/10 transition-colors flex items-center gap-1"
                                title="Copy to clipboard"
                            >
                                {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            </button>
                            <button
                                onClick={clearOCRResult}
                                className="p-1.5 text-zinc-400 hover:text-red-400 rounded hover:bg-white/10 transition-colors"
                                title="Clear result"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto p-3 bg-zinc-800 rounded-lg border border-white/5">
                        <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
                            {result || 'No text found'}
                        </p>
                    </div>
                    <p className="text-[10px] text-zinc-500 text-center">
                        {result.split(/\s+/).filter(Boolean).length} words detected
                    </p>
                </div>
            )}

            {/* Help text */}
            {!result && !isProcessing && (
                <p className="text-[10px] text-zinc-500 text-center">
                    Click "Scan Page" to recognize text from images or scanned content
                </p>
            )}
        </div>
    );
};
