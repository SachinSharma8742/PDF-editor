import { create } from 'zustand';

export type BatchOperationType = 'watermark' | 'remove-watermark' | 'text-color' | 'redact' | 'rotate' | null;
type BatchOperationStatus = 'running' | 'completed' | 'failed';

interface BatchOperationHistoryItem {
    id: string;
    task: string;
    status: BatchOperationStatus;
    progress: number;
    total: number;
    error?: string;
    startedAt: number;
    finishedAt?: number;
}

interface BatchOperationState {
    currentTask: string | null;
    isProcessing: boolean;
    history: BatchOperationHistoryItem[];

    isRunning: boolean;
    operationType: BatchOperationType;
    currentPage: number;
    totalPages: number;
    done: boolean;
    error: string | null;
    lastUpdatedAt: number | null;
    targetPages: number[];
}

interface BatchOperationStore extends BatchOperationState {
    startBatchOperation: (task: string, total?: number) => void;
    updateProgress: (progress: number, total?: number) => void;
    completeBatchOperation: () => void;
    failBatchOperation: (error: string) => void;

    startOperation: (operationType: NonNullable<BatchOperationType>, totalPages: number, targetPages?: number[]) => void;
    setProgress: (currentPage: number) => void;
    completeOperation: () => void;
    failOperation: (error: string) => void;
    resetOperation: () => void;

    // Backward-compatible action names.
    start: (operationType: NonNullable<BatchOperationType>, totalPages: number) => void;
    finish: () => void;
    setError: (error: string) => void;
    reset: () => void;
}

const initialState: BatchOperationState = {
    currentTask: null,
    isProcessing: false,
    history: [],

    isRunning: false,
    operationType: null,
    currentPage: 0,
    totalPages: 0,
    done: false,
    error: null,
    lastUpdatedAt: null,
    targetPages: [],
};

export const useBatchOperationStore = create<BatchOperationStore>((set) => ({
    ...initialState,
    startBatchOperation: (task, total = 0) => {
        const startedAt = Date.now();
        set((state) => ({
            currentTask: task,
            isProcessing: true,
            isRunning: true,
            operationType: null,
            currentPage: 0,
            totalPages: total,
            done: false,
            error: null,
            lastUpdatedAt: startedAt,
            history: [
                {
                    id: crypto.randomUUID(),
                    task,
                    status: 'running' as const,
                    progress: 0,
                    total,
                    startedAt,
                },
                ...state.history,
            ].slice(0, 30),
        }));
    },
    updateProgress: (progress, total) => {
        set((state) => {
            const nextTotal = typeof total === 'number' ? total : state.totalPages;
            const normalizedProgress = Math.max(0, progress);
            const updatedHistory = [...state.history];
            const activeIndex = updatedHistory.findIndex((item) => item.status === 'running');
            if (activeIndex >= 0) {
                updatedHistory[activeIndex] = {
                    ...updatedHistory[activeIndex],
                    progress: normalizedProgress,
                    total: nextTotal,
                };
            }

            return {
                currentPage: normalizedProgress,
                totalPages: nextTotal,
                lastUpdatedAt: Date.now(),
                history: updatedHistory,
            };
        });
    },
    completeBatchOperation: () => {
        set((state) => {
            const finishedAt = Date.now();
            const updatedHistory = [...state.history];
            const activeIndex = updatedHistory.findIndex((item) => item.status === 'running');
            if (activeIndex >= 0) {
                const item = updatedHistory[activeIndex];
                updatedHistory[activeIndex] = {
                    ...item,
                    status: 'completed',
                    progress: item.total || state.totalPages,
                    finishedAt,
                };
            }

            return {
                currentTask: state.currentTask,
                isProcessing: false,
                isRunning: false,
                done: true,
                currentPage: state.totalPages,
                lastUpdatedAt: finishedAt,
                history: updatedHistory,
            };
        });
    },
    failBatchOperation: (error) => {
        set((state) => {
            const finishedAt = Date.now();
            const updatedHistory = [...state.history];
            const activeIndex = updatedHistory.findIndex((item) => item.status === 'running');
            if (activeIndex >= 0) {
                updatedHistory[activeIndex] = {
                    ...updatedHistory[activeIndex],
                    status: 'failed',
                    error,
                    finishedAt,
                };
            }

            return {
                isProcessing: false,
                isRunning: false,
                done: false,
                error,
                lastUpdatedAt: finishedAt,
                history: updatedHistory,
            };
        });
    },

    startOperation: (operationType, totalPages, targetPages = []) =>
        set({
            currentTask: operationType,
            isProcessing: true,
            isRunning: true,
            operationType,
            currentPage: 0,
            totalPages,
            done: false,
            error: null,
            lastUpdatedAt: Date.now(),
            targetPages,
        }),
    setProgress: (currentPage) =>
        set({
            currentPage,
            lastUpdatedAt: Date.now(),
        }),
    completeOperation: () =>
        set((state) => ({
            isProcessing: false,
            isRunning: false,
            done: true,
            currentPage: state.totalPages,
            lastUpdatedAt: Date.now(),
        })),
    failOperation: (error) =>
        set({
            isProcessing: false,
            isRunning: false,
            error,
            done: false,
            lastUpdatedAt: Date.now(),
        }),
    resetOperation: () => set(initialState),

    start: (operationType, totalPages) =>
        set({
            currentTask: operationType,
            isProcessing: true,
            isRunning: true,
            operationType,
            currentPage: 0,
            totalPages,
            done: false,
            error: null,
            lastUpdatedAt: Date.now(),
            targetPages: [],
        }),
    finish: () => set((state) => ({ isProcessing: false, isRunning: false, done: true, currentPage: state.totalPages, lastUpdatedAt: Date.now() })),
    setError: (error) => set({ isProcessing: false, isRunning: false, error, done: false, lastUpdatedAt: Date.now() }),
    reset: () => set(initialState),
}));
