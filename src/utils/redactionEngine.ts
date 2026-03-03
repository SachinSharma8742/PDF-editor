/**
 * Smart Redaction Engine
 *
 * Provides pattern-based sensitive content detection and redaction object creation.
 * Redaction objects are standard PDFObjects (type: 'redaction') stored in the page's
 * objects[] array. They render as opaque black rectangles in-editor and are permanently
 * flattened during export via destination-out compositing to ensure non-recoverability.
 *
 * Never mutates the PDF engine or original buffers.
 */

import type { PDFObject } from '../store/pdfStore';

// ─── Types ─────────────────────────────────────────────────────

export interface SensitivePattern {
    id: string;
    label: string;
    regex: RegExp;
    /** Optional description shown in UI */
    description?: string;
}

export interface DetectedMatch {
    patternId: string;
    patternLabel: string;
    text: string;
    /** Character start index in the source text */
    startIndex: number;
    /** Character end index in the source text */
    endIndex: number;
}

export interface RedactionRegion {
    x: number;
    y: number;
    width: number;
    height: number;
    /** Which pattern triggered this region */
    patternId?: string;
    /** The matched text */
    matchedText?: string;
}

// ─── Built-in Patterns ────────────────────────────────────────

export const BUILT_IN_PATTERNS: SensitivePattern[] = [
    {
        id: 'email',
        label: 'Email Addresses',
        regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        description: 'Matches standard email formats',
    },
    {
        id: 'phone',
        label: 'Phone Numbers',
        regex: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g,
        description: 'Matches phone numbers with optional country codes',
    },
    {
        id: 'ssn',
        label: 'Social Security Numbers',
        regex: /\b\d{3}-\d{2}-\d{4}\b/g,
        description: 'Matches US SSN format (XXX-XX-XXXX)',
    },
    {
        id: 'credit-card',
        label: 'Credit Card Numbers',
        regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        description: 'Matches 16-digit card numbers with optional separators',
    },
    {
        id: 'date',
        label: 'Dates',
        regex: /\b(?:\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}[/.-]\d{1,2}[/.-]\d{1,2})\b/g,
        description: 'Matches common date formats (MM/DD/YYYY, YYYY-MM-DD, etc.)',
    },
    {
        id: 'ip-address',
        label: 'IP Addresses',
        regex: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
        description: 'Matches IPv4 addresses',
    },
];

// ─── Detection ─────────────────────────────────────────────────

/**
 * Scan text for sensitive content using the specified patterns.
 *
 * @param text      - The full text to search (e.g. OCR output)
 * @param patterns  - Patterns to use. Defaults to all built-in patterns.
 * @returns Array of detected matches
 */
export function scanForSensitiveContent(
    text: string,
    patterns: SensitivePattern[] = BUILT_IN_PATTERNS
): DetectedMatch[] {
    const matches: DetectedMatch[] = [];

    for (const pattern of patterns) {
        // Reset lastIndex for global regexes
        const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            matches.push({
                patternId: pattern.id,
                patternLabel: pattern.label,
                text: match[0],
                startIndex: match.index,
                endIndex: match.index + match[0].length,
            });
        }
    }

    // Sort by position in text
    matches.sort((a, b) => a.startIndex - b.startIndex);

    return matches;
}

/**
 * Search text for exact matches (manual search & redact).
 *
 * @param text       - The full text to search
 * @param searchTerm - The term to find
 * @param caseSensitive - Whether to match case
 * @returns Array of detected matches
 */
export function searchText(
    text: string,
    searchTerm: string,
    caseSensitive = false
): DetectedMatch[] {
    if (!searchTerm) return [];

    const matches: DetectedMatch[] = [];
    const flags = caseSensitive ? 'g' : 'gi';
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        matches.push({
            patternId: 'manual-search',
            patternLabel: 'Search Result',
            text: match[0],
            startIndex: match.index,
            endIndex: match.index + match[0].length,
        });
    }

    return matches;
}

// ─── Redaction Object Creation ─────────────────────────────────

const generateRedactionId = () =>
    `redact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Create a single redaction PDFObject from a region.
 * The object is a solid black rectangle with no stroke and full opacity.
 */
export function createRedactionObject(region: RedactionRegion): PDFObject {
    return {
        id: generateRedactionId(),
        type: 'redaction',
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
        fill: '#000000',
        stroke: 'transparent',
        strokeWidth: 0,
        opacity: 1,
        fillOpacity: 1,
        visible: true,
        isLocked: false,
        // Store matched text as name for UI display (e.g. "Email: foo@bar.com")
        name: region.matchedText
            ? `Redaction: ${region.matchedText.slice(0, 30)}`
            : 'Redaction',
    };
}

/**
 * Batch-create redaction objects from multiple regions.
 */
export function bulkCreateRedactions(regions: RedactionRegion[]): PDFObject[] {
    return regions.map(createRedactionObject);
}

/**
 * Create a redaction object from a manually drawn rectangle.
 * Convenience wrapper for canvas interactions.
 */
export function createManualRedaction(
    x: number,
    y: number,
    width: number,
    height: number
): PDFObject {
    return createRedactionObject({ x, y, width, height });
}

// ─── Utilities ─────────────────────────────────────────────────

/**
 * Check if a PDFObject is a redaction.
 */
export function isRedactionObject(obj: PDFObject): boolean {
    return obj.type === 'redaction';
}

/**
 * Get all redaction objects from a page's objects array.
 */
export function getRedactions(objects: PDFObject[]): PDFObject[] {
    return objects.filter(isRedactionObject);
}

/**
 * Count redaction objects on a page.
 */
export function countRedactions(objects: PDFObject[]): number {
    return objects.filter(isRedactionObject).length;
}
