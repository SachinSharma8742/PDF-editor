import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { PageState, PDFObject, DrawingPath, ToolType } from './pdfStore';
import { usePDFStore } from './pdfStore';

// Re-using types from pdfStore where compatible, but might need specific ones later.
// Ideally, we import them.

interface EditorHistory {
    past: PageState[];
    future: PageState[];
}

export interface ToolSettings {
    color: string;
    size: number;
    opacity: number;
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    fontStyle: string;
    textAlign: 'left' | 'center' | 'right' | 'justify';
    eraserMode: 'standard' | 'object';
    smartShapeMode?: boolean;
    sides?: number;
    innerRadiusRatio?: number;
    dash?: number[];
}

export interface NativeTextItem {
    id: string; // Composite ID or index
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    fontFamily: string;
    color: string; // Text color (hex or rgb)
    originalRef?: any; // Raw PDF item reference for replacement logic
    pageId: string;
}

export interface TextPreset {
    id: 'heading' | 'subheading' | 'body' | 'caption';
    name: string;
    fontSize: number;
    fontWeight: string;
    fontFamily: string;
    opacity: number;
    fontStyle: string;
    color?: string; // Optional override
}

export const TEXT_PRESETS: TextPreset[] = [
    { id: 'heading', name: 'Heading', fontSize: 32, fontWeight: 'bold', fontFamily: 'Inter', opacity: 1, fontStyle: 'normal' },
    { id: 'subheading', name: 'Subheading', fontSize: 24, fontWeight: '600', fontFamily: 'Inter', opacity: 1, fontStyle: 'normal' },
    { id: 'body', name: 'Body Text', fontSize: 16, fontWeight: 'normal', fontFamily: 'Inter', opacity: 1, fontStyle: 'normal' },
    { id: 'caption', name: 'Caption', fontSize: 12, fontWeight: 'normal', fontFamily: 'Inter', opacity: 0.7, fontStyle: 'italic' }
];

const DEFAULT_SETTINGS: ToolSettings = {
    color: '#000000',
    size: 2,
    opacity: 1,
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textAlign: 'left',
    eraserMode: 'standard',
    smartShapeMode: false
};

const DEFAULT_TOOL_PREFERENCES: Record<ToolType, ToolSettings> = {
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
    'ocr': { ...DEFAULT_SETTINGS },
    'search': { ...DEFAULT_SETTINGS },
    'heart': { ...DEFAULT_SETTINGS, color: '#ef4444', size: 2 },
    'cloud': { ...DEFAULT_SETTINGS, color: '#3b82f6', size: 2 },
    'lightning': { ...DEFAULT_SETTINGS, color: '#eab308', size: 2 },
    'drop': { ...DEFAULT_SETTINGS, color: '#3b82f6', size: 2 },
    'callout-bubble': { ...DEFAULT_SETTINGS, color: '#000000', size: 2 },
    'sticky-note': { ...DEFAULT_SETTINGS, color: '#facc15' },
    'callout': { ...DEFAULT_SETTINGS, color: '#000000' },
    'native-text-selection': { ...DEFAULT_SETTINGS }
};

interface EditorStore {
    isActive: boolean;
    originalPageId: string | null;
    currentPage: PageState | null; // The working copy of the page

    // UI State
    scale: number;
    activeTool: ToolType;
    toolPreferences: Record<ToolType, ToolSettings>;
    selectedObjectIds: string[];
    recentColors: string[];
    recentTextStyles: ToolSettings[]; // Track last used text styles
    previewStyle: ToolSettings | null; // For hover previews

    history: EditorHistory;

    // Actions
    initEditor: (page: PageState) => void;
    commit: () => void; // Save back to main store
    cancel: () => void; // Discard changes

    setScale: (scale: number) => void;
    setActiveTool: (tool: ToolType) => void;
    updateToolSettings: (settings: Partial<ToolSettings>) => void;

    // Content Actions
    addPath: (path: DrawingPath) => void;
    addObject: (object: PDFObject) => void;
    updateObject: (objectId: string, updates: Partial<PDFObject>) => void;
    deleteObjects: (objectIds: string[]) => void;
    setObjects: (objects: PDFObject[]) => void;
    reorderObject: (objectId: string, direction: 'front' | 'back' | 'forward' | 'backward') => void;
    duplicateObject: (objectIds: string[]) => void;

    // Selection
    selectObject: (objectId: string, multi?: boolean) => void;
    selectObjects: (objectIds: string[]) => void;
    clearSelection: () => void;

    // History
    undo: () => void;
    redo: () => void;

    // Text Actions
    applyTextPreset: (preset: TextPreset) => void;
    addRecentTextStyle: (style: ToolSettings) => void;
    setPreviewStyle: (style: ToolSettings | null) => void;

    // Internal
    saveToHistory: () => void;

    // Eyedropper / Color Memory
    addColorToHistory: (color: string) => void;

    groupObjects: (objectIds: string[]) => void;
    ungroupObjects: (objectIds: string[]) => void;

    // Context Menu State
    contextMenu: {
        isOpen: boolean;
        x: number;
        y: number;
        type: 'object' | 'page' | 'thumbnail' | 'editor-background' | null;
        data?: any;
    };
    openContextMenu: (x: number, y: number, type: 'object' | 'page' | 'thumbnail' | 'editor-background', data?: any) => void;
    closeContextMenu: () => void;

    isCropping: boolean;
    setCropping: (isCropping: boolean) => void;

    // Canvas State (Pan)
    stagePosition: { x: number; y: number };
    setStagePosition: (pos: { x: number; y: number }) => void;

    // Grid Snap
    snapToGrid: boolean;
    gridSize: number;
    toggleSnapToGrid: () => void;
    setGridSize: (size: number) => void;

    // UI Panel State
    activePanelTab: 'properties' | 'layers' | 'export';
    setActivePanelTab: (tab: 'properties' | 'layers' | 'export') => void;


    // Clipboard
    clipboard: PDFObject[]; // Array of PDFObject
    copySelection: () => void;
    pasteClipboard: () => void;

    updateCurrentPage: (updates: Partial<PageState>) => void;

    // --- Image Studio State ---
    imageStudio: {
        isOpen: boolean;
        mode: 'create' | 'edit';
        initialImageSrc: string | null; // The raw source
        targetObjectId: string | null; // If editing existing
        initialEditParams: any | null;
    };
    openImageStudio: (src: string, objectId?: string, currentParams?: any) => void;
    closeImageStudio: () => void;

    // --- Native PDF Text Editing ---
    // --- Native PDF Text Editing ---
    editingMode: 'standard' | 'native-text';
    setEditingMode: (mode: 'standard' | 'native-text') => void;
    activeNativeTextItem: NativeTextItem | null;
    setActiveNativeTextItem: (item: NativeTextItem | null) => void;

    pendingNativeTextEdits: Record<string, NativeTextItem>;
    updateNativeTextEdit: (id: string, edit: NativeTextItem) => void;
    commitNativeTextEdits: () => void;

    nativeTextStudio: {
        isOpen: boolean;
        pageId: string | null;
    };
    openNativeTextStudio: (pageId: string) => void;
    closeNativeTextStudio: () => void;

    // Text Studio State
    textStudio: {
        isOpen: boolean;
        mode: 'create' | 'edit';
        elementId: string | null;
        initialSnapshot: PDFObject | null;
    };
    openTextStudio: (mode: 'create' | 'edit', elementId?: string, snapshot?: PDFObject) => void;
    closeTextStudio: () => void;


    // Shape Editor State
    shapeEditor: {
        isOpen: boolean;
        mode: 'add' | 'edit';
    };
    openShapeEditor: (mode: 'add' | 'edit') => void;
    closeShapeEditor: () => void;

    editingObjectId: string | null;
    setEditingObjectId: (id: string | null) => void;

    // Find & Replace State
    findReplaceState: {
        isOpen: boolean;
        searchTerm: string;
        replaceTerm: string;
        caseSensitive: boolean;
        matches: { id: string; text: string; startIndex: number; endIndex: number; originalItem: any }[];
        currentMatchIndex: number;
    };
    setFindReplaceOpen: (isOpen: boolean) => void;
    setSearchTerm: (term: string) => void;
    setReplaceTerm: (term: string) => void;
    toggleCaseSensitive: () => void;
    findMatches: (textItems: any[]) => void;
    navigateMatch: (direction: 'next' | 'prev') => void;
    replaceCurrentMatch: () => void;
    replaceAllMatches: () => void;
    clearFindReplace: () => void;

    // OCR State
    ocrState: {
        isOpen: boolean;
        isProcessing: boolean;
        progress: number;
        result: string | null;
        error: string | null;
    };
    setOCROpen: (isOpen: boolean) => void;
    startOCR: (imageSource: string | HTMLCanvasElement) => Promise<void>;
    clearOCRResult: () => void;
}

const deepClone = <T>(obj: T): T => {
    if (typeof structuredClone === 'function') {
        return structuredClone(obj);
    }
    return JSON.parse(JSON.stringify(obj));
};

export const useEditorStore = create<EditorStore>()(
    devtools(
        (set, get) => ({
            isActive: false,
            originalPageId: null,
            currentPage: null,
            scale: 1,
            activeTool: 'select',
            toolPreferences: DEFAULT_TOOL_PREFERENCES,
            selectedObjectIds: [],
            recentColors: ['#000000', '#df4b26', '#10B981', '#3B82F6', '#6366F1', '#ffffff', '#ef4444', '#f59e0b', '#8B5CF6'], // Initial palette (9 colors)
            recentTextStyles: [
                { ...DEFAULT_SETTINGS, fontSize: 32, fontFamily: 'Inter', fontWeight: 'bold', color: '#000000' },
                { ...DEFAULT_SETTINGS, fontSize: 24, fontFamily: 'Inter', fontWeight: '600', color: '#2563eb' },
                { ...DEFAULT_SETTINGS, fontSize: 16, fontFamily: 'Inter', fontStyle: 'italic', opacity: 0.8 }
            ],
            clipboard: [],
            previewStyle: null,

            history: { past: [], future: [] },

            addColorToHistory: (color) => set(state => {
                const newRecent = [color, ...state.recentColors.filter(c => c !== color)].slice(0, 9);
                return { recentColors: newRecent };
            }),

            applyTextPreset: (preset) => set((state) => {
                const newSettings: Partial<ToolSettings> = {
                    fontSize: preset.fontSize,
                    fontWeight: preset.fontWeight,
                    fontFamily: preset.fontFamily,
                    opacity: preset.opacity,
                    fontStyle: preset.fontStyle
                };
                if (preset.color) newSettings.color = preset.color;

                // Update tool preferences
                const newPrefs = { ...state.toolPreferences };
                newPrefs.text = { ...newPrefs.text, ...newSettings };
                return { toolPreferences: newPrefs };
            }),

            addRecentTextStyle: (style) => set((state) => {
                // Check if style already exists at top
                const current = state.recentTextStyles[0];
                if (current &&
                    current.fontSize === style.fontSize &&
                    current.fontFamily === style.fontFamily &&
                    current.fontWeight === style.fontWeight &&
                    current.color === style.color
                ) return {};

                const newRecent = [style, ...state.recentTextStyles].slice(0, 3);
                return { recentTextStyles: newRecent };
            }),

            setPreviewStyle: (style) => set({ previewStyle: style }),

            contextMenu: { isOpen: false, x: 0, y: 0, type: null },

            openContextMenu: (x, y, type, data) => set({
                contextMenu: { isOpen: true, x, y, type, data }
            }),

            closeContextMenu: () => set({
                contextMenu: { isOpen: false, x: 0, y: 0, type: null, data: undefined }
            }),

            isCropping: false,
            setCropping: (isCropping) => set({ isCropping }),

            stagePosition: { x: 0, y: 0 },
            setStagePosition: (pos) => set({ stagePosition: pos }),

            snapToGrid: false,
            gridSize: 20,
            toggleSnapToGrid: () => set(state => ({ snapToGrid: !state.snapToGrid })),
            setGridSize: (gridSize) => set({ gridSize }),

            activePanelTab: 'properties',
            setActivePanelTab: (tab) => set({ activePanelTab: tab }),


            // Native Text Editing
            editingMode: 'standard',
            setEditingMode: (mode) => set({ editingMode: mode, activeNativeTextItem: null }),
            activeNativeTextItem: null,
            setActiveNativeTextItem: (item) => set({ activeNativeTextItem: item }),
            pendingNativeTextEdits: {},
            updateNativeTextEdit: (id, edit) => set(state => ({
                pendingNativeTextEdits: { ...state.pendingNativeTextEdits, [id]: edit }
            })),
            commitNativeTextEdits: () => {
                const { pendingNativeTextEdits, nativeTextStudio } = get();
                const pageId = nativeTextStudio.pageId;
                if (!pageId) return;

                // Commit each edit to the PDF Store
                Object.values(pendingNativeTextEdits).forEach(edit => {
                    // Convert editor's NativeTextItem to PDFStore's NativeTextEdit if needed
                    // They seem compatible based on earlier checks
                    usePDFStore.getState().updateNativeTextEdit(pageId, edit.id, edit);
                });

                // Clear pending edits
                set({ pendingNativeTextEdits: {} });
            },

            nativeTextStudio: {
                isOpen: false,
                pageId: null
            },
            openNativeTextStudio: (pageId) => set({
                nativeTextStudio: { isOpen: true, pageId },
                editingMode: 'native-text' // Ensure mode is set for overlays
            }),
            closeNativeTextStudio: () => set({
                nativeTextStudio: { isOpen: false, pageId: null },
                editingMode: 'standard'
            }),

            // Find & Replace Implementation
            findReplaceState: {
                isOpen: false,
                searchTerm: '',
                replaceTerm: '',
                caseSensitive: false,
                matches: [],
                currentMatchIndex: -1
            },
            setFindReplaceOpen: (isOpen) => set(state => ({
                findReplaceState: { ...state.findReplaceState, isOpen }
            })),
            setSearchTerm: (term) => set(state => ({
                findReplaceState: { ...state.findReplaceState, searchTerm: term }
            })),
            setReplaceTerm: (term) => set(state => ({
                findReplaceState: { ...state.findReplaceState, replaceTerm: term }
            })),
            toggleCaseSensitive: () => set(state => ({
                findReplaceState: { ...state.findReplaceState, caseSensitive: !state.findReplaceState.caseSensitive }
            })),
            findMatches: (textItems) => set(state => {
                const { searchTerm, caseSensitive } = state.findReplaceState;
                if (!searchTerm.trim()) {
                    return { findReplaceState: { ...state.findReplaceState, matches: [], currentMatchIndex: -1 } };
                }
                const matches: { id: string; text: string; startIndex: number; endIndex: number; originalItem: any }[] = [];
                textItems.forEach(item => {
                    const text = item.str || item.text || '';
                    const searchIn = caseSensitive ? text : text.toLowerCase();
                    const searchFor = caseSensitive ? searchTerm : searchTerm.toLowerCase();
                    let idx = searchIn.indexOf(searchFor);
                    while (idx !== -1) {
                        matches.push({
                            id: item.id,
                            text,
                            startIndex: idx,
                            endIndex: idx + searchTerm.length,
                            originalItem: item // Store full original item data
                        });
                        idx = searchIn.indexOf(searchFor, idx + 1);
                    }
                });
                return {
                    findReplaceState: {
                        ...state.findReplaceState,
                        matches,
                        currentMatchIndex: matches.length > 0 ? 0 : -1
                    }
                };
            }),
            navigateMatch: (direction) => set(state => {
                const { matches, currentMatchIndex } = state.findReplaceState;
                if (matches.length === 0) return state;
                let newIndex = currentMatchIndex;
                if (direction === 'next') {
                    newIndex = (currentMatchIndex + 1) % matches.length;
                } else {
                    newIndex = (currentMatchIndex - 1 + matches.length) % matches.length;
                }
                return { findReplaceState: { ...state.findReplaceState, currentMatchIndex: newIndex } };
            }),
            replaceCurrentMatch: () => {
                const state = get();
                const { matches, currentMatchIndex, replaceTerm } = state.findReplaceState;
                if (currentMatchIndex < 0 || currentMatchIndex >= matches.length) return;
                const match = matches[currentMatchIndex];
                const existingEdit = state.pendingNativeTextEdits[match.id];
                const currentText = existingEdit?.text || match.text;
                const newText = currentText.substring(0, match.startIndex) + replaceTerm + currentText.substring(match.endIndex);

                // Get original item properties for proper positioning/styling
                const origItem = match.originalItem;
                const tx = origItem?.originalTransform || origItem?.transform || [1, 0, 0, 1, 0, 0];
                const fontScaleY = Math.abs(tx[3]) || 12;

                const updatedEdit: NativeTextItem = existingEdit
                    ? { ...existingEdit, text: newText, color: existingEdit.color || origItem?.color || '#000000' }
                    : {
                        id: match.id,
                        text: newText,
                        x: tx[4] || 0,
                        y: tx[5] || 0,
                        width: origItem?.width || 100,
                        height: origItem?.height || fontScaleY,
                        fontSize: fontScaleY,
                        fontFamily: origItem?.fontName || 'sans-serif',
                        color: origItem?.color || '#000000',
                        originalRef: origItem,
                        pageId: state.nativeTextStudio.pageId || ''
                    };
                set(s => ({
                    pendingNativeTextEdits: { ...s.pendingNativeTextEdits, [match.id]: updatedEdit },
                    findReplaceState: {
                        ...s.findReplaceState,
                        matches: s.findReplaceState.matches.filter((_, i) => i !== currentMatchIndex),
                        currentMatchIndex: Math.min(currentMatchIndex, s.findReplaceState.matches.length - 2)
                    }
                }));
            },
            replaceAllMatches: () => {
                const state = get();
                const { matches, replaceTerm } = state.findReplaceState;
                if (matches.length === 0) return;
                // Group matches by id and replace from end to start to preserve indices
                const matchesByItem = new Map<string, typeof matches>();
                matches.forEach(m => {
                    if (!matchesByItem.has(m.id)) matchesByItem.set(m.id, []);
                    matchesByItem.get(m.id)!.push(m);
                });
                const newEdits = { ...state.pendingNativeTextEdits };
                matchesByItem.forEach((itemMatches, id) => {
                    // Sort by startIndex descending to replace from end
                    itemMatches.sort((a, b) => b.startIndex - a.startIndex);
                    const existingEdit = newEdits[id];
                    let currentText = existingEdit?.text || itemMatches[0].text;
                    itemMatches.forEach(m => {
                        currentText = currentText.substring(0, m.startIndex) + replaceTerm + currentText.substring(m.endIndex);
                    });

                    // Get original item properties from first match
                    const origItem = itemMatches[0].originalItem;
                    const tx = origItem?.originalTransform || origItem?.transform || [1, 0, 0, 1, 0, 0];
                    const fontScaleY = Math.abs(tx[3]) || 12;

                    newEdits[id] = existingEdit
                        ? { ...existingEdit, text: currentText, color: existingEdit.color || origItem?.color || '#000000' }
                        : {
                            id,
                            text: currentText,
                            x: tx[4] || 0,
                            y: tx[5] || 0,
                            width: origItem?.width || 100,
                            height: origItem?.height || fontScaleY,
                            fontSize: fontScaleY,
                            fontFamily: origItem?.fontName || 'sans-serif',
                            color: origItem?.color || '#000000',
                            originalRef: origItem,
                            pageId: state.nativeTextStudio.pageId || ''
                        };
                });
                set({ pendingNativeTextEdits: newEdits, findReplaceState: { ...state.findReplaceState, matches: [], currentMatchIndex: -1 } });
            },
            clearFindReplace: () => set(state => ({
                findReplaceState: {
                    isOpen: false,
                    searchTerm: '',
                    replaceTerm: '',
                    caseSensitive: false,
                    matches: [],
                    currentMatchIndex: -1
                }
            })),

            // OCR Implementation
            ocrState: {
                isOpen: false,
                isProcessing: false,
                progress: 0,
                result: null,
                error: null
            },
            setOCROpen: (isOpen) => set(state => ({
                ocrState: { ...state.ocrState, isOpen }
            })),
            startOCR: async (imageSource) => {
                set(state => ({
                    ocrState: { ...state.ocrState, isProcessing: true, progress: 0, result: null, error: null }
                }));
                try {
                    const Tesseract = await import('tesseract.js');
                    const worker = await Tesseract.createWorker('eng', 1, {
                        logger: (m: any) => {
                            if (m.status === 'recognizing text') {
                                set(state => ({
                                    ocrState: { ...state.ocrState, progress: Math.round(m.progress * 100) }
                                }));
                            }
                        }
                    });
                    const { data: { text } } = await worker.recognize(imageSource);
                    await worker.terminate();
                    set(state => ({
                        ocrState: { ...state.ocrState, isProcessing: false, progress: 100, result: text }
                    }));
                } catch (error: any) {
                    set(state => ({
                        ocrState: { ...state.ocrState, isProcessing: false, error: error.message || 'OCR failed' }
                    }));
                }
            },
            clearOCRResult: () => set(state => ({
                ocrState: { ...state.ocrState, result: null, error: null, progress: 0 }
            })),
            imageStudio: {
                isOpen: false,
                mode: 'create',
                initialImageSrc: null,
                targetObjectId: null,
                initialEditParams: null
            },
            openImageStudio: (src, objectId, currentParams) => set({
                imageStudio: {
                    isOpen: true,
                    mode: objectId ? 'edit' : 'create',
                    initialImageSrc: src,
                    targetObjectId: objectId || null,
                    initialEditParams: currentParams || null
                }
            }),
            closeImageStudio: () => set(state => ({
                imageStudio: {
                    ...state.imageStudio,
                    isOpen: false,
                    initialImageSrc: null,
                    targetObjectId: null
                }
            })),

            // Text Studio Implementation
            textStudio: {
                isOpen: false,
                mode: 'create',
                elementId: null,
                initialSnapshot: null
            },
            openTextStudio: (mode, elementId, snapshot) => set({
                textStudio: {
                    isOpen: true,
                    mode,
                    elementId: elementId || null,
                    initialSnapshot: snapshot || null
                }
            }),
            closeTextStudio: () => set(state => ({
                textStudio: { ...state.textStudio, isOpen: false, elementId: null, initialSnapshot: null }
            })),


            // Shape Editor Implementation
            shapeEditor: {
                isOpen: false,
                mode: 'add'
            },
            openShapeEditor: (mode) => set({
                shapeEditor: { isOpen: true, mode }
            }),
            closeShapeEditor: () => set(state => ({
                shapeEditor: { ...state.shapeEditor, isOpen: false }
            })),

            editingObjectId: null,
            setEditingObjectId: (id) => set({ editingObjectId: id }),

            initEditor: (page) => {
                // Fetch the LATEST page state from the main store to ensure sync
                // The passed 'page' might be stale if it came from a closure or older render
                const latestPage = usePDFStore.getState().pages.find(p => p.id === page.id) || page;

                // Deep clone the page to ensure isolation
                const pageClone = deepClone(latestPage);
                set({
                    isActive: true,
                    originalPageId: page.id,
                    currentPage: pageClone,
                    history: { past: [], future: [] },
                    selectedObjectIds: [],
                    scale: 1, // Start at 100% or fit? Let's say 1 for now.
                    activeTool: 'select',
                    contextMenu: { isOpen: false, x: 0, y: 0, type: null }
                });
            },

            commit: () => {
                const { originalPageId, currentPage } = get();
                if (originalPageId && currentPage) {
                    // Update the main store
                    usePDFStore.getState().updatePage(originalPageId, currentPage);
                }
                // Close editor
                set({ isActive: false, currentPage: null, originalPageId: null });
            },

            cancel: () => {
                set({ isActive: false, currentPage: null, originalPageId: null });
            },

            setScale: (scale) => set({ scale }),
            setActiveTool: (tool) => set({ activeTool: tool, selectedObjectIds: [] }),

            updateToolSettings: (settings) => set(state => {
                const currentTool = state.activeTool;
                return {
                    toolPreferences: {
                        ...state.toolPreferences,
                        [currentTool]: { ...state.toolPreferences[currentTool], ...settings }
                    }
                };
            }),

            saveToHistory: () => {
                const { currentPage, history } = get();
                if (!currentPage) return;

                const snapshot = deepClone(currentPage);
                const newPast = [...history.past, snapshot].slice(-50);
                set({
                    history: {
                        past: newPast,
                        future: []
                    }
                });
            },

            undo: () => {
                const { history, currentPage } = get();
                if (history.past.length === 0 || !currentPage) return;

                const previous = history.past[history.past.length - 1];
                if (!previous) return; // Stability check

                const newPast = history.past.slice(0, -1);

                set({
                    currentPage: previous,
                    history: { past: newPast, future: [currentPage, ...history.future] }
                });
            },

            redo: () => {
                const { history, currentPage } = get();
                if (history.future.length === 0 || !currentPage) return;

                const next = history.future[0];
                if (!next) return; // Stability check

                const newFuture = history.future.slice(1);

                set({
                    currentPage: next,
                    history: { past: [...history.past, currentPage], future: newFuture }
                });
            },

            addPath: (path) => {
                get().saveToHistory();

                // Convert DrawingPath to PDFObject (mirroring pdfStore logic)
                // Convert DrawingPath to PDFObject
                let newObject: PDFObject;

                // Check if path is already normalized (has valid X/Y/Width/Height)
                if (path.x !== undefined && path.y !== undefined && path.width !== undefined && path.height !== undefined && path.width > 0) {
                    newObject = {
                        id: path.id || `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        type: 'path',
                        x: path.x,
                        y: path.y,
                        width: path.width,
                        height: path.height,
                        points: path.points, // Assumed relative
                        stroke: path.stroke,
                        strokeWidth: path.strokeWidth,
                        opacity: path.opacity,
                        rotation: path.rotation || 0,
                    };
                } else {
                    // Legacy auto-calculation from absolute points
                    const xs = path.points.filter((_, i) => i % 2 === 0);
                    const ys = path.points.filter((_, i) => i % 2 !== 0);
                    const minX = Math.min(...xs);
                    const maxX = Math.max(...xs);
                    const minY = Math.min(...ys);
                    const maxY = Math.max(...ys);

                    const width = maxX - minX;
                    const height = maxY - minY;

                    const normalizedPoints = path.points.map((p, i) => {
                        return i % 2 === 0 ? p - minX : p - minY;
                    });

                    newObject = {
                        id: path.id || `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        type: 'path',
                        x: minX,
                        y: minY,
                        width: width,
                        height: height,
                        points: normalizedPoints,
                        stroke: path.stroke,
                        strokeWidth: path.strokeWidth,
                        opacity: path.opacity,
                        rotation: 0,
                    };
                }

                set(state => {
                    if (!state.currentPage) return state;
                    return {
                        currentPage: {
                            ...state.currentPage,
                            // Add to objects instead of paths. 
                            // We can keep paths array empty or ignore it, 
                            // but let's just not add to it to avoid duplication.
                            objects: [...(state.currentPage.objects || []), newObject],
                            isEdited: true
                        }
                    };
                });
            },

            updateCurrentPage: (updates) => {
                get().saveToHistory();
                set(state => {
                    if (!state.currentPage) return state;
                    return {
                        currentPage: {
                            ...state.currentPage,
                            ...updates
                        }
                    };
                });
            },

            addObject: (object) => {
                get().saveToHistory();
                set(state => {
                    if (!state.currentPage) return state;
                    return {
                        currentPage: {
                            ...state.currentPage,
                            objects: [...(state.currentPage.objects || []), object],
                            isEdited: true
                        }
                    };
                });
                get().selectObject(object.id);
            },

            updateObject: (objectId, updates) => {
                set(state => {
                    if (!state.currentPage) return state;
                    return {
                        currentPage: {
                            ...state.currentPage,
                            objects: state.currentPage.objects.map(obj =>
                                obj.id === objectId ? { ...obj, ...updates } : obj
                            ),
                            isEdited: true
                        }
                    };
                });
            },

            deleteObjects: (objectIds) => {
                get().saveToHistory();
                const ids = new Set(objectIds);
                set(state => {
                    if (!state.currentPage) return state;
                    return {
                        currentPage: {
                            ...state.currentPage,
                            objects: state.currentPage.objects.filter(obj => !ids.has(obj.id))
                        },
                        selectedObjectIds: []
                    };
                });
            },

            setObjects: (objects) => {
                get().saveToHistory();
                set(state => {
                    if (!state.currentPage) return state;
                    return {
                        currentPage: {
                            ...state.currentPage,
                            objects: objects,
                            isEdited: true
                        }
                    };
                });
            },

            reorderObject: (objectId, direction) => {
                get().saveToHistory();
                set(state => {
                    if (!state.currentPage) return state;
                    const objects = [...state.currentPage.objects];
                    const index = objects.findIndex(o => o.id === objectId);
                    if (index === -1) return state;

                    const [start] = objects.splice(index, 1);

                    if (direction === 'front') {
                        objects.push(start);
                    } else if (direction === 'back') {
                        objects.unshift(start);
                    } else if (direction === 'forward') {
                        if (index < objects.length) {
                            objects.splice(index + 1, 0, start);
                        } else {
                            objects.push(start);
                        }
                    } else if (direction === 'backward') {
                        if (index > 0) {
                            objects.splice(index - 1, 0, start);
                        } else {
                            objects.unshift(start);
                        }
                    }

                    return {
                        currentPage: {
                            ...state.currentPage,
                            objects: objects,
                            isEdited: true
                        }
                    };
                });
            },

            selectObject: (objectId, multi = false) => {
                set(state => {
                    if (!state.currentPage) return {};

                    const findGroupMembers = (targetId: string) => {
                        const obj = state.currentPage?.objects.find(o => o.id === targetId);
                        if (obj && obj.groupId) {
                            return state.currentPage?.objects
                                .filter(o => o.groupId === obj.groupId)
                                .map(o => o.id) || [targetId];
                        }
                        return [targetId];
                    };

                    const idsToSelect = findGroupMembers(objectId);

                    if (multi) {
                        const currentSet = new Set(state.selectedObjectIds);
                        // Check if ALL these ids are already selected
                        const allSelected = idsToSelect.every(id => currentSet.has(id));
                        const newSet = new Set(currentSet);

                        if (allSelected) {
                            // Deselect all
                            idsToSelect.forEach(id => newSet.delete(id));
                        } else {
                            // Select all
                            idsToSelect.forEach(id => newSet.add(id));
                        }
                        return { selectedObjectIds: Array.from(newSet) };
                    }

                    return { selectedObjectIds: idsToSelect };
                });
            },

            selectObjects: (objectIds) => {
                set(state => {
                    if (!state.currentPage) return {};

                    const finalIds = new Set<string>();

                    // Optimization: Cache groupIds we've already processed to avoid O(N^2) lookups
                    const processedGroups = new Set<string>();

                    objectIds.forEach(id => {
                        const obj = state.currentPage?.objects.find(o => o.id === id);
                        if (!obj) return;

                        if (obj.groupId) {
                            if (!processedGroups.has(obj.groupId)) {
                                processedGroups.add(obj.groupId);
                                // Add all members of this group
                                const members = state.currentPage?.objects
                                    .filter(o => o.groupId === obj.groupId)
                                    .map(o => o.id);
                                members?.forEach(mid => finalIds.add(mid));
                            }
                        } else {
                            finalIds.add(id);
                        }
                    });

                    return { selectedObjectIds: Array.from(finalIds) };
                });
            },

            duplicateObject: (objectIds) => {
                const { currentPage, saveToHistory } = get();
                if (!currentPage || objectIds.length === 0) return;
                saveToHistory();

                set(state => {
                    if (!state.currentPage) return state;
                    const newObjects = [...state.currentPage.objects];
                    const idsToSelect: string[] = [];

                    objectIds.forEach(id => {
                        const original = newObjects.find(o => o.id === id);
                        if (original) {
                            const newId = `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                            newObjects.push({
                                ...original,
                                id: newId,
                                x: original.x + 20,
                                y: original.y + 20,
                                groupId: undefined // Do not clone group association, fresh clones are ungrouped or need new logic
                            });
                            idsToSelect.push(newId);
                        }
                    });

                    return {
                        currentPage: {
                            ...state.currentPage,
                            objects: newObjects,
                            isEdited: true
                        },
                        selectedObjectIds: idsToSelect
                    };
                });
            },

            clearSelection: () => set({ selectedObjectIds: [] }),

            groupObjects: (objectIds) => {
                const { currentPage, saveToHistory } = get();
                if (!currentPage || objectIds.length < 2) return;
                saveToHistory();

                const objectsToGroup = currentPage.objects.filter(o => objectIds.includes(o.id));
                if (objectsToGroup.length < 2) return;

                // Calculate Bounding Box
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                objectsToGroup.forEach(obj => {
                    const w = obj.width || 0;
                    const h = obj.height || 0;
                    if (obj.x < minX) minX = obj.x;
                    if (obj.y < minY) minY = obj.y;
                    if (obj.x + w > maxX) maxX = obj.x + w;
                    if (obj.y + h > maxY) maxY = obj.y + h;
                });

                if (minX === Infinity) return;

                const groupX = minX;
                const groupY = minY;
                const groupW = maxX - minX;
                const groupH = maxY - minY;

                console.log('[GroupObjects] Creating group:', { groupX, groupY, groupW, groupH });

                const newGroupId = crypto.randomUUID();

                // Create children with relative coordinates
                const children = objectsToGroup.map(obj => {
                    const child = {
                        ...obj, // Use object as is, effectively cloning properties
                        x: obj.x - groupX,
                        y: obj.y - groupY
                    };
                    console.log('[GroupObjects] Child:', { id: obj.id, originalX: obj.x, groupX, relativeX: child.x });
                    return child;
                });

                const newGroup: PDFObject = {
                    id: newGroupId,
                    type: 'group',
                    x: groupX,
                    y: groupY,
                    width: groupW,
                    height: groupH,
                    children: children,
                    rotation: 0,
                    opacity: 1
                };

                // Remove original objects and append the new group
                // We keep items that are NOT in the group
                const remainingObjects = currentPage.objects.filter(o => !objectIds.includes(o.id));
                const newObjects = [...remainingObjects, newGroup];

                set({
                    currentPage: {
                        ...currentPage,
                        objects: newObjects,
                        isEdited: true
                    },
                    selectedObjectIds: [newGroupId]
                });
            },

            ungroupObjects: (objectIds) => {
                const { currentPage, saveToHistory } = get();
                if (!currentPage) return;
                saveToHistory();

                // Get selected groups
                const groups = currentPage.objects.filter(o => objectIds.includes(o.id) && o.type === 'group');
                if (groups.length === 0) return;

                let newObjects = [...currentPage.objects];
                const newSelectedIds: string[] = [];

                groups.forEach(group => {
                    if (!group.children || group.children.length === 0) {
                        // Empty group, just remove
                        newObjects = newObjects.filter(o => o.id !== group.id);
                        return;
                    }

                    // Remove the group itself
                    newObjects = newObjects.filter(o => o.id !== group.id);

                    // Restore children to the main layer
                    group.children.forEach(child => {
                        // Restore absolute position
                        // Simple translation for now (assuming group rotation is 0 or handled basic)
                        const absX = child.x + group.x;
                        const absY = child.y + group.y;

                        const restoredObj = {
                            ...child,
                            x: absX,
                            y: absY,
                            rotation: (child.rotation || 0) + (group.rotation || 0)
                        };
                        newObjects.push(restoredObj);
                        newSelectedIds.push(restoredObj.id);
                    });
                });

                set({
                    currentPage: {
                        ...currentPage,
                        objects: newObjects,
                        isEdited: true
                    },
                    selectedObjectIds: newSelectedIds
                });
            },

            copySelection: () => {
                const { currentPage, selectedObjectIds } = get();
                if (!currentPage || selectedObjectIds.length === 0) return;

                const selected = currentPage.objects.filter(o => selectedObjectIds.includes(o.id));
                // Deep clone for clipboard to detach references
                set({ clipboard: deepClone(selected) });
            },

            pasteClipboard: () => {
                const { clipboard, currentPage } = get();
                if (!currentPage || clipboard.length === 0) return;

                get().saveToHistory();

                const newObjects = clipboard.map(obj => {
                    const newId = crypto.randomUUID();
                    return {
                        ...deepClone(obj),
                        id: newId,
                        x: obj.x + 20,
                        y: obj.y + 20,
                        isNew: true // Optional flag for animations
                    };
                });

                set(state => ({
                    currentPage: {
                        ...state.currentPage!,
                        objects: [...(state.currentPage!.objects || []), ...newObjects]
                    },
                    selectedObjectIds: newObjects.map(o => o.id)
                }));
            }
        })
    )
);
