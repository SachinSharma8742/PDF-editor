/// <reference types="vite/client" />

declare module 'pdfjs-dist';
declare module 'pdfjs-dist/build/pdf.worker.min.js';
declare module 'lucide-react';
declare module 'gl-matrix';

declare module 'onnxruntime-web' {
    export namespace InferenceSession {
        type ExecutionProviderConfig = string | {
            name: string;
            options?: any;
        };
        type ExecutionProvider = ExecutionProviderConfig;

        function create(modelPath: string, options?: any): Promise<InferenceSession>;
    }

    export interface InferenceSession {
        run(feeds: Record<string, Tensor>): Promise<Record<string, Tensor>>;
        inputNames: string[];
        outputNames: string[];
    }

    export class Tensor {
        constructor(type: string, data: any, dims: number[]);
        data: any;
        dispose(): void;
    }
}


declare module '*?worker' {
    const workerConstructor: {
        new(): Worker;
    };
    export default workerConstructor;
}
