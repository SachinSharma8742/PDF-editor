/**
 * Smart Document Summarizer
 *
 * Generates structured summaries of document content.
 * Operates on extracted text — no PDF engine mutations.
 *
 * Modes:
 *   - executive  — concise, high-level summary
 *   - bullet     — bullet-point key takeaways
 *   - risk       — risk-focused analysis
 *   - dates      — key date extraction
 *   - amounts    — key monetary amount extraction
 */

// ─── Types ─────────────────────────────────────────────────────

export type SummaryMode = 'executive' | 'bullet' | 'risk' | 'dates' | 'amounts';

export interface SummarySection {
    heading: string;
    content: string;
    /** Confidence / relevance score (0-1) */
    score?: number;
}

export interface DocumentSummary {
    /** Summary mode used */
    mode: SummaryMode;
    /** Generated title */
    title: string;
    /** Structured sections */
    sections: SummarySection[];
    /** ISO timestamp */
    generatedAt: string;
    /** Processing time in ms */
    durationMs: number;
    /** Disclaimer */
    disclaimer: string;
}

export interface SummaryModeInfo {
    id: SummaryMode;
    label: string;
    description: string;
    icon: string;
}

export const SUMMARY_MODES: SummaryModeInfo[] = [
    { id: 'executive', label: 'Executive Summary', description: 'Concise high-level overview', icon: '📋' },
    { id: 'bullet', label: 'Bullet Points', description: 'Key takeaways as bullet points', icon: '📌' },
    { id: 'risk', label: 'Risk Analysis', description: 'Identifies potential risks', icon: '⚠️' },
    { id: 'dates', label: 'Key Dates', description: 'Extracts important dates', icon: '📅' },
    { id: 'amounts', label: 'Key Amounts', description: 'Extracts monetary amounts', icon: '💰' },
];

// ─── Text Cleaning ─────────────────────────────────────────────

function cleanText(text: string): string {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/[\t ]+/g, ' ')       // collapse horizontal whitespace
        .replace(/\n{3,}/g, '\n\n')    // max 2 consecutive newlines
        .replace(/[^\S\n]+$/gm, '')    // trailing whitespace per line
        .trim();
}

// ─── Sentence Extraction ───────────────────────────────────────

function extractSentences(text: string): string[] {
    // Split on sentence boundaries
    const raw = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
    return raw
        .map(s => s.trim())
        .filter(s => s.length > 15 && s.length < 2000);
}

// ─── Sentence Scoring ──────────────────────────────────────────

interface ScoredSentence {
    text: string;
    score: number;
    index: number;
}

function scoreSentences(sentences: string[], boostKeywords: string[]): ScoredSentence[] {
    const total = sentences.length;

    return sentences.map((text, index) => {
        let score = 0;
        const lower = text.toLowerCase();
        const wordCount = text.split(/\s+/).length;

        // Position score — first & last paragraphs get boost
        if (index < total * 0.15) score += 0.3;
        else if (index > total * 0.85) score += 0.15;

        // Length score — medium sentences preferred
        if (wordCount >= 10 && wordCount <= 40) score += 0.2;
        else if (wordCount > 5) score += 0.1;

        // Keyword boost
        for (const kw of boostKeywords) {
            if (lower.includes(kw.toLowerCase())) {
                score += 0.15;
            }
        }

        // Contains numbers → slightly more informational
        if (/\d/.test(text)) score += 0.05;

        return { text, score: Math.min(score, 1), index };
    });
}

// ─── Mode Implementations ──────────────────────────────────────

function generateExecutiveSummary(text: string): SummarySection[] {
    const sentences = extractSentences(text);
    const scored = scoreSentences(sentences, [
        'agreement', 'contract', 'purpose', 'scope', 'objective',
        'party', 'parties', 'hereby', 'effective', 'term',
        'shall', 'must', 'will', 'obligations',
    ]);

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, Math.min(8, Math.ceil(sentences.length * 0.15)));
    top.sort((a, b) => a.index - b.index); // restore reading order

    const overview = top.map(s => s.text).join(' ');
    const wordCount = text.split(/\s+/).length;
    const pageEstimate = Math.ceil(wordCount / 300);

    return [
        { heading: 'Document Overview', content: overview || 'Insufficient text for summary.' },
        { heading: 'Statistics', content: `${wordCount.toLocaleString()} words · ~${pageEstimate} pages · ${sentences.length} sentences` },
    ];
}

function generateBulletSummary(text: string): SummarySection[] {
    const sentences = extractSentences(text);
    const scored = scoreSentences(sentences, [
        'important', 'key', 'must', 'required', 'shall', 'obligation',
        'agree', 'condition', 'provided', 'subject to',
    ]);

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, Math.min(12, Math.ceil(sentences.length * 0.2)));
    top.sort((a, b) => a.index - b.index);

    const bullets = top.map(s => `• ${s.text}`).join('\n');
    return [
        { heading: 'Key Points', content: bullets || 'No key points extracted.' },
    ];
}

function generateRiskSummary(text: string): SummarySection[] {
    const sentences = extractSentences(text);
    const riskKeywords = [
        'risk', 'penalty', 'liable', 'liability', 'breach', 'default',
        'terminate', 'termination', 'damage', 'loss', 'fine', 'forfeit',
        'violation', 'non-compliance', 'negligence', 'indemnify', 'warranty',
        'disclaimer', 'limitation', 'exclusion', 'force majeure',
    ];

    const scored = scoreSentences(sentences, riskKeywords);
    const risks = scored.filter(s => {
        const lower = s.text.toLowerCase();
        return riskKeywords.some(k => lower.includes(k));
    });
    risks.sort((a, b) => b.score - a.score);
    const top = risks.slice(0, 10);
    top.sort((a, b) => a.index - b.index);

    if (top.length === 0) {
        return [{ heading: 'Risk Assessment', content: 'No significant risk indicators detected.' }];
    }

    const items = top.map(s => `⚠ ${s.text}`).join('\n');
    return [
        { heading: 'Identified Risks', content: items },
        { heading: 'Risk Level', content: risks.length >= 8 ? 'HIGH — Multiple risk indicators detected' : risks.length >= 4 ? 'MEDIUM — Some risk indicators present' : 'LOW — Few risk indicators detected', score: Math.min(risks.length / 10, 1) },
    ];
}

function generateDatesSummary(text: string): SummarySection[] {
    const datePatterns = [
        // ISO dates: 2024-01-15
        /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g,
        // US dates: 01/15/2024, January 15, 2024
        /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
        // Short month: Jan 15, 2024
        /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b/gi,
        // DD/MM/YYYY or MM/DD/YYYY
        /\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/g,
        // Relative: within 30 days, 90-day notice
        /\b\d+[\s-]?(?:day|week|month|year)s?\b/gi,
    ];

    const dates = new Set<string>();
    const contextMap = new Map<string, string>();

    const sentences = text.split(/[.!?]\s+/);

    for (const sentence of sentences) {
        for (const pattern of datePatterns) {
            pattern.lastIndex = 0;
            let match: RegExpExecArray | null;
            while ((match = pattern.exec(sentence)) !== null) {
                const dateStr = match[0].trim();
                if (!dates.has(dateStr)) {
                    dates.add(dateStr);
                    contextMap.set(dateStr, sentence.trim().slice(0, 150));
                }
            }
        }
    }

    if (dates.size === 0) {
        return [{ heading: 'Key Dates', content: 'No dates detected in document.' }];
    }

    const items = [...contextMap.entries()]
        .map(([date, context]) => `📅 ${date}\n   └ ${context}`)
        .join('\n\n');

    return [
        { heading: `Key Dates (${dates.size} found)`, content: items },
    ];
}

function generateAmountsSummary(text: string): SummarySection[] {
    const amountPatterns = [
        // $1,234.56 or $1,234
        /\$[\d,]+(?:\.\d{1,2})?\b/g,
        // USD/EUR/GBP amounts
        /\b(?:USD|EUR|GBP|INR|JPY|CAD|AUD)\s*[\d,]+(?:\.\d{1,2})?\b/gi,
        // Written amounts: 1,000 dollars
        /\b[\d,]+(?:\.\d{1,2})?\s*(?:dollars?|euros?|pounds?|rupees?)\b/gi,
        // Percentage
        /\b\d+(?:\.\d+)?%/g,
    ];

    const amounts = new Set<string>();
    const contextMap = new Map<string, string>();
    const sentences = text.split(/[.!?]\s+/);

    for (const sentence of sentences) {
        for (const pattern of amountPatterns) {
            pattern.lastIndex = 0;
            let match: RegExpExecArray | null;
            while ((match = pattern.exec(sentence)) !== null) {
                const amtStr = match[0].trim();
                if (!amounts.has(amtStr)) {
                    amounts.add(amtStr);
                    contextMap.set(amtStr, sentence.trim().slice(0, 150));
                }
            }
        }
    }

    if (amounts.size === 0) {
        return [{ heading: 'Key Amounts', content: 'No monetary amounts detected.' }];
    }

    const items = [...contextMap.entries()]
        .map(([amt, context]) => `💰 ${amt}\n   └ ${context}`)
        .join('\n\n');

    return [
        { heading: `Key Amounts (${amounts.size} found)`, content: items },
    ];
}

// ─── Main Summarization Function ──────────────────────────────

/**
 * Generate a document summary. Designed to be callable from worker.
 */
export function summarizeDocument(fullText: string, mode: SummaryMode): DocumentSummary {
    const start = performance.now();
    const cleaned = cleanText(fullText);

    let sections: SummarySection[];

    switch (mode) {
        case 'executive':
            sections = generateExecutiveSummary(cleaned);
            break;
        case 'bullet':
            sections = generateBulletSummary(cleaned);
            break;
        case 'risk':
            sections = generateRiskSummary(cleaned);
            break;
        case 'dates':
            sections = generateDatesSummary(cleaned);
            break;
        case 'amounts':
            sections = generateAmountsSummary(cleaned);
            break;
        default:
            sections = [{ heading: 'Error', content: `Unknown mode: ${mode}` }];
    }

    const modeMeta = SUMMARY_MODES.find(m => m.id === mode);

    return {
        mode,
        title: modeMeta?.label ?? mode,
        sections,
        generatedAt: new Date().toISOString(),
        durationMs: performance.now() - start,
        disclaimer: 'This summary was auto-generated and may not capture all nuances. Review the original document for accuracy.',
    };
}
