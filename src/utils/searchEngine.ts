import type { PDFObject, PageState, PDFDocumentProxy } from '../store/pdfStore';
import { usePDFStore } from '../store/pdfStore';

export interface SearchEngineOptions {
    caseSensitive?: boolean;
    wholeWord?: boolean;
    useRegex?: boolean;
}

export interface SearchResult {
    pageId: string;
    pageNumber: number;
    objId: string;
    text: string;
    matchStart: number;
    matchEnd: number;
    matchedText: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export type SearchablePDFDocument =
    | PDFDocumentProxy
    | {
        pages: PageState[];
    }
    | null
    | undefined;

interface CompiledPattern {
    regex: RegExp;
    isValid: boolean;
}

type SearchCandidate = {
    objId: string;
    text: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    fontSize?: number;
};

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compilePattern(searchTerm: string, options: SearchEngineOptions = {}): CompiledPattern {
    const flags = options.caseSensitive ? 'g' : 'gi';
    let pattern = options.useRegex ? searchTerm : escapeRegex(searchTerm);

    if (options.wholeWord) {
        pattern = `\\b${pattern}\\b`;
    }

    try {
        return {
            regex: new RegExp(pattern, flags),
            isValid: true,
        };
    } catch {
        return {
            regex: /$^/g,
            isValid: false,
        };
    }
}

function getSearchPages(pdfDocument?: SearchablePDFDocument, pageNumbers?: number[]): PageState[] {
    const storePages = usePDFStore.getState().pages;

    const documentPages = pdfDocument && 'pages' in pdfDocument
        ? pdfDocument.pages
        : storePages;

    if (!pageNumbers || pageNumbers.length === 0) {
        return documentPages;
    }

    const pageSet = new Set(pageNumbers);
    return documentPages.filter((page) => pageSet.has(page.pageNumber));
}

function getSearchCandidates(page: PageState): SearchCandidate[] {
    const objectCandidates: SearchCandidate[] = page.objects
        .filter((object) => typeof object.text === 'string' && object.text.trim().length > 0)
        .map((object) => ({
            objId: object.id,
            text: object.text as string,
            x: object.x,
            y: object.y,
            width: object.width,
            height: object.height,
            fontSize: object.fontSize,
        }));

    const nativeCandidates: SearchCandidate[] = page.nativeTextEdits
        ? Object.entries(page.nativeTextEdits)
            .filter(([, item]) => typeof item.text === 'string' && item.text.trim().length > 0)
            .map(([id, item]) => ({
                objId: `native:${id}`,
                text: item.text,
                x: item.x,
                y: item.y,
                width: item.width,
                height: item.height,
                fontSize: item.fontSize,
            }))
        : [];

    return [...objectCandidates, ...nativeCandidates];
}

export function replaceText(
    text: string,
    searchTerm: string,
    replacement: string,
    options: SearchEngineOptions = {}
): string {
    if (!text || !searchTerm.trim()) {
        return text;
    }

    const { regex, isValid } = compilePattern(searchTerm, options);
    if (!isValid) {
        return text;
    }

    regex.lastIndex = 0;
    return text.replace(regex, replacement);
}

export function searchInPDF(
    pdfDocument: SearchablePDFDocument,
    searchTerm: string,
    pages?: number[],
    options: SearchEngineOptions = {}
): SearchResult[] {
    if (!searchTerm.trim()) {
        return [];
    }

    const { regex, isValid } = compilePattern(searchTerm, options);
    if (!isValid) {
        return [];
    }

    const results: SearchResult[] = [];
    const targetPages = getSearchPages(pdfDocument, pages);

    targetPages.forEach((page) => {
        const candidates = getSearchCandidates(page);
        candidates.forEach((candidate) => {
            if (!candidate.text) {
                return;
            }

            regex.lastIndex = 0;
            let match: RegExpExecArray | null;
            while ((match = regex.exec(candidate.text)) !== null) {
                const fontSize = candidate.fontSize ?? 16;
                const objWidth = candidate.width ?? Math.max(candidate.text.length * fontSize * 0.55, 20);
                const objHeight = candidate.height ?? Math.max(fontSize * 1.4, 18);

                results.push({
                    pageId: page.id,
                    pageNumber: page.pageNumber,
                    objId: candidate.objId,
                    text: candidate.text,
                    matchStart: match.index,
                    matchEnd: match.index + match[0].length,
                    matchedText: match[0],
                    x: candidate.x,
                    y: candidate.y,
                    width: objWidth,
                    height: objHeight,
                });

                if (match[0].length === 0) {
                    regex.lastIndex += 1;
                }
            }
        });
    });

    if (results.length === 0 && !options.useRegex && searchTerm.trim().includes(' ')) {
        const words = searchTerm
            .trim()
            .split(/\s+/)
            .map((word) => word.trim())
            .filter((word) => word.length > 0);

        if (words.length > 1) {
            const normalize = (value: string) => (options.caseSensitive ? value : value.toLowerCase());
            const normalizedWords = words.map(normalize);

            targetPages.forEach((page) => {
                const candidates = getSearchCandidates(page);
                candidates.forEach((candidate) => {
                    const haystack = normalize(candidate.text);
                    const hasAllWords = normalizedWords.every((word) => haystack.includes(word));
                    if (!hasAllWords) {
                        return;
                    }

                    const firstWord = normalizedWords[0];
                    const start = haystack.indexOf(firstWord);
                    const matchedText = start >= 0
                        ? candidate.text.slice(start, Math.min(candidate.text.length, start + words.join(' ').length))
                        : candidate.text;

                    const fontSize = candidate.fontSize ?? 16;
                    const objWidth = candidate.width ?? Math.max(candidate.text.length * fontSize * 0.55, 20);
                    const objHeight = candidate.height ?? Math.max(fontSize * 1.4, 18);

                    results.push({
                        pageId: page.id,
                        pageNumber: page.pageNumber,
                        objId: candidate.objId,
                        text: candidate.text,
                        matchStart: Math.max(start, 0),
                        matchEnd: Math.max(start + matchedText.length, matchedText.length),
                        matchedText,
                        x: candidate.x,
                        y: candidate.y,
                        width: objWidth,
                        height: objHeight,
                    });
                });
            });
        }
    }

    return results;
}

export function createHighlight(result: SearchResult): PDFObject {
    return {
        id: crypto.randomUUID(),
        type: 'rectangle',
        x: result.x,
        y: result.y,
        width: Math.max(result.width, 10),
        height: Math.max(result.height, 10),
        fill: '#f59e0b',
        fillOpacity: 0.18,
        stroke: '#f59e0b',
        strokeWidth: 1.5,
        opacity: 1,
        isLocked: true,
        name: 'search-highlight',
    };
}
