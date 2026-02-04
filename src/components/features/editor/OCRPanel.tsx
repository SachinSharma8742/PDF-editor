import React, { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import { useEditorStore } from '../../../store/editorStore';
import { usePDFStore } from '../../../store/pdfStore';
import { Loader2, ScanText, Copy, Check, FileText } from 'lucide-react';
import { Button } from '../../ui/Button';

export const OCRPanel: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const { currentPage, addObject } = useEditorStore();
    const { pdfDocument } = usePDFStore();

    const handleOCR = async () => {
        if (!pdfDocument || !currentPage) return;

        setLoading(true);
        setProgress(0);

        try {
            // 1. Get current page as image
            const page = await pdfDocument.getPage(currentPage.originalPageIndex);
            const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: context!,
                viewport: viewport
            }).promise;

            const imageData = canvas.toDataURL('image/png');

            // 2. Run Tesseract
            const worker = await createWorker('eng', 1, {
                logger: (m: any) => {
                    if (m.status === 'recognizing text') {
                        setProgress(Math.round(m.progress * 100));
                    }
                }
            });

            const { data: { text } } = await worker.recognize(imageData);
            await worker.terminate();

            setResult(text);
        } catch (err) {
            console.error('OCR Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleInsertAsText = () => {
        if (!result) return;
        addObject({
            id: crypto.randomUUID(),
            type: 'text',
            x: 50,
            y: 50,
            text: result,
            fontSize: 14,
            width: 400,
            height: 300,
            rotation: 0
        });
    };

    const copyToClipboard = () => {
        if (!result) return;
        navigator.clipboard.writeText(result);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <ScanText size={20} className="text-blue-500" />
                <h3 className="font-bold text-sm uppercase tracking-wider text-zinc-400">OCR Text Recognition</h3>
            </div>

            <p className="text-xs text-zinc-500 leading-relaxed">
                Extract text from scanned PDF pages or images using AI-powered OCR.
            </p>

            <Button
                onClick={handleOCR}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 border-b-4 border-blue-800 active:border-b-0 active:translate-y-1"
            >
                {loading ? (
                    <>
                        <Loader2 className="animate-spin" size={18} />
                        <span>Recognizing ({progress}%)</span>
                    </>
                ) : (
                    <>
                        <ScanText size={18} />
                        <span>Extract Text from Page</span>
                    </>
                )}
            </Button>

            {result && (
                <div className="mt-6 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Extracted Content</span>
                        <div className="flex gap-2">
                            <button
                                onClick={copyToClipboard}
                                className="p-1.5 hover:bg-white/5 rounded-md text-zinc-400 hover:text-white transition-colors"
                                title="Copy to clipboard"
                            >
                                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>

                    <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-3 max-h-[300px] overflow-y-auto custom-scrollbar text-xs text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap">
                        {result}
                    </div>

                    <Button
                        onClick={handleInsertAsText}
                        variant="secondary"
                        className="w-full"
                    >
                        <FileText size={16} />
                        <span>Insert as Text Object</span>
                    </Button>
                </div>
            )}
        </div>
    );
};
