import { create } from 'zustand';

export interface CompressionMetricsState {
    imageBytesRemoved: number;
    metadataBytesRemoved: number;
    streamsBytesRemoved: number;
    timeElapsed: number;
}

interface CompressionState {
    isCompressing: boolean;
    progress: number;
    currentPage: number;
    totalPages: number;

    originalSize: number;
    compressedSize: number;
    ratio: number;

    estimatedTimeRemainingMs: number;
    error: string | null;

    metrics: CompressionMetricsState;
}

interface StartCompressionPayload {
    totalPages: number;
    originalSize: number;
}

interface UpdateProgressPayload {
    progress: number;
    currentPage: number;
    totalPages: number;
    estimatedTimeRemainingMs?: number;
}

interface CompleteCompressionPayload {
    compressedSize: number;
    ratio: number;
    metrics: CompressionMetricsState;
    timeElapsed: number;
}

interface CompressionStore extends CompressionState {
    startCompression: (payload: StartCompressionPayload) => void;
    updateProgress: (payload: UpdateProgressPayload) => void;
    completeCompression: (payload: CompleteCompressionPayload) => void;
    failCompression: (error: string) => void;
    resetCompression: () => void;
}

const initialState: CompressionState = {
    isCompressing: false,
    progress: 0,
    currentPage: 0,
    totalPages: 0,

    originalSize: 0,
    compressedSize: 0,
    ratio: 0,

    estimatedTimeRemainingMs: 0,
    error: null,

    metrics: {
        imageBytesRemoved: 0,
        metadataBytesRemoved: 0,
        streamsBytesRemoved: 0,
        timeElapsed: 0,
    },
};

export const useCompressionStore = create<CompressionStore>((set) => ({
    ...initialState,

    startCompression: ({ totalPages, originalSize }) => set({
        isCompressing: true,
        progress: 0,
        currentPage: 0,
        totalPages,
        originalSize,
        compressedSize: 0,
        ratio: 0,
        estimatedTimeRemainingMs: 0,
        error: null,
        metrics: {
            imageBytesRemoved: 0,
            metadataBytesRemoved: 0,
            streamsBytesRemoved: 0,
            timeElapsed: 0,
        },
    }),

    updateProgress: ({ progress, currentPage, totalPages, estimatedTimeRemainingMs = 0 }) => set({
        progress,
        currentPage,
        totalPages,
        estimatedTimeRemainingMs,
    }),

    completeCompression: ({ compressedSize, ratio, metrics, timeElapsed }) => set((state) => ({
        isCompressing: false,
        progress: 100,
        currentPage: state.totalPages,
        compressedSize,
        ratio,
        metrics: {
            ...metrics,
            timeElapsed,
        },
        estimatedTimeRemainingMs: 0,
        error: null,
    })),

    failCompression: (error) => set({
        isCompressing: false,
        error,
    }),

    resetCompression: () => set(initialState),
}));
