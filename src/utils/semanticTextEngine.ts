/**
 * Semantic Text Replacement Engine
 *
 * Provides intelligent, document-wide text modification beyond simple find/replace.
 * Supports case-insensitive, regex-based, context-aware, and page-scoped replacement.
 *
 * Replacements are applied as overlay edits via the existing pendingNativeTextEdits
 * pipeline. A single undo state is pushed for the entire batch.
 *
 * Never rewrites raw PDF operators or modifies original file buffers.
 */

import type { NativeTextItem } from '../store/editorStore';

// ─── Types ─────────────────────────────────────────────────────

export interface SearchOptions {
    /** Case-sensitive matching (default false) */
    caseSensitive?: boolean;
    /** Treat query as regex pattern (default false) */
    useRegex?: boolean;
    /** Restrict to specific page numbers (1-based). Empty = all pages */
    pageScope?: number[];
    /** Context filter — which structural regions to search */
    contextFilter?: 'all' | 'headers' | 'paragraphs';
}

export interface TextIndexEntry {
    /** Reference to the original text item */
    item: NativeTextItem;
    /** Normalised text for matching */
    normalised: string;
    /** Structural context classification */
    context: 'header' | 'paragraph' | 'other';
    /** Page number (1-based) */
    pageNumber: number;
}

export interface SemanticMatch {
    /** Unique match id */
    id: string;
    /** The text item containing the match */
    item: NativeTextItem;
    /** The matched substring */
    matchedText: string;
    /** Start index within item text */
    startIndex: number;
    /** End index within item text */
    endIndex: number;
    /** Surrounding context for preview */
    contextBefore: string;
    contextAfter: string;
    /** Structural context */
    context: 'header' | 'paragraph' | 'other';
    /** Page number */
    pageNumber: number;
}

export interface ReplacementPreview {
    match: SemanticMatch;
    originalText: string;
    newText: string;
    /** Whether this match is selected for replacement */
    selected: boolean;
}

// ─── Index Builder ─────────────────────────────────────────────

/**
 * Classify a text item by structural context based on font size heuristics.
 * Items with fontSize >= 20 are headers, otherwise paragraphs.
 */
function classifyContext(item: NativeTextItem): 'header' | 'paragraph' | 'other' {
    const fontSize = item.fontSize || 12;
    if (fontSize >= 20) return 'header';
    if (item.text.trim().length > 0) return 'paragraph';
    return 'other';
}

/**
 * Extract page number from a NativeTextItem.
 * The item's id format is typically "text-{pageNum}-..."
 */
function extractPageNumber(item: NativeTextItem): number {
    const match = item.id.match(/^text-(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
}

/**
 * Build a searchable index from text items.
 */
export function buildSearchIndex(textItems: NativeTextItem[]): TextIndexEntry[] {
    return textItems.map(item => ({
        item,
        normalised: item.text.toLowerCase(),
        context: classifyContext(item),
        pageNumber: extractPageNumber(item),
    }));
}

// ─── Search ────────────────────────────────────────────────────

/**
 * Search text items using the specified query and options.
 * Returns all matches with positional and context metadata.
 */
export function semanticSearch(
    index: TextIndexEntry[],
    query: string,
    options: SearchOptions = {}
): SemanticMatch[] {
    if (!query) return [];

    const {
        caseSensitive = false,
        useRegex = false,
        pageScope = [],
        contextFilter = 'all',
    } = options;

    const matches: SemanticMatch[] = [];
    let matchCounter = 0;

    // Build regex from query
    let regex: RegExp;
    try {
        if (useRegex) {
            regex = new RegExp(query, caseSensitive ? 'g' : 'gi');
        } else {
            const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            regex = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
        }
    } catch {
        // Invalid regex — return empty
        return [];
    }

    for (const entry of index) {
        // Filter by page scope
        if (pageScope.length > 0 && !pageScope.includes(entry.pageNumber)) {
            continue;
        }

        // Filter by context
        if (contextFilter !== 'all' && contextFilter === 'headers' && entry.context !== 'header') {
            continue;
        }
        if (contextFilter !== 'all' && contextFilter === 'paragraphs' && entry.context !== 'paragraph') {
            continue;
        }

        // Reset regex lastIndex
        regex.lastIndex = 0;
        let regexMatch: RegExpExecArray | null;

        while ((regexMatch = regex.exec(entry.item.text)) !== null) {
            const startIndex = regexMatch.index;
            const endIndex = startIndex + regexMatch[0].length;

            // Extract surrounding context (up to 30 chars each side)
            const contextBefore = entry.item.text.slice(Math.max(0, startIndex - 30), startIndex);
            const contextAfter = entry.item.text.slice(endIndex, endIndex + 30);

            matches.push({
                id: `sm-${matchCounter++}`,
                item: entry.item,
                matchedText: regexMatch[0],
                startIndex,
                endIndex,
                contextBefore,
                contextAfter,
                context: entry.context,
                pageNumber: entry.pageNumber,
            });
        }
    }

    return matches;
}

// ─── Preview Diff ──────────────────────────────────────────────

/**
 * Generate preview diffs for all matches with a given replacement string.
 */
export function generatePreviewDiff(
    matches: SemanticMatch[],
    replacement: string
): ReplacementPreview[] {
    return matches.map(match => {
        const original = match.item.text;
        const before = original.slice(0, match.startIndex);
        const after = original.slice(match.endIndex);

        return {
            match,
            originalText: original,
            newText: before + replacement + after,
            selected: true, // All selected by default
        };
    });
}

// ─── Apply Replacements ────────────────────────────────────────

/**
 * Apply selected replacements and return updated NativeTextItems.
 *
 * Groups matches by item and applies all replacements to each item
 * in reverse order (to preserve indices).
 *
 * Returns a map of item ID → updated NativeTextItem.
 */
export function applyReplacements(
    previews: ReplacementPreview[],
    replacement: string
): Record<string, NativeTextItem> {
    // Filter to selected only
    const selected = previews.filter(p => p.selected);

    // Group by item ID
    const grouped = new Map<string, { item: NativeTextItem; matches: SemanticMatch[] }>();
    for (const preview of selected) {
        const id = preview.match.item.id;
        if (!grouped.has(id)) {
            grouped.set(id, { item: { ...preview.match.item }, matches: [] });
        }
        grouped.get(id)!.matches.push(preview.match);
    }

    const results: Record<string, NativeTextItem> = {};

    for (const [id, { item, matches }] of grouped) {
        // Sort matches in reverse order by startIndex to preserve indices
        const sorted = [...matches].sort((a, b) => b.startIndex - a.startIndex);

        let text = item.text;
        for (const match of sorted) {
            text = text.slice(0, match.startIndex) + replacement + text.slice(match.endIndex);
        }

        results[id] = { ...item, text };
    }

    return results;
}

// ─── Convenience ───────────────────────────────────────────────

/**
 * Count total matches across all items.
 */
export function countMatches(matches: SemanticMatch[]): number {
    return matches.length;
}

/**
 * Get unique pages that contain matches.
 */
export function getMatchedPages(matches: SemanticMatch[]): number[] {
    return [...new Set(matches.map(m => m.pageNumber))].sort((a, b) => a - b);
}
