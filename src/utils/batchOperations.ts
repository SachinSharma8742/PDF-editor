import type { PageState, PDFObject } from '../store/pdfStore';
import { usePDFStore } from '../store/pdfStore';
import { useBatchOperationStore } from '../store/batchOperationStore';
import {
    searchInPDF,
    replaceText,
    type SearchResult,
    type SearchEngineOptions,
    type SearchablePDFDocument,
} from './searchEngine';

export interface BatchWatermarkConfig {
    fontSize?: number;
    opacity?: number;
    color?: string;
    rotate?: number;
    isRepeating?: boolean;
}

export interface AutoRedactOptions extends SearchEngineOptions {
    caseSensitive: boolean;
    wholeWord: boolean;
    useRegex: boolean;
}

export type SearchOptions = AutoRedactOptions;
export type SearchMatch = SearchResult;

export type WatermarkPosition =
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'middle-left'
    | 'center'
    | 'middle-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';

type StoreLike = {
    updatePage?: (pageId: string, updates: Partial<PageState>) => void;
    rotatePage?: (pageId: string, direction: 'cw' | 'ccw') => void;
    editorCurrentPage?: PageState | null;
    updateEditorCurrentPage?: (updates: Partial<PageState>) => void;
};

function getOperationStore(editorStore?: StoreLike) {
    const fallbackStore = usePDFStore.getState();
    return {
        updatePage: editorStore?.updatePage ?? fallbackStore.updatePage,
        rotatePage: editorStore?.rotatePage ?? fallbackStore.rotatePage,
        editorCurrentPage: editorStore?.editorCurrentPage,
        updateEditorCurrentPage: editorStore?.updateEditorCurrentPage,
    };
}

function getTargetPagesByNumbers(pageNumbers?: number[]): PageState[] {
    const { pages } = usePDFStore.getState();
    if (!pageNumbers || pageNumbers.length === 0) {
        return pages;
    }

    const pageSet = new Set(pageNumbers);
    return pages.filter((page) => pageSet.has(page.pageNumber));
}

function getTargetPagesByIds(pageIds: string[]): PageState[] {
    const { pages } = usePDFStore.getState();
    if (pageIds.length === 0) {
        return pages;
    }

    const idSet = new Set(pageIds);
    return pages.filter((page) => idSet.has(page.id));
}

function toPageNumbers(pages: PageState[]): number[] {
    return pages.map((page) => page.pageNumber);
}

function startBatch(operationType: 'watermark' | 'remove-watermark' | 'text-color' | 'redact' | 'rotate', targetPages: PageState[]): void {
    useBatchOperationStore.getState().startOperation(operationType, targetPages.length, toPageNumbers(targetPages));
}

function updateBatchProgress(processed: number): void {
    useBatchOperationStore.getState().setProgress(processed);
}

function finishBatch(): void {
    useBatchOperationStore.getState().completeOperation();
}

function failBatch(fallbackMessage: string, error: unknown): void {
    const message = error instanceof Error ? error.message : fallbackMessage;
    useBatchOperationStore.getState().failOperation(message);
}

export function applyEffectToAllPages(
    effectParams: Record<string, unknown>,
    pages: PageState[],
    editorStore?: StoreLike
): void {
    const { updatePage } = getOperationStore(editorStore);
    const targetPages = pages.length > 0 ? pages : usePDFStore.getState().pages;

    useBatchOperationStore.getState().startBatchOperation('effect-all-pages', targetPages.length);

    try {
        targetPages.forEach((page, index) => {
            const nonEffectObjects = page.objects.filter((object) => object.type !== 'effect');
            const effectObject: PDFObject = {
                id: `effect-${page.id}-${Date.now()}-${index}`,
                type: 'effect',
                effectType: 'adjustment',
                effectParams: { ...effectParams },
                visible: true,
                opacity: 1,
                x: 0,
                y: 0,
                width: page.width,
                height: page.height,
                rotation: 0,
                name: 'Batch Effect',
            };

            updatePage(page.id, {
                objects: [...nonEffectObjects, effectObject],
                isEdited: true,
            });

            useBatchOperationStore.getState().updateProgress(index + 1, targetPages.length);
        });

        useBatchOperationStore.getState().completeBatchOperation();
    } catch (error) {
        useBatchOperationStore.getState().failBatchOperation(error instanceof Error ? error.message : 'Failed to apply effect to all pages');
    }
}

export function applyWatermarkToAllPages(
    watermarkText: string,
    fontSize: number,
    opacity: number,
    position: WatermarkPosition,
    angle: number,
    pages: PageState[],
    editorStore?: StoreLike
): void {
    const { updatePage, editorCurrentPage, updateEditorCurrentPage } = getOperationStore(editorStore);
    const targetPages = pages.length > 0 ? pages : usePDFStore.getState().pages;

    useBatchOperationStore.getState().startBatchOperation('watermark-all-pages', targetPages.length);

    try {
        targetPages.forEach((page, index) => {
            const updates: Partial<PageState> = {
                watermark: {
                    text: watermarkText,
                    fontSize,
                    opacity,
                    color: '#000000',
                    position,
                    rotate: angle,
                    isRepeating: false,
                },
                isEdited: true,
            };

            updatePage(page.id, updates);

            if (editorCurrentPage?.id === page.id && updateEditorCurrentPage) {
                updateEditorCurrentPage(updates);
            }

            useBatchOperationStore.getState().updateProgress(index + 1, targetPages.length);
        });

        useBatchOperationStore.getState().completeBatchOperation();
    } catch (error) {
        useBatchOperationStore.getState().failBatchOperation(error instanceof Error ? error.message : 'Failed to apply watermark to all pages');
    }
}

export function rotateAllPages(
    rotation: 90 | 180 | 270 | -90,
    pages: PageState[],
    editorStore?: StoreLike
): void {
    const { rotatePage, editorCurrentPage, updateEditorCurrentPage } = getOperationStore(editorStore);
    const targetPages = pages.length > 0 ? pages : usePDFStore.getState().pages;

    useBatchOperationStore.getState().startBatchOperation('rotate-all-pages', targetPages.length);

    try {
        const direction: 'cw' | 'ccw' = rotation >= 0 ? 'cw' : 'ccw';
        const turns = Math.max(1, Math.round(Math.abs(rotation) / 90));

        targetPages.forEach((page, index) => {
            for (let i = 0; i < turns; i += 1) {
                rotatePage(page.id, direction);
            }

            if (editorCurrentPage?.id === page.id && updateEditorCurrentPage) {
                const syncedPage = usePDFStore.getState().pages.find((candidate) => candidate.id === page.id);
                if (syncedPage) {
                    updateEditorCurrentPage({ rotation: syncedPage.rotation, isEdited: true });
                }
            }

            useBatchOperationStore.getState().updateProgress(index + 1, targetPages.length);
        });

        useBatchOperationStore.getState().completeBatchOperation();
    } catch (error) {
        useBatchOperationStore.getState().failBatchOperation(error instanceof Error ? error.message : 'Failed to rotate all pages');
    }
}

export function batchApplyWatermark(text: string, pages?: number[], config: BatchWatermarkConfig = {}): void {
    const { updatePage } = usePDFStore.getState();
    const targetPages = getTargetPagesByNumbers(pages);

    startBatch('watermark', targetPages);

    try {
        targetPages.forEach((page, index) => {
            updatePage(page.id, {
                watermark: {
                    text,
                    fontSize: config.fontSize ?? 48,
                    opacity: config.opacity ?? 0.2,
                    color: config.color ?? '#000000',
                    rotate: config.rotate ?? -45,
                    isRepeating: config.isRepeating ?? true,
                },
                isEdited: true,
            });
            updateBatchProgress(index + 1);
        });
        finishBatch();
    } catch (error) {
        failBatch('Watermark operation failed', error);
    }
}

export function batchApplyTextColor(color: string, pages?: number[]): void {
    const { updatePage } = usePDFStore.getState();
    const targetPages = getTargetPagesByNumbers(pages);

    startBatch('text-color', targetPages);

    try {
        targetPages.forEach((page, index) => {
            const objects = page.objects.map((object) =>
                object.type === 'text' ? { ...object, fill: color } : object
            );

            updatePage(page.id, { objects, isEdited: true });
            updateBatchProgress(index + 1);
        });
        finishBatch();
    } catch (error) {
        failBatch('Text color operation failed', error);
    }
}

export function batchApplyRedaction(
    searchText: string,
    pages?: number[],
    pdfDocument?: SearchablePDFDocument,
    options: AutoRedactOptions = { caseSensitive: false, wholeWord: false, useRegex: false }
): number {
    const { pages: allPages, updatePage } = usePDFStore.getState();
    const targetPages = getTargetPagesByNumbers(pages);

    startBatch('redact', targetPages);

    let totalRedacted = 0;

    try {
        const pageNumbers = toPageNumbers(targetPages);
        const results = searchInPDF(pdfDocument ?? { pages: allPages }, searchText, pageNumbers, options);

        const resultMap = new Map<string, SearchResult[]>();
        results.forEach((result) => {
            const existing = resultMap.get(result.pageId) ?? [];
            existing.push(result);
            resultMap.set(result.pageId, existing);
        });

        targetPages.forEach((page, index) => {
            const pageResults = resultMap.get(page.id) ?? [];
            if (pageResults.length > 0) {
                const redactions: PDFObject[] = pageResults.map((result) => ({
                    id: crypto.randomUUID(),
                    type: 'redaction',
                    x: result.x,
                    y: result.y,
                    width: result.width,
                    height: result.height,
                    fill: '#000000',
                    opacity: 1,
                }));

                updatePage(page.id, {
                    objects: [...page.objects, ...redactions],
                    isEdited: true,
                });

                totalRedacted += pageResults.length;
            }

            updateBatchProgress(index + 1);
        });

        finishBatch();
    } catch (error) {
        failBatch('Redaction operation failed', error);
    }

    return totalRedacted;
}

export function batchRotatePages(rotation: number, pages?: number[]): void;
export function batchRotatePages(pageIds: string[], direction: 'cw' | 'ccw'): void;
export function batchRotatePages(
    arg1: number | string[],
    arg2?: number[] | 'cw' | 'ccw'
): void {
    const { rotatePage } = usePDFStore.getState();

    const isLegacyShape = Array.isArray(arg1);
    const targetPages = isLegacyShape
        ? getTargetPagesByIds(arg1)
        : getTargetPagesByNumbers(Array.isArray(arg2) ? arg2 : undefined);

    startBatch('rotate', targetPages);

    try {
        const direction: 'cw' | 'ccw' = isLegacyShape
            ? (arg2 as 'cw' | 'ccw')
            : ((arg1 as number) >= 0 ? 'cw' : 'ccw');

        const turns = isLegacyShape
            ? 1
            : Math.max(1, Math.round(Math.abs(arg1 as number) / 90));

        targetPages.forEach((page, index) => {
            for (let i = 0; i < turns; i += 1) {
                rotatePage(page.id, direction);
            }
            updateBatchProgress(index + 1);
        });
        finishBatch();
    } catch (error) {
        failBatch('Rotate operation failed', error);
    }
}

// Backward-compatible exports currently used in existing panels.
export function batchAddWatermark(pageIds: string[], watermark: PageState['watermark']): void {
    const targetPages = getTargetPagesByIds(pageIds);
    batchApplyWatermark(watermark?.text ?? '', toPageNumbers(targetPages), {
        fontSize: watermark?.fontSize,
        opacity: watermark?.opacity,
        color: watermark?.color,
        rotate: watermark?.rotate,
        isRepeating: watermark?.isRepeating,
    });
}

export function batchRemoveWatermark(pageIds: string[]): void {
    const { updatePage } = usePDFStore.getState();
    const targetPages = getTargetPagesByIds(pageIds);

    startBatch('remove-watermark', targetPages);

    try {
        targetPages.forEach((page, index) => {
            updatePage(page.id, { watermark: undefined, isEdited: true });
            updateBatchProgress(index + 1);
        });
        finishBatch();
    } catch (error) {
        failBatch('Remove watermark failed', error);
    }
}

export function batchChangeTextColor(pageIds: string[], color: string): void {
    const targetPages = getTargetPagesByIds(pageIds);
    batchApplyTextColor(color, toPageNumbers(targetPages));
}

export function batchAutoRedact(pageIds: string[], searchTerm: string, options: AutoRedactOptions): number {
    const targetPages = getTargetPagesByIds(pageIds);
    const { pdfDocument } = usePDFStore.getState();
    return batchApplyRedaction(searchTerm, toPageNumbers(targetPages), pdfDocument, options);
}

export function searchAcrossPages(term: string, options: SearchOptions): SearchMatch[] {
    const { pdfDocument } = usePDFStore.getState();
    return searchInPDF(pdfDocument, term, undefined, options);
}

export function replaceSingleMatch(match: SearchMatch, replaceTerm: string, options: SearchOptions): void {
    const { pages, updatePage } = usePDFStore.getState();
    const page = pages.find((item) => item.id === match.pageId);
    if (!page) {
        return;
    }

    const objects = page.objects.map((object) => {
        if (object.id !== match.objId || object.type !== 'text' || !object.text) {
            return object;
        }

        return {
            ...object,
            text: replaceText(object.text, match.matchedText, replaceTerm, {
                ...options,
                useRegex: false,
                wholeWord: false,
            }),
        };
    });

    updatePage(page.id, { objects, isEdited: true });
}

export function replaceAllMatches(term: string, replaceTerm: string, options: SearchOptions): number {
    const { pages, updatePage, pdfDocument } = usePDFStore.getState();
    const matches = searchInPDF(pdfDocument, term, undefined, options);
    if (matches.length === 0) {
        return 0;
    }

    pages.forEach((page) => {
        let changed = false;
        const objects = page.objects.map((object) => {
            if (object.type !== 'text' || !object.text) {
                return object;
            }

            const text = replaceText(object.text, term, replaceTerm, options);
            if (text !== object.text) {
                changed = true;
                return { ...object, text };
            }

            return object;
        });

        if (changed) {
            updatePage(page.id, { objects, isEdited: true });
        }
    });

    return matches.length;
}
