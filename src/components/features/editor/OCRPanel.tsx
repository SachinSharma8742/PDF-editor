import React, { useState } from 'react';
import { createWorker } from 'tesseract.js';
import { useEditorStore } from '../../../store/editorStore';
import { usePDFStore } from '../../../store/pdfStore';
import { Loader2, ScanText, Copy, Check, FileText, EyeOff, Type } from 'lucide-react';
import { Button } from '../../ui/Button';

export const OCRPanel: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<string>('');
    const [resultData, setResultData] = useState<any>(null); // Store full Tesseract data
    const [copied, setCopied] = useState(false);

    const { currentPage, addObject, updateObject } = useEditorStore();
    const { pdfDocument } = usePDFStore();

    const handleOCR = async () => {
        if (!pdfDocument || !currentPage) return;

        setLoading(true);
        setProgress(0);
        setStatus('Initializing...');
        setResultData(null);

        try {
            // 1. Get current page as image
            // We use a higher scale for better OCR accuracy
            const OC_SCALE = 2.0;
            const page = await pdfDocument.getPage(currentPage.originalPageIndex);
            const viewport = page.getViewport({ scale: OC_SCALE });
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
                        setStatus(`Recognizing text... ${Math.round(m.progress * 100)}%`);
                    } else {
                        setStatus(m.status);
                    }
                }
            });

            const { data } = await worker.recognize(imageData);

            // Store the raw data (words, lines, etc.)
            // We need to attach the scale factor so we can convert back later
            setResultData({ ...data, scaleFactor: OC_SCALE });

            await worker.terminate();

        } catch (err) {
            console.error('OCR Error:', err);
            setStatus('Error occurred during OCR');
        } finally {
            setLoading(false);
        }
    };

    const handleInsertInvisibleLayer = () => {
        if (!resultData || !currentPage) return;

        // Iterate words and place them exact
        // Tesseract coords are { x0, y0, x1, y1 } relative to the IMAGE provided.
        // We scaled image by scaleFactor.
        const scale = 1 / resultData.scaleFactor;

        resultData.words.forEach((word: any) => {
            if (!word.text || word.text.trim().length === 0) return;

            const { bbox } = word;
            // bbox: x0, y0, x1, y1

            const width = (bbox.x1 - bbox.x0) * scale;
            const height = (bbox.y1 - bbox.y0) * scale;
            const x = bbox.x0 * scale;
            const y = bbox.y0 * scale;

            addObject({
                id: crypto.randomUUID(),
                type: 'text',
                x: x,
                y: y,
                width: width,
                height: height,
                text: word.text,
                fontSize: height * 0.75, // Approximate font size
                opacity: 0, // Invisible!
                rotation: 0,
                fill: '#000000',
                isLocked: false // Allow selection
            });
        });
    };

    const handleInsertEditableText = () => {
        if (!resultData || !currentPage) return;

        const scale = 1 / resultData.scaleFactor;

        // Strategy: Group by lines or paragraphs? 
        // For now, let's inject "Lines" to keep it editable but structured.
        // Tesseract provides 'lines'.

        resultData.lines.forEach((line: any) => {
            if (!line.text || line.text.trim().length === 0) return;

            const { bbox } = line;
            const width = (bbox.x1 - bbox.x0) * scale;
            const height = (bbox.y1 - bbox.y0) * scale;
            const x = bbox.x0 * scale;
            const y = bbox.y0 * scale;

            addObject({
                id: crypto.randomUUID(),
                type: 'text',
                x: x,
                y: y,
                width: width,
                height: height,
                text: line.text.trim(),
                fontSize: height * 0.8, // Slightly larger for readability
                fontFamily: 'Inter',
                opacity: 1,
                rotation: 0,
                fill: '#000000'
            });
        });
    };

    const copyToClipboard = () => {
        if (!resultData?.text) return;
        navigator.clipboard.writeText(resultData.text);
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
                Extract text from scanned PDF pages to make them searchable or editable.
            </p>

            <Button
                onClick={handleOCR}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 border-b-4 border-blue-800 active:border-b-0 active:translate-y-1"
            >
                {loading ? (
                    <>
                        <Loader2 className="animate-spin" size={18} />
                        <span>{status || `Scanning... ${progress}%`}</span>
                    </>
                ) : (
                    <>
                        <ScanText size={18} />
                        <span>Scan Page for Text</span>
                    </>
                )}
            </Button>

            {resultData && (
                <div className="mt-6 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                            Found {resultData.words.length} words
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={copyToClipboard}
                                className="p-1.5 hover:bg-white/5 rounded-md text-zinc-400 hover:text-white transition-colors"
                                title="Copy raw text"
                            >
                                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                        <Button
                            onClick={handleInsertInvisibleLayer}
                            variant="secondary"
                            className="w-full justify-start text-xs h-auto py-2"
                        >
                            <EyeOff size={14} className="mr-2 text-zinc-400" />
                            <div className="text-left">
                                <div className="font-semibold text-zinc-200">Invisible Text Layer</div>
                                <div className="text-[10px] text-zinc-500">Make scanned text selectable</div>
                            </div>
                        </Button>

                        <Button
                            onClick={handleInsertEditableText}
                            variant="secondary"
                            className="w-full justify-start text-xs h-auto py-2"
                        >
                            <Type size={14} className="mr-2 text-zinc-400" />
                            <div className="text-left">
                                <div className="font-semibold text-zinc-200">Convert to Editable Text</div>
                                <div className="text-[10px] text-zinc-500">Reconstruct layout with text objects</div>
                            </div>
                        </Button>
                    </div>

                    <div className="text-[10px] text-zinc-600 border-t border-white/5 pt-2 mt-2">
                        Preview:
                    </div>
                    <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-3 max-h-[200px] overflow-y-auto custom-scrollbar text-xs text-zinc-400 font-mono leading-relaxed whitespace-pre-wrap select-text">
                        {resultData.text}
                    </div>
                </div>
            )}
        </div>
    );
};
