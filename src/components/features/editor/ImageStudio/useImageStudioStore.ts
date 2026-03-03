import { create } from 'zustand';

export interface ImageEditParams {
    brightness: number;
    contrast: number;
    saturation: number;
    exposure: number;
    temperature: number;
    tint: number;
    // blur removed
    noise: number; // Add noise
    upscaleFactor: number; // 1 or 2
    grayscale: number;
    invert: number;
    sepia: number;
    rotation: number;
    flipX: boolean;
    flipY: boolean;
    crop?: { x: number; y: number; width: number; height: number };
    cropShape?: 'rect' | 'circle' | 'heart';
    bgRemovalFeather: number;
    bgRemovalThreshold: number;
    maskExpand: number;
    maskSoftEdge: number;
}

export const DEFAULT_EDIT_PARAMS: ImageEditParams = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    exposure: 0,
    temperature: 0,
    tint: 0,
    noise: 0,
    upscaleFactor: 1,
    grayscale: 0,
    invert: 0,
    sepia: 0,
    rotation: 0,
    flipX: false,
    flipY: false,
    crop: undefined,
    cropShape: 'rect',
    bgRemovalFeather: 0,
    bgRemovalThreshold: 128,
    maskExpand: 0,
    maskSoftEdge: 0,
};

// New Engine State Models
export interface ImageOperations {
    transform: {
        rotate: number;
        flipX: boolean;
        flipY: boolean;
        crop?: { x: number; y: number; width: number; height: number };
        cropShape?: 'rect' | 'circle' | 'heart';
    };
    cleanup: {
        deskew: boolean;
        backgroundRemoved: boolean;
        scanRepair: boolean;
    };

    enhance: {
        upscale: boolean; // Only upscale here now
        upscaleFactor: number;
    };
    adjust: {
        brightness: number;
        contrast: number;
        saturation: number;
    };
    effects: {
        grayscale: boolean;
        sepia: boolean;
        invert: boolean;
        noise: number; // Add noise
        // blur REMOVED
    };
}

export interface ImagePipelineCache {
    transformed?: ImageBitmap;
    // Cache invalidation key for transform
    transformOps?: ImageOperations['transform'];
    cleaned?: ImageBitmap;
    // Cache invalidation key for cleanup
    cleanupOps?: ImageOperations['cleanup'];

    enhanced?: ImageBitmap;
    enhancedOps?: ImageOperations['enhance'];
}

export const DEFAULT_OPERATIONS: ImageOperations = {
    transform: { rotate: 0, flipX: false, flipY: false },
    cleanup: { deskew: false, backgroundRemoved: false, scanRepair: false },
    enhance: { upscale: false, upscaleFactor: 1 },
    adjust: { brightness: 0, contrast: 0, saturation: 0 },
    effects: { grayscale: false, sepia: false, invert: false, noise: 0 }
};

export interface ImageStudioStore {
    params: ImageEditParams;

    // New Engine State
    operations: ImageOperations;
    pipelineCache: ImagePipelineCache;
    sourceBitmap?: ImageBitmap;

    activeTab: 'transform' | 'adjust' | 'effects' | 'crop' | 'tools';
    dimensions: { width: number; height: number };

    // Crop Mode State
    isCropMode: boolean;
    transformBeforeEdit: ImageOperations['transform'] | null; // snapshot for cancel
    setCropMode: (active: boolean) => void;
    applyCrop: () => void;
    cancelCrop: () => void;

    // History State
    history: {
        past: ImageOperations[];
        future: ImageOperations[];
    };

    // Actions
    setParam: <K extends keyof ImageEditParams>(key: K, value: ImageEditParams[K]) => void;

    // New Engine Actions
    setOperation: <K extends keyof ImageOperations>(
        category: K,
        params: Partial<ImageOperations[K]>
    ) => void;
    setSourceBitmap: (bitmap: ImageBitmap) => void;

    resetParams: () => void;
    setAllParams: (params: ImageEditParams) => void;
    setActiveTab: (tab: ImageStudioStore['activeTab']) => void;
    setDimensions: (width: number, height: number) => void;

    // History Actions
    pushHistory: () => void;
    undo: () => void;
    redo: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;
    applyPreset: (ops: Partial<ImageOperations>) => void;
}

export const useImageStudioStore = create<ImageStudioStore>((set, get) => ({
    params: { ...DEFAULT_EDIT_PARAMS },

    // New Engine Defaults
    operations: JSON.parse(JSON.stringify(DEFAULT_OPERATIONS)), // Deep copy to avoid ref issues
    pipelineCache: {},
    sourceBitmap: undefined,

    activeTab: 'transform',
    dimensions: { width: 0, height: 0 },

    // Crop Mode
    isCropMode: false,
    transformBeforeEdit: null,

    setCropMode: (active) => {
        if (active) {
            const { operations, params, dimensions, pushHistory } = get();
            pushHistory(); // Save state before entering crop mode

            // Snapshot current TRANSFORM state (deep copy)
            const transformSnapshot = JSON.parse(JSON.stringify(operations.transform));

            // If no crop exists, initialize to full image
            if (!params.crop) {
                const imgW = dimensions.width || 1000;
                const imgH = dimensions.height || 1000;
                const fullCrop = { x: 0, y: 0, width: imgW, height: imgH };

                set(state => ({
                    isCropMode: true,
                    transformBeforeEdit: transformSnapshot,
                    activeTab: 'crop' as const,
                    params: { ...state.params, crop: fullCrop },
                    operations: {
                        ...state.operations,
                        transform: { ...state.operations.transform, crop: fullCrop }
                    }
                }));
            } else {
                set({
                    isCropMode: true,
                    transformBeforeEdit: transformSnapshot,
                    activeTab: 'crop' as const
                });
            }
        } else {
            set({ isCropMode: false });
        }
    },

    applyCrop: () => {
        // Crop values are already in operations.transform.crop via setParam
        // Just exit crop mode
        set({ isCropMode: false, activeTab: 'transform' as const });
    },

    cancelCrop: () => {
        const { transformBeforeEdit } = get();
        if (!transformBeforeEdit) {
            set({ isCropMode: false, activeTab: 'transform' as const });
            return;
        }

        set(state => {
            const restoredOps = {
                ...state.operations,
                transform: JSON.parse(JSON.stringify(transformBeforeEdit))
            };

            const restoredParams = { ...state.params };
            // Sync params from restored transform
            restoredParams.rotation = transformBeforeEdit.rotate;
            restoredParams.flipX = transformBeforeEdit.flipX;
            restoredParams.flipY = transformBeforeEdit.flipY;
            restoredParams.crop = transformBeforeEdit.crop;
            restoredParams.cropShape = transformBeforeEdit.cropShape || 'rect';

            return {
                isCropMode: false,
                activeTab: 'transform' as const,
                params: restoredParams,
                operations: restoredOps
            };
        });
    },

    history: { past: [], future: [] },

    setParam: (key, value) => set(state => {
        const newParams = { ...state.params, [key]: value };
        const newOperations = {
            ...state.operations,
            transform: { ...state.operations.transform },
            adjust: { ...state.operations.adjust },
            effects: { ...state.operations.effects },
            enhance: { ...state.operations.enhance },
            cleanup: { ...state.operations.cleanup },
        };

        // Sync to Operations

        // Transform
        if (key === 'rotation') newOperations.transform.rotate = value as number;
        if (key === 'flipX') newOperations.transform.flipX = value as boolean;
        if (key === 'flipY') newOperations.transform.flipY = value as boolean;
        if (key === 'crop') newOperations.transform.crop = (value as ImageEditParams['crop']) || undefined;
        if (key === 'cropShape') newOperations.transform.cropShape = (value as ImageEditParams['cropShape']) || 'rect';



        // Adjust
        if (key === 'brightness') newOperations.adjust.brightness = value as number;
        if (key === 'contrast') newOperations.adjust.contrast = value as number;
        if (key === 'saturation') newOperations.adjust.saturation = value as number;

        // Effects
        if (key === 'grayscale') newOperations.effects.grayscale = !!value;
        if (key === 'sepia') newOperations.effects.sepia = !!value;
        if (key === 'invert') newOperations.effects.invert = !!value;
        if (key === 'noise') newOperations.effects.noise = value as number;
        if (key === 'upscaleFactor') {
            newOperations.enhance.upscaleFactor = value as number;
            // Also toggle boolean for UI convenience if needed, or rely on factor
            newOperations.enhance.upscale = (value as number) > 1;
        }
        // blur REMOVED

        return {
            params: newParams,
            operations: newOperations
        };
    }),

    setOperation: (category, params) => set(state => ({
        operations: {
            ...state.operations,
            [category]: { ...state.operations[category], ...params }
        }
    })),

    setSourceBitmap: (bitmap) => set({ sourceBitmap: bitmap }),

    resetParams: () => set({
        params: { ...DEFAULT_EDIT_PARAMS },
        operations: JSON.parse(JSON.stringify(DEFAULT_OPERATIONS)),
        pipelineCache: {},
        history: { past: [], future: [] }
    }),

    setAllParams: (params) => set(() => {
        // Full Sync from Params -> Operations
        const newOperations = JSON.parse(JSON.stringify(DEFAULT_OPERATIONS));

        // Transform
        newOperations.transform.rotate = params.rotation;
        newOperations.transform.flipX = params.flipX;
        newOperations.transform.flipY = params.flipY;
        if (params.crop) newOperations.transform.crop = params.crop;
        if (params.cropShape) newOperations.transform.cropShape = params.cropShape;



        // Adjust
        newOperations.adjust.brightness = Math.max(-1, Math.min(1, params.brightness));
        newOperations.adjust.contrast = Math.max(-1, Math.min(1, params.contrast));
        newOperations.adjust.saturation = Math.max(-1, Math.min(1, params.saturation));

        // Effects
        newOperations.effects.grayscale = !!params.grayscale;
        newOperations.effects.sepia = !!params.sepia;
        newOperations.effects.invert = !!params.invert;
        newOperations.effects.noise = params.noise;

        // Enhance
        newOperations.enhance.upscaleFactor = params.upscaleFactor || 1;
        newOperations.enhance.upscale = (params.upscaleFactor || 1) > 1;
        // blur removed

        return {
            params: { ...params },
            operations: newOperations
        };
    }),

    setActiveTab: (tab) => set({ activeTab: tab }),

    setDimensions: (width, height) => set({ dimensions: { width, height } }),

    // -- History Implementation --

    pushHistory: () => {
        const { operations, history } = get();
        const newPast = [...history.past, JSON.parse(JSON.stringify(operations))];
        if (newPast.length > 50) newPast.shift();

        set({
            history: {
                past: newPast,
                future: []
            }
        });
    },

    applyPreset: (presetOps) => {
        const { operations, history } = get();

        // 1. Snapshot History
        const newPast = [...history.past, JSON.parse(JSON.stringify(operations))];
        if (newPast.length > 50) newPast.shift();

        set({ history: { past: newPast, future: [] } });

        // 2. Merge Operations
        const newOps = JSON.parse(JSON.stringify(operations));

        if (presetOps.transform) {
            newOps.transform = { ...newOps.transform, ...presetOps.transform };
        }
        if (presetOps.cleanup) {
            newOps.cleanup = { ...newOps.cleanup, ...presetOps.cleanup };
        }

        if (presetOps.enhance) {
            newOps.enhance = { ...newOps.enhance, ...presetOps.enhance };
        }
        if (presetOps.adjust) {
            newOps.adjust = { ...newOps.adjust, ...presetOps.adjust };
        }
        if (presetOps.effects) {
            newOps.effects = { ...newOps.effects, ...presetOps.effects };
        }

        // 3. Validate / Clamp
        newOps.adjust.brightness = Math.max(-1, Math.min(1, newOps.adjust.brightness));
        newOps.adjust.contrast = Math.max(-1, Math.min(1, newOps.adjust.contrast));
        newOps.adjust.saturation = Math.max(-1, Math.min(1, newOps.adjust.saturation));

        // 4. Sync Params (UI)
        set({ operations: newOps });
        const state = get();
        const newParams = { ...state.params };

        // Adjust
        newParams.brightness = newOps.adjust.brightness;
        newParams.contrast = newOps.adjust.contrast;
        newParams.saturation = newOps.adjust.saturation;



        // Transform
        if (newOps.transform.rotate !== undefined) newParams.rotation = newOps.transform.rotate;
        if (newOps.transform.cropShape) newParams.cropShape = newOps.transform.cropShape;

        // Effects
        newParams.grayscale = newOps.effects.grayscale ? 1 : 0;
        newParams.sepia = newOps.effects.sepia ? 1 : 0;
        newParams.invert = newOps.effects.invert ? 1 : 0;
        newParams.noise = newOps.effects.noise;

        // Enhance
        newParams.upscaleFactor = newOps.enhance.upscaleFactor;

        set({ params: newParams });
    },

    undo: () => {
        const { history, operations } = get();
        if (history.past.length === 0) return;

        const previous = history.past[history.past.length - 1];
        const newPast = history.past.slice(0, -1);

        set({
            operations: previous,
            history: {
                past: newPast,
                future: [JSON.parse(JSON.stringify(operations)), ...history.future]
            }
        });

        // Sync Params
        const state = get();
        const newParams = { ...state.params };

        // Transform
        newParams.rotation = previous.transform.rotate;
        newParams.flipX = previous.transform.flipX;
        newParams.flipY = previous.transform.flipY;
        newParams.flipY = previous.transform.flipY;
        newParams.crop = previous.transform.crop;
        newParams.cropShape = previous.transform.cropShape || 'rect';



        // Adjust
        newParams.brightness = previous.adjust.brightness;
        newParams.contrast = previous.adjust.contrast;
        newParams.saturation = previous.adjust.saturation;

        // Effects
        newParams.grayscale = previous.effects.grayscale ? 1 : 0;
        newParams.sepia = previous.effects.sepia ? 1 : 0;
        newParams.invert = previous.effects.invert ? 1 : 0;
        newParams.noise = previous.effects.noise;
        newParams.upscaleFactor = previous.enhance.upscaleFactor;

        set({ params: newParams });
    },

    redo: () => {
        const { history, operations } = get();
        if (history.future.length === 0) return;

        const next = history.future[0];
        const newFuture = history.future.slice(1);

        set({
            operations: next,
            history: {
                past: [...history.past, JSON.parse(JSON.stringify(operations))],
                future: newFuture
            }
        });

        // Sync Params
        const state = get();
        const newParams = { ...state.params };

        newParams.rotation = next.transform.rotate;
        newParams.flipX = next.transform.flipX;
        newParams.flipY = next.transform.flipY;
        newParams.flipY = next.transform.flipY;
        newParams.crop = next.transform.crop;
        newParams.cropShape = next.transform.cropShape || 'rect';



        newParams.brightness = next.adjust.brightness;
        newParams.contrast = next.adjust.contrast;
        newParams.saturation = next.adjust.saturation;

        newParams.grayscale = next.effects.grayscale ? 1 : 0;
        newParams.sepia = next.effects.sepia ? 1 : 0;
        newParams.invert = next.effects.invert ? 1 : 0;
        newParams.noise = next.effects.noise;
        newParams.upscaleFactor = next.enhance.upscaleFactor;

        set({ params: newParams });
    },

    canUndo: () => get().history.past.length > 0,
    canRedo: () => get().history.future.length > 0,
}));
