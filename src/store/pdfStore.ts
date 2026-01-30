import { create } from 'zustand';

export type ToolType = 'select' | 'pen' | 'highlighter' | 'eraser';
export type PageSource = 'pdf' | 'image' | 'blank';

export interface Point {
    x: number;
    y: number;
}

export interface DrawingLine {
    points: number[];
    color: string;
    width: number;
    tool: 'pen' | 'highlighter' | 'eraser';
}

export interface OverlayImage {
    id: string;
    url: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
}

export interface PageState {
    pageNumber: number; // Current visual index (1-based)
    id: string; // Unique ID for keying/dnd
    originalPageIndex?: number; // Original 1-based index in the PDF document (if source === 'pdf')
    rotation: number;
    scale: number;
    isEdited: boolean;
    canvasData: any; // Serialized Konva data
    source: PageSource;
    content?: string; // Data URL for image or null for blank/pdf
    width?: number; // Custom width for non-PDF pages
    height?: number; // Custom height for non-PDF pages
    lines: DrawingLine[]; // Drawing data
    images: OverlayImage[]; // Overlay images
}

interface PDFStore {
    pdfDocument: any | null;
    originalPdfBytes: ArrayBuffer | null;
    pages: PageState[];
    scale: number;
    currentPage: number;
    isLoading: boolean;

    // Selection State
    isSelectionMode: boolean;
    selectedPages: Set<number>;

    // Editing State
    activeTool: ToolType;
    brushColor: string;
    brushSize: number;

    // Actions
    setPdfDocument: (doc: any, bytes: ArrayBuffer) => void;

    // Page Actions
    addPage: (source: PageSource, content?: string, width?: number, height?: number) => void;
    deleteSelectedPages: () => void;
    reorderPages: (fromIndex: number, toIndex: number) => void;

    // View Actions
    setScale: (scale: number) => void;
    setCurrentPage: (page: number) => void;
    setIsLoading: (loading: boolean) => void;

    // Selection Actions
    toggleSelectionMode: () => void;
    togglePageSelection: (pageNumber: number) => void;
    selectAll: () => void;
    clearSelection: () => void;

    // Editing Actions
    setActiveTool: (tool: ToolType) => void;
    setBrushColor: (color: string) => void;
    setBrushSize: (size: number) => void;
    addDrawingLine: (pageNumber: number, line: DrawingLine) => void;
    addImageToPage: (pageNumber: number, image: OverlayImage) => void;
    updateImagePosition: (pageNumber: number, imageId: string, updates: Partial<OverlayImage>) => void;

    reset: () => void;
}

export const usePDFStore = create<PDFStore>((set) => ({
    pdfDocument: null,
    originalPdfBytes: null,
    pages: [],
    scale: 1.0,
    currentPage: 1,
    isLoading: false,

    isSelectionMode: false,
    selectedPages: new Set(),

    activeTool: 'select',
    brushColor: '#df4b26',
    brushSize: 5,

    setPdfDocument: (doc, bytes) => {
        const initialPages: PageState[] = Array.from({ length: doc.numPages }, (_, i) => ({
            pageNumber: i + 1,
            id: `page-${Date.now()}-${i + 1}`,
            originalPageIndex: i + 1,
            rotation: 0,
            scale: 1.0,
            isEdited: false,
            canvasData: null,
            source: 'pdf',
            lines: [],
            images: []
        }));
        set({
            pdfDocument: doc,
            originalPdfBytes: bytes,
            pages: initialPages,
            currentPage: 1
        });
    },

    addPage: (source, content, width = 595, height = 842) => set((state) => {
        const newPageNumber = state.pages.length + 1;
        const newPage: PageState = {
            pageNumber: newPageNumber,
            id: `page-${Date.now()}-${newPageNumber}`,
            rotation: 0,
            scale: 1.0,
            isEdited: source !== 'pdf',
            canvasData: null,
            source: source,
            content: content,
            width: width,
            height: height,
            lines: [],
            images: []
        };
        return { pages: [...state.pages, newPage] };
    }),

    deleteSelectedPages: () => set((state) => {
        if (state.selectedPages.size === 0) return state;

        const newPages = state.pages
            .filter(p => !state.selectedPages.has(p.pageNumber))
            .map((p, index) => ({ ...p, pageNumber: index + 1 }));

        return {
            pages: newPages,
            selectedPages: new Set(),
            currentPage: Math.min(state.currentPage, newPages.length) || 1
        };
    }),

    reorderPages: (fromIndex: number, toIndex: number) => set((state) => {
        const newPages = [...state.pages];
        const [removed] = newPages.splice(fromIndex, 1);
        newPages.splice(toIndex, 0, removed);

        const reindexedPages = newPages.map((p, index) => ({
            ...p,
            pageNumber: index + 1
        }));

        return { pages: reindexedPages };
    }),

    setScale: (scale) => set({ scale }),
    setCurrentPage: (page) => set({ currentPage: page }),
    setIsLoading: (loading) => set({ isLoading: loading }),

    toggleSelectionMode: () => set((state) => ({
        isSelectionMode: !state.isSelectionMode,
        selectedPages: new Set(),
        activeTool: 'select'
    })),

    togglePageSelection: (pageNumber) => set((state) => {
        const newSelected = new Set(state.selectedPages);
        if (newSelected.has(pageNumber)) {
            newSelected.delete(pageNumber);
        } else {
            newSelected.add(pageNumber);
        }
        return { selectedPages: newSelected };
    }),

    selectAll: () => set((state) => {
        const allPages = new Set(state.pages.map(p => p.pageNumber));
        return { selectedPages: allPages };
    }),

    clearSelection: () => set({ selectedPages: new Set() }),

    setActiveTool: (tool) => set({ activeTool: tool }),
    setBrushColor: (color) => set({ brushColor: color }),
    setBrushSize: (size) => set({ brushSize: size }),

    addDrawingLine: (pageNumber, line) => set((state) => ({
        pages: state.pages.map(p =>
            p.pageNumber === pageNumber
                ? { ...p, lines: [...p.lines, line], isEdited: true }
                : p
        )
    })),

    addImageToPage: (pageNumber, image) => set((state) => ({
        pages: state.pages.map(p =>
            p.pageNumber === pageNumber
                ? { ...p, images: [...p.images, image], isEdited: true }
                : p
        )
    })),

    updateImagePosition: (pageNumber, imageId, updates) => set((state) => ({
        pages: state.pages.map(p =>
            p.pageNumber === pageNumber
                ? {
                    ...p,
                    images: p.images.map(img =>
                        img.id === imageId ? { ...img, ...updates } : img
                    ),
                    isEdited: true
                }
                : p
        )
    })),

    reset: () => set({
        pdfDocument: null,
        originalPdfBytes: null,
        pages: [],
        scale: 1.0,
        currentPage: 1,
        isLoading: false,
        isSelectionMode: false,
        selectedPages: new Set(),
        activeTool: 'select',
        brushColor: '#df4b26',
        brushSize: 5,
    }),
}));
