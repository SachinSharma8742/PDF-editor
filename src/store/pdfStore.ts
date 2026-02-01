import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type ToolType = 'select' | 'pan' | 'pen' | 'highlighter' | 'eraser' | 'text' | 'rectangle' | 'circle' | 'triangle' | 'star' | 'polygon' | 'ellipse' | 'arrow' | 'line' | 'image' | 'stamp' | 'signature' | 'measure' | 'redaction' | 'form-text' | 'form-checkbox' | 'ocr';
export type PageSource = 'pdf' | 'image' | 'blank';

// --- Core Data Models ---

export interface Point {
    x: number;
    y: number;
}

export interface PDFObject {
    id: string;
    type: 'text' | 'image' | 'rectangle' | 'circle' | 'triangle' | 'star' | 'polygon' | 'ellipse' | 'line' | 'arrow' | 'stamp' | 'signature' | 'path' | 'measure' | 'redaction' | 'form-text' | 'form-checkbox';
    x: number;
    y: number;
    width?: number;
    height?: number;
    rotation?: number;

    // Style props
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    dash?: number[];
    dashOffset?: number;
    sides?: number; // For polygons (3=triangle, 5=pentagon, etc.)
    innerRadius?: number; // For stars
    outerRadius?: number; // For stars

    // Path specific
    points?: number[];

    // Text specific
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    fontStyle?: string;
    align?: 'left' | 'center' | 'right';

    // Image specific
    src?: string; // Data URL or Object URL

    // Stamp specific
    content?: string; // Raw SVG string

    isLocked?: boolean;
    groupId?: string; // For grouping objects
    isNew?: boolean; // Temporary flag for auto-focusing new objects
}

export interface DrawingPath {
    id: string;
    points: number[];
    stroke: string;
    strokeWidth: number;
    tool: 'pen' | 'highlighter' | 'eraser';
    opacity: number;
    closed?: boolean;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
}

export interface PageState {
    id: string; // Unique Page ID
    pageNumber: number; // Visual index (1-based)
    originalPageIndex?: number; // Index in source PDF (1-based)

    // Dimensions
    width: number;
    height: number;
    scale: number;
    rotation: number;

    source: PageSource;
    content?: string; // Background image data URL (if not PDF)

    // Content Layers
    paths: DrawingPath[]; // Freehand drawings (Pen/Highlighter)
    objects: PDFObject[]; // Vector objects & text

    // Visual
    backgroundColor?: string; // Background color for blank pages (default: white)

    // State
    isEdited: boolean;

    // Transformations
    flipX?: boolean;
    flipY?: boolean;
}

// --- History Model ---

interface HistoryState {
    past: PageState[][]; // Array of full page state snapshots
    future: PageState[][];
}

// --- Store Actions ---

// --- Store Actions ---

interface ToolSettings {
    color: string;
    size: number;
    opacity: number;
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    fontStyle: string;
    sides?: number;
    innerRadiusRatio?: number;
    dash?: number[];
}

interface PDFStore {
    // Global State
    pdfDocument: any | null;
    originalPdfBytes: ArrayBuffer | null;
    pages: PageState[];
    currentPage: number;
    scale: number;
    isLoading: boolean;
    fileName: string | null;

    // History
    history: HistoryState;
    canUndo: () => boolean;
    canRedo: () => boolean;
    undo: () => void;
    redo: () => void;
    saveToHistory: () => void; // Call before making destructive changes

    // Tool State
    activeTool: ToolType;
    eraserMode: 'path' | 'element'; // Toggle between erasing drawings vs deleting objects
    // Per-tool preferences
    toolPreferences: Record<ToolType, ToolSettings>; // The Single Source of Truth

    // Selection
    selectedObjectIds: string[]; // For objects
    selectedPageIds: string[]; // For pages
    isMultiSelection: boolean;

    // Calibration
    calibration: {
        scale: number; // pixels per unit (e.g. 50px = 1 unit)
        unit: string; // e.g. 'cm', 'in', 'ft', 'm'
    };


    // Theme
    theme: 'light' | 'dark';
    toggleTheme: () => void;

    // Actions
    setPdfDocument: (doc: any, bytes: ArrayBuffer, fileName: string) => void;
    appendPDF: (doc: any, bytes: ArrayBuffer, addedPagesCount: number) => void;
    addPage: (source: PageSource, content?: string, width?: number, height?: number, backgroundColor?: string) => void;
    updatePage: (pageId: string, updates: Partial<PageState>) => void;
    reorderPages: (fromIndex: number, toIndex: number) => void;
    deletePage: (pageId: string) => void;
    deleteSelectedPages: () => void;
    rotatePage: (pageId: string, direction: 'cw' | 'ccw') => void;
    flipPage: (pageId: string, direction: 'horizontal' | 'vertical') => void;

    // Page Selection
    togglePageSelection: (pageId: string) => void;
    selectAllPages: () => void;
    deselectAllPages: () => void;
    duplicateSelectedPages: () => void;
    duplicatePage: (pageId: string) => void;

    // View Actions
    setScale: (scale: number) => void;
    setCurrentPage: (page: number) => void;
    setIsLoading: (loading: boolean) => void;
    setCalibration: (scale: number, unit: string) => void;


    // Tool Actions
    setActiveTool: (tool: ToolType) => void;
    setEraserMode: (mode: 'path' | 'element') => void;
    updateToolSettings: (settings: Partial<ToolSettings>) => void; // Updates CURRENT tool's settings

    // Content Actions
    addPath: (pageId: string, path: DrawingPath) => void;
    addObject: (pageId: string, object: PDFObject) => void;
    updateObject: (pageId: string, objectId: string, updates: Partial<PDFObject>) => void;
    deleteObjects: (objectIds: string[]) => void;

    // Selection Actions
    selectObject: (objectId: string, multi?: boolean) => void;
    selectObjects: (objectIds: string[]) => void;
    clearSelection: () => void;
    duplicateObject: (pageId: string, objectId: string) => void;
    reorderObject: (pageId: string, objectId: string, direction: 'front' | 'back') => void;
    groupObjects: (pageId: string, objectIds: string[]) => void;
    ungroupObjects: (pageId: string, objectIds: string[]) => void;

    reset: () => void;
}

// --- Implementation ---

const generateId = () => `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const DEFAULT_SETTINGS: ToolSettings = {
    color: '#000000',
    size: 2,
    opacity: 1,
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: 'normal',
    fontStyle: 'normal'
};

export const usePDFStore = create<PDFStore>()(
    devtools(
        (set, get) => ({
            pdfDocument: null,
            originalPdfBytes: null,
            pages: [],
            currentPage: 1,
            scale: 1.0,
            isLoading: false,
            fileName: null,

            history: { past: [], future: [] },

            // Global Theme
            theme: 'dark',
            toggleTheme: () => set(state => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

            activeTool: 'select',
            eraserMode: 'path', // Default to path eraser

            // Initialize preferences for each tool
            toolPreferences: {
                select: { ...DEFAULT_SETTINGS },
                pan: { ...DEFAULT_SETTINGS },
                pen: { ...DEFAULT_SETTINGS, color: '#000000', size: 2 },
                highlighter: { ...DEFAULT_SETTINGS, color: '#facc15', size: 20, opacity: 0.5 },
                eraser: { ...DEFAULT_SETTINGS, size: 20 },
                text: { ...DEFAULT_SETTINGS, color: '#000000' },
                rectangle: { ...DEFAULT_SETTINGS, color: '#000000', size: 2 },
                circle: { ...DEFAULT_SETTINGS, color: '#000000', size: 2 },
                triangle: { ...DEFAULT_SETTINGS, color: '#000000', size: 2 },
                star: { ...DEFAULT_SETTINGS, color: '#000000', size: 2 },
                polygon: { ...DEFAULT_SETTINGS, color: '#000000', size: 2 },
                ellipse: { ...DEFAULT_SETTINGS, color: '#000000', size: 2 },
                arrow: { ...DEFAULT_SETTINGS, color: '#000000' },
                line: { ...DEFAULT_SETTINGS, color: '#000000' },
                image: { ...DEFAULT_SETTINGS },
                stamp: { ...DEFAULT_SETTINGS },
                signature: { ...DEFAULT_SETTINGS },
                measure: { ...DEFAULT_SETTINGS, color: '#ef4444', size: 2 },
                ocr: { ...DEFAULT_SETTINGS }
            },

            selectedObjectIds: [],
            selectedPageIds: [],
            isMultiSelection: false,

            calibration: {
                scale: 1, // 1px = 1px default
                unit: 'px'
            },


            // History Helpers
            canUndo: () => get().history.past.length > 0,
            canRedo: () => get().history.future.length > 0,

            saveToHistory: () => {
                const { pages, history } = get();
                const snapshot = JSON.parse(JSON.stringify(pages));
                const newPast = [...history.past, snapshot].slice(-50);
                set({
                    history: {
                        past: newPast,
                        future: []
                    }
                });
            },

            undo: () => {
                const { history, pages } = get();
                if (history.past.length === 0) return;
                const previous = history.past[history.past.length - 1];
                const newPast = history.past.slice(0, -1);
                set({
                    pages: previous,
                    history: { past: newPast, future: [pages, ...history.future] }
                });
            },

            redo: () => {
                const { history, pages } = get();
                if (history.future.length === 0) return;
                const next = history.future[0];
                const newFuture = history.future.slice(1);
                set({
                    pages: next,
                    history: { past: [...history.past, pages], future: newFuture }
                });
            },

            setPdfDocument: (doc, bytes, fileName) => {
                const initialPages: PageState[] = Array.from({ length: doc.numPages }, (_, i) => ({
                    id: `page-${i + 1}`,
                    pageNumber: i + 1,
                    originalPageIndex: i + 1,
                    width: 595,
                    height: 842,
                    scale: 1,
                    rotation: 0,
                    source: 'pdf',
                    paths: [],
                    objects: [],
                    isEdited: false
                }));
                set({
                    pdfDocument: doc,
                    originalPdfBytes: bytes,
                    fileName: fileName,
                    pages: initialPages,
                    currentPage: 1,
                    history: { past: [], future: [] },
                });
            },

            appendPDF: (doc, bytes, addedPagesCount) => {
                get().saveToHistory();
                const currentCount = get().pages.length;
                const newPages: PageState[] = Array.from({ length: addedPagesCount }, (_, i) => ({
                    id: generateId(),
                    pageNumber: currentCount + i + 1,
                    originalPageIndex: currentCount + i + 1,
                    width: 595,
                    height: 842,
                    scale: 1,
                    rotation: 0,
                    source: 'pdf',
                    paths: [],
                    objects: [],
                    isEdited: false
                }));
                set(state => ({
                    pdfDocument: doc,
                    originalPdfBytes: bytes,
                    pages: [...state.pages, ...newPages]
                }));
            },

            addPage: (source, content, width = 595, height = 842, backgroundColor) => {
                get().saveToHistory();
                set(state => {
                    const newPage: PageState = {
                        id: generateId(),
                        pageNumber: state.pages.length + 1,
                        width,
                        height,
                        scale: 1,
                        rotation: 0,
                        source,
                        content,
                        backgroundColor: source === 'blank' ? (backgroundColor || '#ffffff') : undefined,
                        paths: [],
                        objects: [],
                        isEdited: true
                    };
                    return {
                        pages: [...state.pages, newPage],
                        currentPage: newPage.pageNumber
                    };
                });
            },

            updatePage: (pageId, updates) => {
                set(state => ({
                    pages: state.pages.map(p => p.id === pageId ? { ...p, ...updates, isEdited: true } : p)
                }));
            },

            reorderPages: (fromIndex, toIndex) => {
                get().saveToHistory();
                set(state => {
                    const newPages = [...state.pages];
                    const [moved] = newPages.splice(fromIndex, 1);
                    newPages.splice(toIndex, 0, moved);
                    return {
                        pages: newPages.map((p, i) => ({ ...p, pageNumber: i + 1 }))
                    };
                });
            },

            deletePage: (pageId) => {
                get().saveToHistory();
                set(state => ({
                    pages: state.pages
                        .filter(p => p.id !== pageId)
                        .map((p, i) => ({ ...p, pageNumber: i + 1 }))
                }));
            },

            deleteSelectedPages: () => {
                get().saveToHistory();
                set(state => {
                    const ids = new Set(state.selectedPageIds);
                    if (ids.size === 0) return state;
                    const newPages = state.pages
                        .filter(p => !ids.has(p.id))
                        .map((p, i) => ({ ...p, pageNumber: i + 1 }));
                    return {
                        pages: newPages,
                        selectedPageIds: [],
                        currentPage: Math.min(state.currentPage, newPages.length) || 1
                    };
                });
            },

            togglePageSelection: (pageId) => set(state => {
                const ids = new Set(state.selectedPageIds);
                if (ids.has(pageId)) ids.delete(pageId);
                else ids.add(pageId);
                return { selectedPageIds: Array.from(ids) };
            }),

            selectAllPages: () => set(state => ({
                selectedPageIds: state.pages.map(p => p.id)
            })),

            deselectAllPages: () => set({ selectedPageIds: [] }),

            duplicateSelectedPages: () => {
                const { selectedPageIds, pages, saveToHistory } = get();
                if (selectedPageIds.length === 0) return;
                saveToHistory();

                const selectedPages = pages.filter(p => selectedPageIds.includes(p.id));
                const newPages = selectedPages.map((p, i) => ({
                    ...p,
                    id: `page-dup-${Date.now()}-${i}`,
                    pageNumber: pages.length + i + 1,
                    originalPageIndex: p.originalPageIndex,
                    paths: JSON.parse(JSON.stringify(p.paths)),
                    objects: JSON.parse(JSON.stringify(p.objects)),
                    isEdited: true
                }));

                set(state => ({
                    pages: [...state.pages, ...newPages].map((p, i) => ({ ...p, pageNumber: i + 1 })),
                    selectedPageIds: newPages.map(p => p.id)
                }));
            },

            duplicatePage: (pageId: string) => {
                const { pages, saveToHistory } = get();
                const page = pages.find(p => p.id === pageId);
                if (!page) return;

                saveToHistory();

                const newPage = {
                    ...page,
                    id: `page-dup-${Date.now()}`,
                    pageNumber: pages.length + 1, // Will be re-indexed
                    originalPageIndex: page.originalPageIndex,
                    paths: JSON.parse(JSON.stringify(page.paths)),
                    objects: JSON.parse(JSON.stringify(page.objects)),
                    isEdited: true
                };

                // Insert after the current page
                const index = pages.findIndex(p => p.id === pageId);
                const newPages = [...pages];
                newPages.splice(index + 1, 0, newPage);

                set(state => ({
                    pages: newPages.map((p, i) => ({ ...p, pageNumber: i + 1 }))
                }));
            },

            setScale: (scale) => set({ scale }),
            setCurrentPage: (page) => set({ currentPage: page }),
            setIsLoading: (loading) => set({ isLoading: loading }),
            setCalibration: (scale, unit) => set({ calibration: { scale, unit } }),


            setActiveTool: (tool) => {
                set({ activeTool: tool, selectedObjectIds: [] });
            },

            setEraserMode: (mode) => set({ eraserMode: mode }),

            // NEW: Updates the preferences for the CURRENTLY active tool
            updateToolSettings: (settings) => set(state => {
                const currentTool = state.activeTool;
                return {
                    toolPreferences: {
                        ...state.toolPreferences,
                        [currentTool]: { ...state.toolPreferences[currentTool], ...settings }
                    }
                };
            }),

            addPath: (pageId, path) => {
                get().saveToHistory();

                // Convert DrawingPath to PDFObject
                // 1. Calculate bounding box
                const xs = path.points.filter((_, i) => i % 2 === 0);
                const ys = path.points.filter((_, i) => i % 2 !== 0);
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);

                const width = maxX - minX;
                const height = maxY - minY;

                // 2. Normalize points to be relative to (minX, minY)
                const normalizedPoints = path.points.map((p, i) => {
                    return i % 2 === 0 ? p - minX : p - minY;
                });

                const newObject: PDFObject = {
                    id: path.id || generateId(),
                    type: 'path',
                    x: minX,
                    y: minY,
                    width: width,
                    height: height,
                    points: normalizedPoints,
                    stroke: path.stroke,
                    strokeWidth: path.strokeWidth,
                    opacity: path.opacity,
                    rotation: 0
                };

                set(state => ({
                    pages: state.pages.map(p =>
                        p.id === pageId ? { ...p, objects: [...p.objects, newObject], isEdited: true } : p
                    )
                }));
                // Optionally select it immediately if desired, but for drawing usually we don't.
            },

            addObject: (pageId, object) => {
                get().saveToHistory();
                set(state => ({
                    pages: state.pages.map(p =>
                        p.id === pageId ? { ...p, objects: [...p.objects, object], isEdited: true } : p
                    )
                }));
                get().selectObject(object.id);
            },

            updateObject: (pageId, objectId, updates) => {
                set(state => ({
                    pages: state.pages.map(p =>
                        p.id === pageId ? {
                            ...p,
                            objects: p.objects.map(obj =>
                                obj.id === objectId ? { ...obj, ...updates } : obj
                            ),
                            isEdited: true
                        } : p
                    )
                }));
            },

            deleteObjects: (objectIds) => {
                get().saveToHistory();
                const ids = new Set(objectIds);
                set(state => ({
                    pages: state.pages.map(p => ({
                        ...p,
                        objects: p.objects.filter(obj => !ids.has(obj.id))
                    })),
                    selectedObjectIds: []
                }));
            },

            selectObject: (objectId, multi = false) => {
                set(state => {
                    const findGroupMembers = (targetId: string) => {
                        for (const page of state.pages) {
                            const obj = page.objects.find(o => o.id === targetId);
                            if (obj && obj.groupId) {
                                return page.objects.filter(o => o.groupId === obj.groupId).map(o => o.id);
                            }
                        }
                        return [targetId];
                    };

                    const idsToSelect = findGroupMembers(objectId);
                    if (multi) {
                        const currentSet = new Set(state.selectedObjectIds);
                        const allSelected = idsToSelect.every(id => currentSet.has(id));
                        let newSet = new Set(currentSet);
                        if (allSelected) idsToSelect.forEach(id => newSet.delete(id));
                        else idsToSelect.forEach(id => newSet.add(id));
                        return {
                            selectedObjectIds: Array.from(newSet),
                            isMultiSelection: newSet.size > 1
                        };
                    }
                    return { selectedObjectIds: idsToSelect, isMultiSelection: idsToSelect.length > 1 };
                });
            },

            selectObjects: (objectIds) => {
                set({ selectedObjectIds: objectIds, isMultiSelection: objectIds.length > 1 });
            },

            clearSelection: () => set({ selectedObjectIds: [], isMultiSelection: false }),

            reset: () => set({
                pdfDocument: null,
                originalPdfBytes: null,
                fileName: null,
                pages: [],
                currentPage: 1,
                scale: 1.0,
                history: { past: [], future: [] },
                selectedObjectIds: [],
                selectedPageIds: [],
                activeTool: 'select',
                toolPreferences: {
                    select: { ...DEFAULT_SETTINGS },
                    pan: { ...DEFAULT_SETTINGS },
                    pen: { ...DEFAULT_SETTINGS, color: '#000000', size: 2 },
                    highlighter: { ...DEFAULT_SETTINGS, color: '#facc15', size: 20, opacity: 0.5 },
                    eraser: { ...DEFAULT_SETTINGS, size: 20 },
                    text: { ...DEFAULT_SETTINGS, color: '#000000' },
                    rectangle: { ...DEFAULT_SETTINGS, color: '#000000', size: 2 },
                    circle: { ...DEFAULT_SETTINGS, color: '#000000', size: 2 },
                    triangle: { ...DEFAULT_SETTINGS, color: '#000000', size: 2 },
                    star: { ...DEFAULT_SETTINGS, color: '#000000', size: 2 },
                    polygon: { ...DEFAULT_SETTINGS, color: '#000000', size: 2 },
                    ellipse: { ...DEFAULT_SETTINGS, color: '#000000', size: 2 },
                    arrow: { ...DEFAULT_SETTINGS, color: '#000000' },
                    line: { ...DEFAULT_SETTINGS, color: '#000000' },
                    image: { ...DEFAULT_SETTINGS },
                    stamp: { ...DEFAULT_SETTINGS },
                    signature: { ...DEFAULT_SETTINGS },
                    measure: { ...DEFAULT_SETTINGS, color: '#ef4444', size: 2 },
                    redaction: { ...DEFAULT_SETTINGS, color: '#000000', size: 0 },
                    'form-text': { ...DEFAULT_SETTINGS },
                    'form-checkbox': { ...DEFAULT_SETTINGS },
                    'ocr': { ...DEFAULT_SETTINGS }
                }
            }),

            duplicateObject: (pageId, objectId) => {
                get().saveToHistory();
                set(state => ({
                    pages: state.pages.map(p => {
                        if (p.id !== pageId) return p;
                        const objToClone = p.objects.find(o => o.id === objectId);
                        if (!objToClone) return p;
                        const newObj = {
                            ...objToClone,
                            id: generateId(),
                            x: objToClone.x + 20,
                            y: objToClone.y + 20
                        };
                        return { ...p, objects: [...p.objects, newObj], isEdited: true };
                    })
                }));
            },

            reorderObject: (pageId, objectId, direction) => {
                get().saveToHistory();
                set(state => ({
                    pages: state.pages.map(p => {
                        if (p.id !== pageId) return p;
                        const objIndex = p.objects.findIndex(o => o.id === objectId);
                        if (objIndex === -1) return p;
                        const newObjects = [...p.objects];
                        const [movedObj] = newObjects.splice(objIndex, 1);
                        if (direction === 'front') newObjects.push(movedObj);
                        else newObjects.unshift(movedObj);
                        return { ...p, objects: newObjects, isEdited: true };
                    })
                }));
            },

            groupObjects: (pageId, objectIds) => {
                if (objectIds.length < 2) return;
                get().saveToHistory();
                const newGroupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                set(state => ({
                    pages: state.pages.map(p => {
                        if (p.id !== pageId) return p;
                        return {
                            ...p,
                            objects: p.objects.map(obj =>
                                objectIds.includes(obj.id) ? { ...obj, groupId: newGroupId } : obj
                            ),
                            isEdited: true
                        };
                    }),
                    selectedObjectIds: objectIds,
                    isMultiSelection: true
                }));
            },

            ungroupObjects: (pageId, objectIds) => {
                get().saveToHistory();
                set(state => ({
                    pages: state.pages.map(p => {
                        if (p.id !== pageId) return p;
                        return {
                            ...p,
                            objects: p.objects.map(obj =>
                                objectIds.includes(obj.id) ? { ...obj, groupId: undefined } : obj
                            ),
                            isEdited: true
                        };
                    })
                }));
            },

            rotatePage: (pageId, direction) => {
                get().saveToHistory();
                set(state => ({
                    pages: state.pages.map(p => {
                        if (p.id !== pageId) return p;
                        const currentRotation = p.rotation || 0;
                        const delta = direction === 'cw' ? 90 : -90;
                        let newRotation = (currentRotation + delta) % 360;
                        if (newRotation < 0) newRotation += 360;
                        return { ...p, rotation: newRotation, isEdited: true };
                    })
                }));
            },

            flipPage: (pageId, direction) => {
                get().saveToHistory();
                set(state => ({
                    pages: state.pages.map(p => {
                        if (p.id !== pageId) return p;
                        if (direction === 'horizontal') {
                            return { ...p, flipX: !p.flipX, isEdited: true };
                        } else {
                            return { ...p, flipY: !p.flipY, isEdited: true };
                        }
                    })
                }));
            }
        })
    )
);

