import { create } from 'zustand';

export interface ImageEditParams {
    brightness: number;
    contrast: number;
    saturation: number;
    exposure: number;
    temperature: number;
    tint: number;
    blur: number;
    sharpen: number;
    vignette: number;
    noise: number;
    grayscale: number;
    invert: number;
    sepia: number;
    rotation: number;
    flipX: boolean;
    flipY: boolean;
    crop: { x: number; y: number; width: number; height: number } | null;
}

export const DEFAULT_EDIT_PARAMS: ImageEditParams = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    exposure: 0,
    temperature: 0,
    tint: 0,
    blur: 0,
    sharpen: 0, // Unsharp mask logic
    vignette: 0,
    noise: 0,
    grayscale: 0,
    invert: 0,
    sepia: 0,
    rotation: 0,
    flipX: false,
    flipY: false,
    crop: null
};

interface ImageStudioStore {
    params: ImageEditParams;
    activeTab: 'adjust' | 'filter' | 'effects' | 'crop' | 'mask' | 'settings';

    // Actions
    setParam: (key: keyof ImageEditParams, value: any) => void;
    resetParams: () => void;
    setAllParams: (params: ImageEditParams) => void;
    setActiveTab: (tab: ImageStudioStore['activeTab']) => void;
}

export const useImageStudioStore = create<ImageStudioStore>((set) => ({
    params: { ...DEFAULT_EDIT_PARAMS },
    activeTab: 'adjust',

    setParam: (key, value) => set(state => ({
        params: { ...state.params, [key]: value }
    })),

    resetParams: () => set({ params: { ...DEFAULT_EDIT_PARAMS } }),

    setAllParams: (params) => set({ params: { ...params } }),

    setActiveTab: (tab) => set({ activeTab: tab })
}));
