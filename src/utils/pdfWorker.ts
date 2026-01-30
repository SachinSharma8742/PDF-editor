import * as pdfjsLib from 'pdfjs-dist';

// Use local worker from public directory
try {
    // Note: The file must be copied to public/pdf.worker.min.mjs
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
} catch (error) {
    console.error('Failed to set PDF worker source:', error);
}

export const usePDFWorker = () => {
    // Logic to ensure worker is ready if needed
};
