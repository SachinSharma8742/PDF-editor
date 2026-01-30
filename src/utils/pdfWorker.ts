import * as pdfjsLib from 'pdfjs-dist';

// Use the CDN for the worker to avoid build/bundling issues with Create React App / Vite
// Matches the version of pdfjs-dist being used
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
