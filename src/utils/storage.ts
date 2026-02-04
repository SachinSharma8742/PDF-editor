import { get, set, del } from 'idb-keyval';

const PDF_STORE_KEY = 'last-opened-pdf-bytes';
const PDF_METADATA_KEY = 'last-opened-pdf-metadata';

export interface PDFMetadata {
    fileName: string;
    lastSaved: number;
}

export const savePDFToStorage = async (bytes: ArrayBuffer, metadata: PDFMetadata) => {
    try {
        await set(PDF_STORE_KEY, bytes);
        await set(PDF_METADATA_KEY, metadata);
    } catch (error) {
        console.error('Failed to save PDF to IndexedDB:', error);
    }
};

export const loadPDFFromStorage = async (): Promise<{ bytes: ArrayBuffer; metadata: PDFMetadata } | null> => {
    try {
        const bytes = await get<ArrayBuffer>(PDF_STORE_KEY);
        const metadata = await get<PDFMetadata>(PDF_METADATA_KEY);
        if (bytes && metadata) {
            return { bytes, metadata };
        }
    } catch (error) {
        console.error('Failed to load PDF from IndexedDB:', error);
    }
    return null;
};

export const clearPDFFromStorage = async () => {
    try {
        await del(PDF_STORE_KEY);
        await del(PDF_METADATA_KEY);
    } catch (error) {
        console.error('Failed to clear PDF from IndexedDB:', error);
    }
};
