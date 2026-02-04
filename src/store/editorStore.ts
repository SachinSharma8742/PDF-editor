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
    textAlign: 'left' | 'center' | 'right';
    eraserMode: 'standard' | 'object';
    smartShapeMode?: boolean;
    sides?: number;
    innerRadiusRatio?: number;
    dash?: number[];
}

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
    'sticky-note': { ...DEFAULT_SETTINGS, color: '#fef08a' },
    'callout': { ...DEFAULT_SETTINGS, color: '#000000', size: 14 }
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
    saveToHistory: () => void;

    // Eyedropper / Color Memory
    recentColors: string[];
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

    // Grid Snap
    snapToGrid: boolean;
    gridSize: number;
    toggleSnapToGrid: () => void;
    setGridSize: (size: number) => void;

    // UI Panel State
    activePanelTab: 'properties' | 'layers' | 'export';
    setActivePanelTab: (tab: 'properties' | 'layers' | 'export') => void;


    // Clipboard
    clipboard: any[]; // Array of PDFObject
    copySelection: () => void;
    pasteClipboard: () => void;

    updateCurrentPage: (updates: Partial<PageState>) => void;
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
            clipboard: [],

            history: { past: [], future: [] },

            addColorToHistory: (color) => set(state => {
                const newRecent = [color, ...state.recentColors.filter(c => c !== color)].slice(0, 9);
                return { recentColors: newRecent };
            }),

            contextMenu: { isOpen: false, x: 0, y: 0, type: null },

            openContextMenu: (x, y, type, data) => set({
                contextMenu: { isOpen: true, x, y, type, data }
            }),

            closeContextMenu: () => set({
                contextMenu: { isOpen: false, x: 0, y: 0, type: null, data: undefined }
            }),

            isCropping: false,
            setCropping: (isCropping) => set({ isCropping }),

            snapToGrid: false,
            gridSize: 20,
            toggleSnapToGrid: () => set(state => ({ snapToGrid: !state.snapToGrid })),
            setGridSize: (gridSize) => set({ gridSize }),

            activePanelTab: 'properties',
            setActivePanelTab: (tab) => set({ activePanelTab: tab }),

            initEditor: (page) => {
                // Deep clone the page to ensure isolation
                const pageClone = deepClone(page);
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
                            objects: [...state.currentPage.objects, newObject],
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

                const newGroupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                set(state => {
                    if (!state.currentPage) return state;
                    return {
                        currentPage: {
                            ...state.currentPage,
                            objects: state.currentPage.objects.map(obj =>
                                objectIds.includes(obj.id) ? { ...obj, groupId: newGroupId } : obj
                            ),
                            isEdited: true
                        },
                        selectedObjectIds: objectIds // Keep selected
                    };
                });
            },

            ungroupObjects: (objectIds) => {
                const { currentPage, saveToHistory } = get();
                if (!currentPage) return;
                saveToHistory();

                // Find groups involved in selection
                const groupsToUngroup = new Set<string>();
                currentPage.objects.forEach(obj => {
                    if (objectIds.includes(obj.id) && obj.groupId) {
                        groupsToUngroup.add(obj.groupId);
                    }
                });

                if (groupsToUngroup.size === 0) return;

                set(state => {
                    if (!state.currentPage) return state;
                    return {
                        currentPage: {
                            ...state.currentPage,
                            objects: state.currentPage.objects.map(obj =>
                                obj.groupId && groupsToUngroup.has(obj.groupId) ? { ...obj, groupId: undefined } : obj
                            ),
                            isEdited: true
                        }
                    };
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
                        objects: [...state.currentPage!.objects, ...newObjects]
                    },
                    selectedObjectIds: newObjects.map(o => o.id)
                }));
            }
        })
    )
);
