/**
 * Batch Operations Utility
 *
 * Provides functions to apply the same operation to multiple PDF pages at once.
 * All operations go through the pdfStore and batchOperationStore for progress tracking.
 */

import type { PageState, PDFObject } from '../store/pdfStore';
import { usePDFStore } from '../store/pdfStore';
import { useBatchOperationStore } from '../store/batchOperationStore';

// ─── Helpers ────────────────────────────────────────────────────────────────

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getTargetPages(pageIds: string[]): PageState[] {
    const { pages } = usePDFStore.getState();
    return pageIds.length > 0 ? pages.filter((p) => pageIds.includes(p.id)) : pages;
}

// ─── Watermark ───────────────────────────────────────────────────────────────

/**
 * Apply a watermark to all selected pages (or all pages if pageIds is empty).
 */
export function batchAddWatermark(pageIds: string[], watermark: PageState['watermark']): void {
    const { updatePage } = usePDFStore.getState();
    const { start, updateProgress, finish, setError } = useBatchOperationStore.getState();

    const targetPages = getTargetPages(pageIds);
    start('watermark', targetPages.length);

    try {
        targetPages.forEach((page, i) => {
            updatePage(page.id, { watermark, isEdited: true });
            updateProgress(i + 1);
        });
        finish();
    } catch (e) {
        setError(e instanceof Error ? e.message : 'Watermark operation failed');
    }
}

/**
 * Remove watermark from all selected pages (or all pages if pageIds is empty).
 */
export function batchRemoveWatermark(pageIds: string[]): void {
    const { updatePage } = usePDFStore.getState();
    const { start, updateProgress, finish, setError } = useBatchOperationStore.getState();

    const targetPages = getTargetPages(pageIds);
    start('remove-watermark', targetPages.length);

    try {
        targetPages.forEach((page, i) => {
            updatePage(page.id, { watermark: undefined, isEdited: true });
            updateProgress(i + 1);
        });
        finish();
    } catch (e) {
        setError(e instanceof Error ? e.message : 'Remove watermark failed');
    }
}

// ─── Text Color ──────────────────────────────────────────────────────────────

/**
 * Change text color for all text objects across selected pages (or all pages).
 */
export function batchChangeTextColor(pageIds: string[], color: string): void {
    const { updatePage } = usePDFStore.getState();
    const { start, updateProgress, finish, setError } = useBatchOperationStore.getState();

    const targetPages = getTargetPages(pageIds);
    start('text-color', targetPages.length);

    try {
        targetPages.forEach((page, i) => {
            const newObjects = page.objects.map((obj) =>
                obj.type === 'text' ? { ...obj, fill: color } : obj
            );
            updatePage(page.id, { objects: newObjects, isEdited: true });
            updateProgress(i + 1);
        });
        finish();
    } catch (e) {
        setError(e instanceof Error ? e.message : 'Text color operation failed');
    }
}

// ─── Rotate ──────────────────────────────────────────────────────────────────

/**
 * Rotate selected pages (or all pages) in the given direction.
 */
export function batchRotatePages(pageIds: string[], direction: 'cw' | 'ccw'): void {
    const { rotatePage } = usePDFStore.getState();
    const { start, updateProgress, finish, setError } = useBatchOperationStore.getState();

    const targetPages = getTargetPages(pageIds);
    start('rotate', targetPages.length);

    try {
        targetPages.forEach((page, i) => {
            rotatePage(page.id, direction);
            updateProgress(i + 1);
        });
        finish();
    } catch (e) {
        setError(e instanceof Error ? e.message : 'Rotate operation failed');
    }
}

// ─── Auto-Redact ─────────────────────────────────────────────────────────────

export interface AutoRedactOptions {
    caseSensitive: boolean;
    wholeWord: boolean;
    useRegex: boolean;
}

/**
 * Auto-redact text objects matching the search term across selected pages (or all pages).
 * Adds a redaction rectangle over any matching text object.
 */
export function batchAutoRedact(pageIds: string[], searchTerm: string, options: AutoRedactOptions): number {
    const { updatePage } = usePDFStore.getState();
    const { start, updateProgress, finish, setError } = useBatchOperationStore.getState();

    const targetPages = getTargetPages(pageIds);
    start('redact', targetPages.length);

    let totalRedacted = 0;

    try {
        const flags = options.caseSensitive ? 'g' : 'gi';
        let pattern = options.useRegex ? searchTerm : escapeRegex(searchTerm);
        if (options.wholeWord) pattern = `\\b${pattern}\\b`;
        const regex = new RegExp(pattern, flags);

        targetPages.forEach((page, i) => {
            const newObjects: PDFObject[] = [...page.objects];

            page.objects.forEach((obj) => {
                if (obj.type === 'text' && obj.text && regex.test(obj.text)) {
                    // Reset lastIndex for 'g' flag reuse
                    regex.lastIndex = 0;
                    newObjects.push({
                        id: crypto.randomUUID(),
                        type: 'redaction',
                        x: obj.x,
                        y: obj.y,
                        width: obj.width ?? Math.max((obj.text.length * (obj.fontSize ?? 16)) / 2, 50),
                        height: (obj.fontSize ?? 16) * 1.5,
                        fill: '#000000',
                        opacity: 1,
                    });
                    totalRedacted++;
                }
                // Reset for each object (since 'g' flag tracks lastIndex)
                regex.lastIndex = 0;
            });

            if (newObjects.length !== page.objects.length) {
                updatePage(page.id, { objects: newObjects, isEdited: true });
            }

            updateProgress(i + 1);
        });

        finish();
    } catch (e) {
        setError(e instanceof Error ? e.message : 'Redaction operation failed');
    }

    return totalRedacted;
}

// ─── Search Utility ──────────────────────────────────────────────────────────

export interface SearchOptions {
    caseSensitive: boolean;
    wholeWord: boolean;
    useRegex: boolean;
}

export interface SearchMatch {
    pageId: string;
    pageNumber: number;
    objId: string;
    text: string;
    matchStart: number;
    matchEnd: number;
    matchedText: string;
}

/**
 * Search for a term across all pages and return matches.
 */
export function searchAcrossPages(term: string, options: SearchOptions): SearchMatch[] {
    if (!term.trim()) return [];

    const { pages } = usePDFStore.getState();
    const results: SearchMatch[] = [];

    try {
        const flags = options.caseSensitive ? 'g' : 'gi';
        let pattern = options.useRegex ? term : escapeRegex(term);
        if (options.wholeWord) pattern = `\\b${pattern}\\b`;
        const regex = new RegExp(pattern, flags);

        pages.forEach((page) => {
            page.objects.forEach((obj) => {
                if (obj.type === 'text' && obj.text) {
                    regex.lastIndex = 0;
                    let match: RegExpExecArray | null;
                    while ((match = regex.exec(obj.text)) !== null) {
                        results.push({
                            pageId: page.id,
                            pageNumber: page.pageNumber,
                            objId: obj.id,
                            text: obj.text,
                            matchStart: match.index,
                            matchEnd: match.index + match[0].length,
                            matchedText: match[0],
                        });
                        // Prevent infinite loop for zero-length matches
                        if (match[0].length === 0) regex.lastIndex++;
                    }
                }
            });
        });
    } catch {
        // Invalid regex - return empty
    }

    return results;
}

/**
 * Replace a single match in a text object.
 */
export function replaceSingleMatch(match: SearchMatch, replaceTerm: string, options: SearchOptions): void {
    const { pages, updatePage } = usePDFStore.getState();
    const page = pages.find((p) => p.id === match.pageId);
    if (!page) return;

    const flags = options.caseSensitive ? 'g' : 'gi';
    let pattern = options.useRegex ? match.matchedText : escapeRegex(match.matchedText);
    if (options.wholeWord) pattern = `\\b${pattern}\\b`;

    const newObjects = page.objects.map((obj) => {
        if (obj.id !== match.objId || obj.type !== 'text' || !obj.text) return obj;
        const regex = new RegExp(pattern, flags);
        const newText = obj.text.replace(regex, replaceTerm);
        return { ...obj, text: newText };
    });

    updatePage(page.id, { objects: newObjects, isEdited: true });
}

/**
 * Replace all matches of the search term across all pages.
 */
export function replaceAllMatches(term: string, replaceTerm: string, options: SearchOptions): number {
    const { pages, updatePage } = usePDFStore.getState();
    let count = 0;

    try {
        const flags = options.caseSensitive ? 'g' : 'gi';
        let pattern = options.useRegex ? term : escapeRegex(term);
        if (options.wholeWord) pattern = `\\b${pattern}\\b`;
        const regex = new RegExp(pattern, flags);

        pages.forEach((page) => {
            let pageChanged = false;
            const newObjects = page.objects.map((obj) => {
                if (obj.type !== 'text' || !obj.text) return obj;
                const before = obj.text;
                regex.lastIndex = 0;
                const after = obj.text.replace(regex, replaceTerm);
                if (before !== after) {
                    pageChanged = true;
                    // Count occurrences
                    regex.lastIndex = 0;
                    const matches = before.match(new RegExp(pattern, flags));
                    count += matches ? matches.length : 0;
                    return { ...obj, text: after };
                }
                return obj;
            });
            if (pageChanged) {
                updatePage(page.id, { objects: newObjects, isEdited: true });
            }
        });
    } catch {
        // Invalid regex
    }

    return count;
}
