import React from 'react';
import { usePDFStore } from '../../../store/pdfStore';
import { PDFPage } from './PDFPage';

export const PDFViewer: React.FC = () => {
    const { pages, pdfDocument } = usePDFStore();

    if (!pdfDocument) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-100 text-gray-400">
                <p>No document loaded</p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto bg-gray-200 p-8 flex flex-col items-center">
            {(pages as any[]).map((page: any) => (
                <PDFPage key={page.pageNumber} pageNumber={page.pageNumber} />
            ))}
        </div>
    );
};
