import React, { useState } from 'react';
import { createWorker } from 'tesseract.js';
import { useEditorStore } from '../../../store/editorStore';
import { usePDFStore } from '../../../store/pdfStore';
import { Loader2, ScanText, Copy, Check, FileText, EyeOff, Type, Ruler, Library } from 'lucide-react';
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
        if (!pdfDocument || !currentPage) {
            setStatus('No PDF document or page available');
            return;
        }

        // Get the page index - use originalPageIndex if available, fallback to pageNumber
        const pageIndex = currentPage.originalPageIndex ?? currentPage.pageNumber;

        if (!pageIndex || pageIndex < 1) {
            setStatus('Cannot perform OCR on this page type');
            return;
        }

        // Check if page index is valid for the PDF
        if (pageIndex > pdfDocument.numPages) {
            setStatus(`Page ${pageIndex} is out of range (PDF has ${pdfDocument.numPages} pages)`);
            return;
        }

        setLoading(true);
        setProgress(0);
        setStatus('Initializing...');
        setResultData(null);

        try {
            // 1. Get current page as image
            // We use a higher scale for better OCR accuracy
            const OC_SCALE = 2.0;
            const page = await pdfDocument.getPage(pageIndex);
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
            setStatus('OCR Complete!');

        } catch (err) {
            console.error('OCR Error:', err);
            setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error occurred'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleInsertInvisibleLayer = () => {
        if (!resultData || !resultData.words || !currentPage) return;

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
        if (!resultData || !resultData.lines || !currentPage) return;

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

    const handleBatchOCR = async () => {
        if (!pdfDocument) return;

        setLoading(true);
        setStatus('Initializing Batch OCR...');
        setProgress(0);
        setResultData(null); // Clear single page result

        try {
            const { pages, updatePage } = usePDFStore.getState();
            const worker = await createWorker('eng', 1, {
                logger: (m: any) => {
                    if (m.status === 'recognizing text') {
                        // This is per-page progress, harder to track global percentage accurately without math
                        // Just show status
                    }
                }
            });

            let processedCount = 0;
            const totalPages = pages.filter(p => p.source === 'pdf').length;

            for (const page of pages) {
                // Skip non-PDF pages (blank, image-based)
                if (page.source !== 'pdf') continue;

                // Get valid page index - use originalPageIndex if available, fallback to pageNumber
                const pageIndex = page.originalPageIndex ?? page.pageNumber;
                if (!pageIndex || pageIndex < 1 || pageIndex > pdfDocument.numPages) continue;

                setStatus(`Processing Page ${page.pageNumber} / ${pages.length}...`);

                // 1. Render Page
                const OC_SCALE = 1.5; // Slightly lower scale for batch to save memory/time
                const pdfPage = await pdfDocument.getPage(pageIndex);
                const viewport = pdfPage.getViewport({ scale: OC_SCALE });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                await pdfPage.render({ canvasContext: context!, viewport }).promise;
                const imageData = canvas.toDataURL('image/jpeg', 0.8);

                // 2. Recognize
                const { data } = await worker.recognize(imageData);

                // 3. Auto-insert Invisible Layer (Batch Mode always does this?)
                // Let's create the objects directly
                const scale = 1 / OC_SCALE;
                const newObjects: any[] = [];

                (data as any).words.forEach((word: any) => {
                    if (!word.text || word.text.trim().length === 0) return;
                    const { bbox } = word;
                    newObjects.push({
                        id: crypto.randomUUID(),
                        type: 'text',
                        x: bbox.x0 * scale,
                        y: bbox.y0 * scale,
                        width: (bbox.x1 - bbox.x0) * scale,
                        height: (bbox.y1 - bbox.y0) * scale,
                        text: word.text,
                        fontSize: (bbox.y1 - bbox.y0) * scale * 0.75,
                        opacity: 0,
                        rotation: 0,
                        fill: '#000000',
                        isLocked: false
                    });
                });

                // Update the page with new objects
                // We must be careful not to overwrite existing objects, just append
                // But PDFStore updatePage merges updates. We need to get current objects?
                // pdfStore.pages has the current state.
                const currentObjects = page.objects || [];
                updatePage(page.id, { objects: [...currentObjects, ...newObjects] });

                processedCount++;
                setProgress(Math.round((processedCount / totalPages) * 100));
            }

            await worker.terminate();
            setStatus('Batch Processing Complete!');
            setTimeout(() => setStatus(''), 3000);

        } catch (err) {
            console.error('Batch OCR Error:', err);
            setStatus('Error during Batch Processing');
        } finally {
            setLoading(false);
        }
    };

    const handleSmartDetect = () => {
        if (!resultData || !resultData.lines || !currentPage) return;
        const scale = 1 / resultData.scaleFactor;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        // Find content bounds
        resultData.lines.forEach((line: any) => {
            const { bbox } = line;
            if (bbox.x0 < minX) minX = bbox.x0;
            if (bbox.y0 < minY) minY = bbox.y0;
            if (bbox.x1 > maxX) maxX = bbox.x1;
            if (bbox.y1 > maxY) maxY = bbox.y1;
        });

        if (minX !== Infinity) {
            // Add a visual rectangle to show detected area
            const rect = {
                id: crypto.randomUUID(),
                type: 'rectangle',
                x: minX * scale,
                y: minY * scale,
                width: (maxX - minX) * scale,
                height: (maxY - minY) * scale,
                stroke: '#ef4444',
                strokeWidth: 2,
                fill: 'rgba(239, 68, 68, 0.1)',
                rotation: 0
            };
            // @ts-ignore
            addObject(rect);
            setStatus('Content area detected');
        }
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

            <div className="flex gap-2">
                <Button
                    onClick={handleOCR}
                    disabled={loading}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
                >
                    {loading && status.includes('Scanning...') ? <Loader2 className="animate-spin" size={16} /> : <ScanText size={16} />}
                    <span className="text-xs">This Page</span>
                </Button>

                <Button
                    onClick={handleBatchOCR}
                    disabled={loading}
                    className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                    {loading && status.includes('Batch') ? <Loader2 className="animate-spin" size={16} /> : <Library size={16} />}
                    <span className="text-xs">All Pages</span>
                </Button>
            </div>

            {loading && (
                <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-zinc-300 mb-1">{status}</p>
                    <div className="w-full bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                </div>
            )}

            {resultData && !loading && (
                <div className="mt-6 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                            Found {resultData.words?.length ?? 0} words
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
                            onClick={handleSmartDetect}
                            variant="secondary"
                            className="w-full justify-start text-xs h-auto py-2"
                        >
                            <Ruler size={14} className="mr-2 text-zinc-400" />
                            <div className="text-left">
                                <div className="font-semibold text-zinc-200">Detect Content Bounds</div>
                                <div className="text-[10px] text-zinc-500">Highlight content area</div>
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
