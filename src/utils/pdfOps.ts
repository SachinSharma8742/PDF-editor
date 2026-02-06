import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

import type { PageState } from '../store/pdfStore';

export const extractPagesAsPNG = async (
    pdfDocument: any,
    pages: PageState[],
    selectedPageIds: string[],
    scale: number = 2
) => {
    if (!pdfDocument || selectedPageIds.length === 0) return;

    // Filter selected pages and sort by visual order (index in pages array)
    const pagesToExtract = pages
        .filter(p => selectedPageIds.includes(p.id))
        .sort((a, b) => pages.indexOf(a) - pages.indexOf(b));

    for (const pageState of pagesToExtract) {
        if (pageState.source === 'pdf' && pageState.originalPageIndex) {
            const page = await pdfDocument.getPage(pageState.originalPageIndex);
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const context = canvas.getContext('2d');

            if (!context) continue;

            await page.render({
                canvasContext: context,
                viewport: viewport,
            }).promise;

            // Convert to blob and download
            canvas.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `page-${pageState.pageNumber}.png`;
                a.click();
                URL.revokeObjectURL(url);
            });
        }
    }
};

export const loadPDF = async (arrayBuffer: ArrayBuffer) => {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    return loadingTask.promise;
};

export const extractPagesAsPDF = async (
    originalPdfBytes: ArrayBuffer,
    pages: PageState[],
    selectedPageIds: string[]
) => {
    if (!originalPdfBytes || selectedPageIds.length === 0) return;

    try {
        // Clone the buffer to prevent detachment issues if used elsewhere
        const pdfDoc = await PDFDocument.load(originalPdfBytes.slice(0));
        const newPdf = await PDFDocument.create();

        // Map selected IDs to their original PDF indices
        // We only support extracting original PDF pages for now (until flattening engine is built)
        // TODO: Use Flattening Engine here for non-pdf pages or edited pages
        const selectedPageStates = pages
            .filter(p => selectedPageIds.includes(p.id))
            .sort((a, b) => pages.indexOf(a) - pages.indexOf(b));

        // We accumulate indices. Note: this strategy only works for original PDF pages.
        // If user added blank/image pages, they will be skipped or need special handling (Flattening).
        // For 'Legacy' export behavior, we only copy PDF pages.
        const pageIndices = selectedPageStates
            .filter(p => p.source === 'pdf' && p.originalPageIndex !== undefined)
            .map(p => p.originalPageIndex! - 1); // pdf-lib is 0-indexed

        if (pageIndices.length > 0) {
            const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
            copiedPages.forEach(page => newPdf.addPage(page));
        }

        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `extracted_pages.pdf`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error extracting PDF:', error);
        alert('Failed to extract PDF pages.');
    }
};

import type { NativeTextItem } from '../store/editorStore';
import { rgb, StandardFonts } from 'pdf-lib';

export const applyNativeTextEdits = async (
    originalPdfBytes: ArrayBuffer,
    edits: NativeTextItem[],
    pages: PageState[]
) => {
    if (!originalPdfBytes || edits.length === 0) return null;

    try {
        const pdfDoc = await PDFDocument.load(originalPdfBytes);
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

        const pdfPages = pdfDoc.getPages();

        for (const edit of edits) {
            // Find the page index
            const pageState = pages.find(p => p.id === edit.pageId);
            if (!pageState || pageState.originalPageIndex === undefined) continue;

            const pageIndex = pageState.originalPageIndex - 1; // 0-based
            if (pageIndex < 0 || pageIndex >= pdfPages.length) continue;

            const page = pdfPages[pageIndex];
            const { height: pageHeight } = page.getSize();

            // NativeTextItem coords (x,y) are from pdfjs transform which is PDF coords (bottom-left origin).
            // edit.y is baseline.

            // 1. Redact original (Draw White Rect)
            // Need to estimate descent for rect position
            // PDFJS height usually covers the bounding box.
            // If edit.y is baseline, and font size is 12, height might be 14.
            // We generally want to cover from [y - descent] to [y + ascent].
            // A safe bet is `y - (fontSize * 0.25)` for bottom of rect?
            // Actually `item.height` from pdfjs is the font size roughly? No, `item.height` is the height of the bounding box.
            // Let's assume rect bottom is `y` (baseline) for now, or safely slightly below.
            // Better strategy: Draw a slightly larger rect to be sure.

            page.drawRectangle({
                x: edit.x - 2,
                y: edit.y - (edit.fontSize * 0.3), // Descent approx
                width: edit.width + 4,
                height: edit.height * 1.2 || edit.fontSize * 1.2,
                color: rgb(1, 1, 1), // White
            });

            // 2. Draw New Text
            page.drawText(edit.text, {
                x: edit.x,
                y: edit.y,
                size: edit.fontSize,
                font: helveticaFont,
                color: rgb(0, 0, 0),
            });
        }

        const savedBytes = await pdfDoc.save();
        return savedBytes;
    } catch (e) {
        console.error("Failed to apply text edits", e);
        return null;
    }
};
