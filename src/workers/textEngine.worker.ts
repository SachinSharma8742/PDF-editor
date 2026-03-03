/**
 * Text Engine Worker
 *
 * Offloads heavy text indexing and batch matching to a background thread.
 *
 * Messages IN:
 *   { type: 'search', textItems: NativeTextItem[], query: string, options: SearchOptions }
 *
 * Messages OUT:
 *   { type: 'result', action: 'search', matches: SemanticMatch[] }
 *   { type: 'error', message: string }
 */

interface WorkerTextItem {
    id: string;
    text: string;
    fontSize: number;
    pageNumber: number;
}

interface WorkerSearchOptions {
    caseSensitive?: boolean;
    useRegex?: boolean;
    pageScope?: number[];
    contextFilter?: 'all' | 'headers' | 'paragraphs';
}

interface WorkerMatch {
    id: string;
    itemId: string;
    matchedText: string;
    startIndex: number;
    endIndex: number;
    contextBefore: string;
    contextAfter: string;
    context: 'header' | 'paragraph' | 'other';
    pageNumber: number;
}

function classifyContext(fontSize: number, text: string): 'header' | 'paragraph' | 'other' {
    if (fontSize >= 20) return 'header';
    if (text.trim().length > 0) return 'paragraph';
    return 'other';
}

self.onmessage = (e: MessageEvent) => {
    const { type } = e.data;

    try {
        if (type === 'search') {
            const {
                textItems,
                query,
                options = {},
            } = e.data as {
                textItems: WorkerTextItem[];
                query: string;
                options: WorkerSearchOptions;
            };

            if (!query) {
                postMessage({ type: 'result', action: 'search', matches: [] });
                return;
            }

            const {
                caseSensitive = false,
                useRegex = false,
                pageScope = [],
                contextFilter = 'all',
            } = options;

            // Build regex
            let regex: RegExp;
            try {
                if (useRegex) {
                    regex = new RegExp(query, caseSensitive ? 'g' : 'gi');
                } else {
                    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    regex = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
                }
            } catch {
                postMessage({ type: 'result', action: 'search', matches: [] });
                return;
            }

            const matches: WorkerMatch[] = [];
            let counter = 0;

            for (const item of textItems) {
                // Page filter
                if (pageScope.length > 0 && !pageScope.includes(item.pageNumber)) continue;

                // Context filter
                const ctx = classifyContext(item.fontSize, item.text);
                if (contextFilter === 'headers' && ctx !== 'header') continue;
                if (contextFilter === 'paragraphs' && ctx !== 'paragraph') continue;

                regex.lastIndex = 0;
                let regexMatch: RegExpExecArray | null;

                while ((regexMatch = regex.exec(item.text)) !== null) {
                    const startIndex = regexMatch.index;
                    const endIndex = startIndex + regexMatch[0].length;

                    matches.push({
                        id: `sm-${counter++}`,
                        itemId: item.id,
                        matchedText: regexMatch[0],
                        startIndex,
                        endIndex,
                        contextBefore: item.text.slice(Math.max(0, startIndex - 30), startIndex),
                        contextAfter: item.text.slice(endIndex, endIndex + 30),
                        context: ctx,
                        pageNumber: item.pageNumber,
                    });
                }
            }

            postMessage({ type: 'result', action: 'search', matches });
        } else {
            postMessage({ type: 'error', message: `Unknown message type: ${type}` });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Worker error';
        postMessage({ type: 'error', message });
    }
};
