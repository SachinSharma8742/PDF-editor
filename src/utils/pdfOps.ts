import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

export const extractPagesAsPNG = async (
    pdfDocument: any,
    selectedPages: Set<number>,
    scale: number = 2
) => {
    if (!pdfDocument || selectedPages.size === 0) return;

    const pagesToExtract = Array.from(selectedPages).sort((a, b) => a - b);

    for (const pageNum of pagesToExtract) {
        const page = await pdfDocument.getPage(pageNum);
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
            a.download = `page-${pageNum}.png`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }
};

export const loadPDF = async (arrayBuffer: ArrayBuffer) => {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    return loadingTask.promise;
};

export const extractPagesAsPDF = async (
    originalPdfBytes: ArrayBuffer,
    selectedPages: Set<number>
) => {
    if (!originalPdfBytes || selectedPages.size === 0) return;

    try {
        const pdfDoc = await PDFDocument.load(originalPdfBytes);
        const newPdf = await PDFDocument.create();

        // pdf-lib is 0-indexed, our app is 1-indexed
        const pageIndices = Array.from(selectedPages).map(p => p - 1).sort((a, b) => a - b);

        const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
        copiedPages.forEach(page => newPdf.addPage(page));

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
