/**
 * AI Clause Detection Engine
 *
 * Pattern-based detection of common legal / business clauses.
 * Operates entirely on extracted text — never touches PDF internals.
 *
 * Pipeline:
 *   1. Segment document text into logical sections
 *   2. Score each section against built-in clause patterns
 *   3. Return structured DetectedClause[] with confidence
 */

// ─── Types ─────────────────────────────────────────────────────

export interface ClausePattern {
    /** Unique clause identifier */
    id: string;
    /** Human-readable name */
    name: string;
    /** Primary keywords (case-insensitive match) */
    keywords: string[];
    /** Optional regex patterns for stronger signal */
    regexPatterns?: RegExp[];
    /** Minimum keyword density to consider a match (0-1) */
    minDensity?: number;
    /** Category grouping */
    category: 'legal' | 'financial' | 'operational' | 'custom';
    /** Color for UI highlight */
    color: string;
}

export interface DetectedClause {
    /** Pattern that was matched */
    pattern: ClausePattern;
    /** Confidence score (0-1) */
    confidence: number;
    /** The matched text segment */
    matchedText: string;
    /** Character offset in the full document text */
    startOffset: number;
    /** Character end offset */
    endOffset: number;
    /** Which section/paragraph index this was found in */
    sectionIndex: number;
}

export interface ClauseAnalysisResult {
    /** All detected clauses, sorted by confidence desc */
    clauses: DetectedClause[];
    /** Total sections analyzed */
    totalSections: number;
    /** Total characters analyzed */
    totalCharacters: number;
    /** Analysis duration in ms */
    durationMs: number;
}

// ─── Built-in Clause Patterns ──────────────────────────────────

const BUILTIN_PATTERNS: ClausePattern[] = [
    {
        id: 'termination',
        name: 'Termination',
        keywords: ['termination', 'terminate', 'cancellation', 'cancel', 'end of agreement', 'expiration', 'notice period', 'right to terminate'],
        regexPatterns: [
            /terminat(e|ion|ed)\s+(of|this|the)\s+(agreement|contract)/i,
            /upon\s+(\d+)\s+(days?|months?)\s+(prior\s+)?notice/i,
            /right\s+to\s+cancel/i,
        ],
        category: 'legal',
        color: '#ef4444',
    },
    {
        id: 'liability',
        name: 'Liability',
        keywords: ['liability', 'liable', 'limitation of liability', 'damages', 'indemnify', 'hold harmless', 'negligence', 'consequential damages'],
        regexPatterns: [
            /limit(ation)?\s+of\s+liability/i,
            /shall\s+not\s+be\s+(held\s+)?liable/i,
            /in\s+no\s+event\s+shall/i,
        ],
        category: 'legal',
        color: '#f97316',
    },
    {
        id: 'confidentiality',
        name: 'Confidentiality',
        keywords: ['confidential', 'confidentiality', 'non-disclosure', 'nda', 'proprietary', 'trade secret', 'sensitive information', 'classified'],
        regexPatterns: [
            /confidential(ity)?\s+(agreement|obligation|information)/i,
            /non[\s-]?disclosure/i,
            /shall\s+(not\s+)?disclose/i,
        ],
        category: 'legal',
        color: '#8b5cf6',
    },
    {
        id: 'payment-terms',
        name: 'Payment Terms',
        keywords: ['payment', 'invoice', 'net 30', 'net 60', 'due date', 'billing', 'compensation', 'fee', 'remittance', 'payable'],
        regexPatterns: [
            /net\s+\d+\s*(days?)?/i,
            /payment\s+(shall|will|is)\s+(be\s+)?(due|made)/i,
            /within\s+\d+\s+(business\s+)?days?\s+of\s+invoice/i,
        ],
        category: 'financial',
        color: '#10b981',
    },
    {
        id: 'governing-law',
        name: 'Governing Law',
        keywords: ['governing law', 'jurisdiction', 'applicable law', 'governed by', 'venue', 'arbitration', 'dispute resolution', 'court'],
        regexPatterns: [
            /govern(ed|ing)\s+(by\s+)?(the\s+)?law(s)?\s+of/i,
            /subject\s+to\s+(the\s+)?(exclusive\s+)?jurisdiction/i,
            /dispute(s)?\s+(shall|will)\s+be\s+(resolved|settled)/i,
        ],
        category: 'legal',
        color: '#3b82f6',
    },
    {
        id: 'renewal',
        name: 'Renewal Terms',
        keywords: ['renewal', 'renew', 'auto-renew', 'automatic renewal', 'extension', 'extended', 'successive terms', 'roll over'],
        regexPatterns: [
            /auto(matically)?\s*[\s-]?renew/i,
            /renew(al|ed)?\s+(for|upon)\s+(additional|successive)/i,
            /unless\s+(either\s+party|written)\s+notice/i,
        ],
        category: 'operational',
        color: '#06b6d4',
    },
    {
        id: 'indemnification',
        name: 'Indemnification',
        keywords: ['indemnify', 'indemnification', 'hold harmless', 'defend', 'indemnitor', 'indemnitee'],
        regexPatterns: [
            /indemnif(y|ication|ied)/i,
            /hold\s+(the\s+)?.*\s+harmless/i,
        ],
        category: 'legal',
        color: '#ec4899',
    },
    {
        id: 'force-majeure',
        name: 'Force Majeure',
        keywords: ['force majeure', 'act of god', 'unforeseeable', 'beyond control', 'natural disaster', 'pandemic', 'epidemic', 'war', 'strike'],
        regexPatterns: [
            /force\s+majeure/i,
            /acts?\s+of\s+god/i,
            /beyond\s+(the\s+)?(reasonable\s+)?control/i,
        ],
        category: 'legal',
        color: '#f59e0b',
    },
    {
        id: 'ip-rights',
        name: 'Intellectual Property',
        keywords: ['intellectual property', 'copyright', 'patent', 'trademark', 'trade mark', 'ip rights', 'proprietary rights', 'license', 'licensing'],
        regexPatterns: [
            /intellectual\s+property\s+(rights?)?/i,
            /all\s+(right|title|interest)/i,
            /grant(s|ed)?\s+(a\s+)?(non-exclusive|exclusive)\s+license/i,
        ],
        category: 'legal',
        color: '#a855f7',
    },
    {
        id: 'non-compete',
        name: 'Non-Compete',
        keywords: ['non-compete', 'noncompete', 'non-solicitation', 'restrictive covenant', 'compete', 'competing business'],
        regexPatterns: [
            /non[\s-]?compet(e|ition)/i,
            /non[\s-]?solicitation/i,
            /restrictive\s+covenant/i,
            /shall\s+not\s+(directly\s+or\s+indirectly\s+)?compet/i,
        ],
        category: 'operational',
        color: '#14b8a6',
    },
];

// ─── Custom patterns registry ──────────────────────────────────

const customPatterns: ClausePattern[] = [];

/**
 * Register a custom clause pattern.
 */
export function addCustomClause(
    name: string,
    keywords: string[],
    options: { category?: ClausePattern['category']; color?: string } = {}
): ClausePattern {
    const pattern: ClausePattern = {
        id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name,
        keywords,
        category: options.category ?? 'custom',
        color: options.color ?? '#6b7280',
    };
    customPatterns.push(pattern);
    return pattern;
}

/**
 * Remove a custom clause pattern.
 */
export function removeCustomClause(id: string): boolean {
    const idx = customPatterns.findIndex(p => p.id === id);
    if (idx >= 0) { customPatterns.splice(idx, 1); return true; }
    return false;
}

/**
 * Get all active patterns (built-in + custom).
 */
export function getAllPatterns(): ClausePattern[] {
    return [...BUILTIN_PATTERNS, ...customPatterns];
}

// ─── Text Segmentation ────────────────────────────────────────

/**
 * Split document text into logical sections (paragraphs / blocks).
 */
function segmentText(text: string): { content: string; startOffset: number }[] {
    const sections: { content: string; startOffset: number }[] = [];
    // Split on double newlines or section-like patterns
    const parts = text.split(/\n{2,}|\r\n{2,}/);
    let offset = 0;

    for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.length >= 20) { // Skip very short fragments
            const actualOffset = text.indexOf(trimmed, offset);
            sections.push({
                content: trimmed,
                startOffset: actualOffset >= 0 ? actualOffset : offset,
            });
        }
        offset += part.length + 1;
    }

    return sections;
}

// ─── Scoring ──────────────────────────────────────────────────

/**
 * Score a text section against a clause pattern.
 * Returns a confidence value between 0 and 1.
 */
function scoreSection(section: string, pattern: ClausePattern): number {
    const lower = section.toLowerCase();
    const words = lower.split(/\s+/).length;

    // 1. Keyword density scoring (0..0.6)
    let keywordHits = 0;
    for (const kw of pattern.keywords) {
        const kwLower = kw.toLowerCase();
        // Count occurrences
        let idx = 0;
        while ((idx = lower.indexOf(kwLower, idx)) !== -1) {
            keywordHits++;
            idx += kwLower.length;
        }
    }
    const density = Math.min(keywordHits / Math.max(words * 0.15, 1), 1);
    const keywordScore = density * 0.6;

    // 2. Regex pattern scoring (0..0.4)
    let regexScore = 0;
    if (pattern.regexPatterns && pattern.regexPatterns.length > 0) {
        let regexHits = 0;
        for (const rx of pattern.regexPatterns) {
            if (rx.test(section)) regexHits++;
        }
        regexScore = (regexHits / pattern.regexPatterns.length) * 0.4;
    }

    const total = keywordScore + regexScore;

    // Floor: at least 1 keyword must match
    if (keywordHits === 0 && regexScore === 0) return 0;

    return Math.min(total, 1);
}

// ─── Main Detection Function ──────────────────────────────────

/** Confidence threshold below which we discard matches */
const MIN_CONFIDENCE = 0.15;

/**
 * Detect clauses in the document text.
 * This function is designed to be called from the NLP worker.
 */
export function detectClauses(fullText: string): ClauseAnalysisResult {
    const start = performance.now();
    const sections = segmentText(fullText);
    const patterns = getAllPatterns();
    const clauses: DetectedClause[] = [];

    for (let si = 0; si < sections.length; si++) {
        const section = sections[si];
        for (const pattern of patterns) {
            const confidence = scoreSection(section.content, pattern);
            if (confidence >= MIN_CONFIDENCE) {
                clauses.push({
                    pattern,
                    confidence,
                    matchedText: section.content,
                    startOffset: section.startOffset,
                    endOffset: section.startOffset + section.content.length,
                    sectionIndex: si,
                });
            }
        }
    }

    // Sort by confidence descending
    clauses.sort((a, b) => b.confidence - a.confidence);

    // De-duplicate: keep only the highest-confidence match per pattern per section
    const seen = new Set<string>();
    const deduped = clauses.filter(c => {
        const key = `${c.pattern.id}:${c.sectionIndex}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    return {
        clauses: deduped,
        totalSections: sections.length,
        totalCharacters: fullText.length,
        durationMs: performance.now() - start,
    };
}
