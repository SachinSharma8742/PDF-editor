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

interface ToolSettings {
    color: string;
    size: number;
    opacity: number;
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    fontStyle: string;
}

const DEFAULT_SETTINGS: ToolSettings = {
    color: '#000000',
    size: 2,
    opacity: 1,
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: 'normal',
    fontStyle: 'normal'
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
    arrow: { ...DEFAULT_SETTINGS, color: '#000000' },
    line: { ...DEFAULT_SETTINGS, color: '#000000' },
    image: { ...DEFAULT_SETTINGS },
    stamp: { ...DEFAULT_SETTINGS },
    signature: { ...DEFAULT_SETTINGS }
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

    history: EditorHistory;

    // Actions
    initEditor: (page: PageState) => void;
    commit: () => void; // Save back to main store
    cancel: () => void; // Discard changes

    setScale: (scale: number) => void;
    setActiveTool: (tool: ToolType) => void;
    updateToolSettings: (settings: Partial<ToolSettings>) => void;

    // Content Actions (Mirrors pdfStore but for local currentPage)
    addPath: (path: DrawingPath) => void;
    addObject: (object: PDFObject) => void;
    updateObject: (objectId: string, updates: Partial<PDFObject>) => void;
    deleteObjects: (objectIds: string[]) => void;

    // Selection
    selectObject: (objectId: string, multi?: boolean) => void;
    selectObjects: (objectIds: string[]) => void;
    clearSelection: () => void;

    // History
    undo: () => void;
    redo: () => void;
    saveToHistory: () => void;
}

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
            history: { past: [], future: [] },

            initEditor: (page) => {
                // Deep clone the page to ensure isolation
                const pageClone = JSON.parse(JSON.stringify(page));
                set({
                    isActive: true,
                    originalPageId: page.id,
                    currentPage: pageClone,
                    history: { past: [], future: [] },
                    selectedObjectIds: [],
                    scale: 1, // Start at 100% or fit? Let's say 1 for now.
                    activeTool: 'select'
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

                const snapshot = JSON.parse(JSON.stringify(currentPage));
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
                const newFuture = history.future.slice(1);

                set({
                    currentPage: next,
                    history: { past: [...history.past, currentPage], future: newFuture }
                });
            },

            addPath: (path) => {
                get().saveToHistory();
                set(state => {
                    if (!state.currentPage) return state;
                    return {
                        currentPage: {
                            ...state.currentPage,
                            paths: [...state.currentPage.paths, path],
                            isEdited: true
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
                            objects: [...state.currentPage.objects, object],
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

            selectObject: (objectId, multi = false) => {
                set(state => {
                    const idsToSelect = [objectId].filter(Boolean); // Simple select for now, group logic can be added later if reused
                    if (multi) {
                        const currentSet = new Set(state.selectedObjectIds);
                        if (currentSet.has(objectId)) currentSet.delete(objectId);
                        else currentSet.add(objectId);
                        return { selectedObjectIds: Array.from(currentSet) };
                    }
                    return { selectedObjectIds: idsToSelect };
                });
            },

            selectObjects: (objectIds) => {
                set({ selectedObjectIds: objectIds });
            },

            clearSelection: () => set({ selectedObjectIds: [] }),
        })
    )
);
