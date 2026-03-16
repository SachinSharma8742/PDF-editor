/**
 * Smart Per-Page Text Extraction
 *
 * For each page:
 *   1. Try PDF.js native getTextContent() — instant for text-based pages
 *   2. If empty, fall back to Tesseract OCR — handles scanned/image pages
 *
 * This makes hybrid PDFs efficient: only scanned pages pay the OCR cost.
 */

import type { PDFDocumentProxy, PDFPageProxy } from '../store/pdfStore';

// Extended page type that includes getTextContent (available in the real pdfjs runtime)
interface PDFPageWithText extends PDFPageProxy {
    getTextContent: () => Promise<{ items: { str?: string }[] }>;
}
import type { PageState } from '../store/pdfStore';

export interface PageTextResult {
    pageNumber: number;
    text: string;
    method: 'native' | 'ocr' | 'editor-objects' | 'empty';
}

export interface ExtractionProgress {
    current: number;
    total: number;
    pageNumber: number;
    method: 'native' | 'ocr';
}

/**
 * Extracts text from all pages smartly.
 * Reports progress via onProgress so the UI can show what's happening.
 */
export async function extractDocumentText(
    pdfDocument: PDFDocumentProxy | null,
    pages: PageState[],
    onProgress?: (p: ExtractionProgress) => void
): Promise<string> {
    const results: PageTextResult[] = [];
    const total = pages.length;

    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const pageIndex = page.originalPageIndex ?? page.pageNumber;

        // --- Step 1: Try editor objects first (user-placed text) ---
        const editorText = (page.objects || [])
            .filter(o => o.type === 'text' && o.text && o.opacity !== 0)
            .map(o => o.text!)
            .join(' ')
            .trim();

        // --- Step 2: Try native PDF text extraction ---
        if (pdfDocument && page.source === 'pdf' && pageIndex >= 1 && pageIndex <= pdfDocument.numPages) {
            try {
                const pdfPage = await pdfDocument.getPage(pageIndex) as PDFPageWithText;
                const content = await pdfPage.getTextContent();
                const nativeText = content.items
                    .map((item) => item.str ?? '')
                    .join(' ')
                    .trim();

                if (nativeText.length > 20) {
                    // Has real text — use it, skip OCR
                    onProgress?.({ current: i + 1, total, pageNumber: page.pageNumber, method: 'native' });
                    results.push({ pageNumber: page.pageNumber, text: nativeText, method: 'native' });
                    continue;
                }
            } catch {
                // getTextContent failed — fall through to OCR
            }

            // --- Step 3: Fall back to Tesseract OCR (scanned page) ---
            try {
                onProgress?.({ current: i + 1, total, pageNumber: page.pageNumber, method: 'ocr' });
                const ocrText = await runOCROnPage(pdfDocument, pageIndex);
                if (ocrText.length > 0) {
                    results.push({ pageNumber: page.pageNumber, text: ocrText, method: 'ocr' });
                    continue;
                }
            } catch {
                // OCR failed — fall through
            }
        }

        // --- Step 4: Use editor objects as last resort ---
        if (editorText.length > 0) {
            results.push({ pageNumber: page.pageNumber, text: editorText, method: 'editor-objects' });
        } else {
            results.push({ pageNumber: page.pageNumber, text: '', method: 'empty' });
        }
    }

    return results
        .filter(r => r.text.length > 0)
        .map(r => r.text)
        .join('\n\n');
}

/** Renders a PDF page to canvas and runs Tesseract OCR on it */
async function runOCROnPage(pdfDocument: PDFDocumentProxy, pageIndex: number): Promise<string> {
    const { createWorker } = await import('tesseract.js');

    const OCR_SCALE = 1.5;
    const pdfPage = await pdfDocument.getPage(pageIndex);
    const viewport = pdfPage.getViewport({ scale: OCR_SCALE });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await pdfPage.render({ canvasContext: ctx, viewport }).promise;
    const imageData = canvas.toDataURL('image/jpeg', 0.85);

    const worker = await createWorker('eng', 1);
    const { data } = await worker.recognize(imageData);
    await worker.terminate();

    return data.text.trim();
}
