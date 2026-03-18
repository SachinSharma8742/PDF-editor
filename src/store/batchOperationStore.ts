import { create } from 'zustand';

export type BatchOperationType = 'watermark' | 'remove-watermark' | 'text-color' | 'redact' | 'rotate' | null;

interface BatchOperationState {
    isRunning: boolean;
    operationType: BatchOperationType;
    currentPage: number;
    totalPages: number;
    done: boolean;
    error: string | null;
}

interface BatchOperationStore extends BatchOperationState {
    start: (operationType: NonNullable<BatchOperationType>, totalPages: number) => void;
    updateProgress: (currentPage: number) => void;
    finish: () => void;
    setError: (error: string) => void;
    reset: () => void;
}

const initialState: BatchOperationState = {
    isRunning: false,
    operationType: null,
    currentPage: 0,
    totalPages: 0,
    done: false,
    error: null,
};

export const useBatchOperationStore = create<BatchOperationStore>((set) => ({
    ...initialState,
    start: (operationType, totalPages) =>
        set({ isRunning: true, operationType, currentPage: 0, totalPages, done: false, error: null }),
    updateProgress: (currentPage) => set({ currentPage }),
    finish: () => set({ isRunning: false, done: true }),
    setError: (error) => set({ isRunning: false, error }),
    reset: () => set(initialState),
}));
