/**
 * Search Engine Utility
 *
 * Provides PDF-aware search across both native PDF text layers and
 * editor-placed text objects. Also provides replacement helpers and
 * highlight object creation for rendering matches in-canvas.
 */

import type { PDFDocumentProxy, PDFPageProxy, PDFObject, PageState } from '../store/pdfStore';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SearchOptions {
    /** Match regardless of case (default: false) */
    caseSensitive: boolean;
    /** Match complete words only (default: false) */
    wholeWord: boolean;
    /** Treat searchTerm as a regex pattern (default: false) */
    useRegex: boolean;
}

export interface SearchResultItem {
    pageId: string;
    pageNumber: number;
    /** 'native' = from PDF text layer, 'object' = from canvas PDFObject */
    source: 'native' | 'object';
    /** ID of the PDFObject (only for 'object' source) */
    objectId?: string;
    /** Full text of the block/object that matched */
    contextText: string;
    /** Matched portion */
    matchedText: string;
    /** Character offset where the match starts in contextText */
    matchStart: number;
    /** Character offset where the match ends in contextText */
    matchEnd: number;
    /** Approximate bounding rect on the page (for highlighting) */
    boundingRect?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Extended page type that includes getTextContent (available at runtime via PDF.js)
interface PDFPageWithText extends PDFPageProxy {
    getTextContent: () => Promise<{
        items: Array<{ str?: string; transform?: number[]; width?: number; height?: number }>;
    }>;
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRegex(searchTerm: string, options: SearchOptions): RegExp | null {
    try {
        const flags = options.caseSensitive ? 'g' : 'gi';
        let pattern = options.useRegex ? searchTerm : escapeRegex(searchTerm);
        if (options.wholeWord) pattern = `\\b${pattern}\\b`;
        return new RegExp(pattern, flags);
    } catch {
        return null;
    }
}

function findAllMatches(
    text: string,
    regex: RegExp
): Array<{ start: number; end: number; matched: string }> {
    const results: Array<{ start: number; end: number; matched: string }> = [];
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
        results.push({ start: m.index, end: m.index + m[0].length, matched: m[0] });
        if (m[0].length === 0) regex.lastIndex++;
    }
    return results;
}

// ─── Core API ────────────────────────────────────────────────────────────────

/**
 * Search for `searchTerm` across all pages of the PDF document.
 *
 * Searches two sources per page:
 *  1. Native PDF text layer (requires pdfDocument, only for PDF-sourced pages)
 *  2. Editor text objects (PDFObject with type === 'text')
 *
 * @param pdfDocument  Optional PDF.js document proxy (may be null for blank docs)
 * @param searchTerm   The string or regex pattern to search for
 * @param pages        Current page states from usePDFStore
 * @param options      Search options (case, whole word, regex)
 * @returns            Array of match results
 */
export async function searchInPDF(
    pdfDocument: PDFDocumentProxy | null,
    searchTerm: string,
    pages: PageState[],
    options: SearchOptions
): Promise<SearchResultItem[]> {
    if (!searchTerm.trim()) return [];

    const regex = buildRegex(searchTerm, options);
    if (!regex) return [];

    const results: SearchResultItem[] = [];

    for (const page of pages) {
        const pageIndex = page.originalPageIndex ?? page.pageNumber;

        // ── 1. Native PDF text layer ──────────────────────────────────────
        if (pdfDocument && page.source === 'pdf' && pageIndex >= 1 && pageIndex <= pdfDocument.numPages) {
            try {
                const pdfPage = (await pdfDocument.getPage(pageIndex)) as PDFPageWithText;
                const content = await pdfPage.getTextContent();
                const viewport = pdfPage.getViewport({ scale: 1 });

                for (const item of content.items) {
                    const str = item.str ?? '';
                    if (!str.trim()) continue;

                    regex.lastIndex = 0;
                    const matches = findAllMatches(str, regex);
                    if (matches.length === 0) continue;

                    // PDF.js transform: [scaleX, skewX, skewY, scaleY, x, y]
                    const transform = item.transform ?? [1, 0, 0, 1, 0, 0];
                    const itemX = transform[4];
                    const itemY = viewport.height - transform[5] - (item.height ?? 12);
                    const itemW = item.width ?? str.length * 7;
                    const itemH = item.height ?? 12;

                    for (const m of matches) {
                        const charFrac = str.length > 0 ? m.start / str.length : 0;
                        const charWidthFrac = str.length > 0 ? (m.end - m.start) / str.length : 0;
                        results.push({
                            pageId: page.id,
                            pageNumber: page.pageNumber,
                            source: 'native',
                            contextText: str,
                            matchedText: m.matched,
                            matchStart: m.start,
                            matchEnd: m.end,
                            boundingRect: {
                                x: itemX + charFrac * itemW,
                                y: itemY,
                                width: charWidthFrac * itemW,
                                height: itemH,
                            },
                        });
                    }
                }
            } catch {
                // getTextContent unavailable (pre-5.x builds) — fall through to object search
            }
        }

        // ── 2. Editor text objects ────────────────────────────────────────
        for (const obj of page.objects) {
            if (obj.type !== 'text' || !obj.text) continue;

            regex.lastIndex = 0;
            const matches = findAllMatches(obj.text, regex);
            if (matches.length === 0) continue;

            const charW = (obj.fontSize ?? 14) * 0.6;
            const lineH = (obj.fontSize ?? 14) * 1.4;

            for (const m of matches) {
                const charOffset = m.start * charW;
                results.push({
                    pageId: page.id,
                    pageNumber: page.pageNumber,
                    source: 'object',
                    objectId: obj.id,
                    contextText: obj.text,
                    matchedText: m.matched,
                    matchStart: m.start,
                    matchEnd: m.end,
                    boundingRect: {
                        x: (obj.x ?? 0) + charOffset,
                        y: obj.y ?? 0,
                        width: m.matched.length * charW,
                        height: lineH,
                    },
                });
            }
        }
    }

    return results;
}

// ─── Text Replacement ─────────────────────────────────────────────────────────

/**
 * Replace occurrences of `searchTerm` in `text` with `replacement`.
 *
 * @param text         The source text to operate on
 * @param searchTerm   The pattern to find
 * @param replacement  The replacement string (supports regex capture groups when useRegex is true)
 * @param options      Search options
 * @returns            Object with replaced text and count of replacements made
 */
export function replaceText(
    text: string,
    searchTerm: string,
    replacement: string,
    options: SearchOptions
): { result: string; count: number } {
    if (!searchTerm.trim()) return { result: text, count: 0 };

    const regex = buildRegex(searchTerm, options);
    if (!regex) return { result: text, count: 0 };

    let count = 0;
    const result = text.replace(regex, (match, ...args) => {
        count++;
        if (options.useRegex) {
            // Support $1, $2 ... capture group references
            return match.replace(new RegExp(searchTerm, options.caseSensitive ? '' : 'i'), replacement);
        }
        void args;
        return replacement;
    });

    return { result, count };
}

// ─── Highlight Object Creation ────────────────────────────────────────────────

/**
 * Creates a highlight PDFObject from a search result that can be added to a
 * page's objects array for visual in-canvas highlighting.
 *
 * @param result  A search result item with boundingRect
 * @param color   Highlight fill color (default: semi-transparent yellow)
 * @returns       A PDFObject of type 'rectangle' suitable for the editor canvas
 */
export function createHighlight(
    result: SearchResultItem,
    color: string = '#FFFF00'
): PDFObject {
    const rect = result.boundingRect ?? { x: 0, y: 0, width: 100, height: 20 };

    return {
        id: crypto.randomUUID(),
        type: 'rectangle',
        x: rect.x,
        y: rect.y,
        width: Math.max(rect.width, 10),
        height: Math.max(rect.height, 10),
        fill: color,
        opacity: 0.35,
        stroke: color,
        strokeWidth: 0,
    };
}
