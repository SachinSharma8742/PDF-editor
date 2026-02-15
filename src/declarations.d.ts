declare module 'pdfjs-dist';
declare module 'pdfjs-dist/build/pdf.worker.min.js';
declare module 'lucide-react';
declare module 'onnxruntime-web';

declare module '*?worker' {
    const workerConstructor: {
        new(): Worker;
    };
    export default workerConstructor;
}
