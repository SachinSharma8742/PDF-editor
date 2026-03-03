/**
 * Document Q&A System
 *
 * Allows users to ask natural language questions about the document.
 * Uses local TF-IDF-style chunk matching — no external API required.
 *
 * Pipeline:
 *   1. Chunk document text into searchable segments
 *   2. Build term-frequency index
 *   3. On query: score chunks by relevance
 *   4. Generate contextual answer from top chunks
 *   5. Return answer + source references
 */

// ─── Types ─────────────────────────────────────────────────────

export interface TextChunk {
    /** Chunk index */
    index: number;
    /** Chunk text content */
    content: string;
    /** Approximate page number (1-based, if available) */
    pageHint?: number;
    /** Character offset in full document */
    startOffset: number;
    /** Character end offset */
    endOffset: number;
}

export interface SourceReference {
    /** Which chunk this came from */
    chunkIndex: number;
    /** Relevance score (0-1) */
    relevance: number;
    /** The matched text segment */
    text: string;
    /** Page hint */
    pageHint?: number;
}

export interface QAAnswer {
    /** The generated answer */
    answer: string;
    /** Source references that support the answer */
    sources: SourceReference[];
    /** Confidence in the answer (0-1) */
    confidence: number;
    /** Processing time in ms */
    durationMs: number;
    /** The original question */
    question: string;
}

export interface QAIndex {
    /** All text chunks */
    chunks: TextChunk[];
    /** Term frequency map: term → chunk indices with counts */
    termIndex: Map<string, Map<number, number>>;
    /** Document frequency: term → number of chunks containing it */
    docFreq: Map<string, number>;
    /** Total chunks */
    totalChunks: number;
}

// ─── Text Chunking ─────────────────────────────────────────────

const CHUNK_SIZE = 500;       // characters per chunk
const CHUNK_OVERLAP = 100;    // overlap for context continuity

/**
 * Split document text into overlapping chunks.
 */
export function chunkText(text: string, pageBreaks?: number[]): TextChunk[] {
    const chunks: TextChunk[] = [];
    let offset = 0;
    let chunkIndex = 0;

    while (offset < text.length) {
        const end = Math.min(offset + CHUNK_SIZE, text.length);

        // Try to break at a sentence boundary
        let breakPoint = end;
        if (end < text.length) {
            const segment = text.slice(offset, end);
            const lastPeriod = segment.lastIndexOf('. ');
            const lastNewline = segment.lastIndexOf('\n');
            const bestBreak = Math.max(lastPeriod, lastNewline);
            if (bestBreak > CHUNK_SIZE * 0.3) {
                breakPoint = offset + bestBreak + 1;
            }
        }

        const content = text.slice(offset, breakPoint).trim();
        if (content.length > 10) {
            // Estimate page from page breaks
            let pageHint: number | undefined;
            if (pageBreaks) {
                for (let p = pageBreaks.length - 1; p >= 0; p--) {
                    if (offset >= pageBreaks[p]) {
                        pageHint = p + 2; // 1-based, +1 because breaks mark end of page
                        break;
                    }
                }
                if (pageHint === undefined) pageHint = 1;
            }

            chunks.push({
                index: chunkIndex++,
                content,
                pageHint,
                startOffset: offset,
                endOffset: breakPoint,
            });
        }

        offset = breakPoint - CHUNK_OVERLAP;
        if (offset <= (chunks.length > 0 ? chunks[chunks.length - 1].startOffset : -1)) {
            offset = breakPoint; // prevent infinite loop
        }
    }

    return chunks;
}

// ─── Tokenization & Indexing ──────────────────────────────────

const STOP_WORDS = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'to', 'of', 'in',
    'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
    'during', 'before', 'after', 'above', 'below', 'between', 'out',
    'it', 'its', 'this', 'that', 'these', 'those', 'and', 'but', 'or',
    'nor', 'not', 'so', 'yet', 'both', 'each', 'all', 'any', 'few',
    'more', 'most', 'other', 'some', 'such', 'no', 'only', 'own',
    'same', 'than', 'too', 'very', 'just', 'because', 'then', 'also',
]);

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Build a searchable index from text chunks.
 */
export function buildIndex(chunks: TextChunk[]): QAIndex {
    const termIndex = new Map<string, Map<number, number>>();
    const docFreq = new Map<string, number>();

    for (const chunk of chunks) {
        const tokens = tokenize(chunk.content);
        const seenInChunk = new Set<string>();

        for (const token of tokens) {
            // Term frequency per chunk
            if (!termIndex.has(token)) {
                termIndex.set(token, new Map());
            }
            const chunkMap = termIndex.get(token)!;
            chunkMap.set(chunk.index, (chunkMap.get(chunk.index) ?? 0) + 1);

            // Document frequency
            if (!seenInChunk.has(token)) {
                seenInChunk.add(token);
                docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
            }
        }
    }

    return {
        chunks,
        termIndex,
        docFreq,
        totalChunks: chunks.length,
    };
}

// ─── Query Scoring (TF-IDF) ──────────────────────────────────

function scoreChunks(query: string, index: QAIndex): { chunkIndex: number; score: number }[] {
    const queryTokens = tokenize(query);
    const scores = new Map<number, number>();

    for (const token of queryTokens) {
        const chunkMap = index.termIndex.get(token);
        if (!chunkMap) continue;

        const df = index.docFreq.get(token) ?? 1;
        const idf = Math.log(index.totalChunks / df);

        for (const [chunkIdx, tf] of chunkMap) {
            const tfidf = (1 + Math.log(tf)) * idf;
            scores.set(chunkIdx, (scores.get(chunkIdx) ?? 0) + tfidf);
        }
    }

    // Boost exact phrase matches
    const queryLower = query.toLowerCase();
    for (const chunk of index.chunks) {
        if (chunk.content.toLowerCase().includes(queryLower)) {
            const current = scores.get(chunk.index) ?? 0;
            scores.set(chunk.index, current + 5);
        }
    }

    return [...scores.entries()]
        .map(([chunkIndex, score]) => ({ chunkIndex, score }))
        .sort((a, b) => b.score - a.score);
}

// ─── Answer Generation ────────────────────────────────────────

/**
 * Extract the most relevant sentences from chunks to form an answer.
 */
function generateAnswer(question: string, topChunks: TextChunk[], scores: number[]): { answer: string; confidence: number } {
    if (topChunks.length === 0) {
        return {
            answer: 'No relevant information found in the document to answer this question.',
            confidence: 0,
        };
    }

    const questionLower = question.toLowerCase();
    const questionTokens = tokenize(question);

    // Score individual sentences within top chunks
    const scoredSentences: { text: string; score: number; chunkIdx: number }[] = [];

    for (let ci = 0; ci < topChunks.length; ci++) {
        const chunk = topChunks[ci];
        const sentences = chunk.content.split(/(?<=[.!?])\s+/).filter(s => s.length > 15);

        for (const sentence of sentences) {
            const sentLower = sentence.toLowerCase();
            let sentScore = scores[ci] * 0.3; // base from chunk relevance

            // Token overlap scoring
            for (const qt of questionTokens) {
                if (sentLower.includes(qt)) sentScore += 1;
            }

            // Exact phrase bonus
            if (sentLower.includes(questionLower)) sentScore += 3;

            // Keyword pattern matching for common question types
            if (/^(what|when|how|who|where|why)/i.test(question)) {
                // Prefer sentences with defining language
                if (/\bis\b|\bare\b|\bshall\b|\bwill\b|\bmeans\b|\brefers?\b/i.test(sentence)) {
                    sentScore += 0.5;
                }
            }

            // Date questions
            if (/when|date|expire|expir/i.test(question) && /\d{4}|\d{1,2}\/\d{1,2}|january|february|march|april|may|june|july|august|september|october|november|december/i.test(sentence)) {
                sentScore += 2;
            }

            // Amount questions
            if (/how much|cost|price|fee|amount|pay/i.test(question) && /\$[\d,]+|\d+\s*(dollars?|euros?|percent)/i.test(sentence)) {
                sentScore += 2;
            }

            scoredSentences.push({ text: sentence, score: sentScore, chunkIdx: ci });
        }
    }

    scoredSentences.sort((a, b) => b.score - a.score);

    // Take top sentences, preserving reading order
    const selectedCount = Math.min(4, scoredSentences.length);
    const selected = scoredSentences.slice(0, selectedCount);
    selected.sort((a, b) => a.chunkIdx - b.chunkIdx);

    const answer = selected.map(s => s.text.trim()).join(' ');
    const maxScore = scoredSentences[0]?.score ?? 0;
    const confidence = Math.min(maxScore / 10, 1);

    return { answer: answer || 'Could not generate a specific answer from the document.', confidence };
}

// ─── Main Q&A Function ────────────────────────────────────────

/**
 * Answer a question about the document.
 * Designed to be callable from the AI analysis worker.
 */
export function answerQuestion(fullText: string, question: string): QAAnswer {
    const start = performance.now();

    // Step 1: Chunk the text
    const chunks = chunkText(fullText);

    // Step 2: Build index
    const index = buildIndex(chunks);

    // Step 3: Score chunks by relevance to query
    const chunkScores = scoreChunks(question, index);

    // Step 4: Get top chunks
    const topN = Math.min(5, chunkScores.length);
    const topResults = chunkScores.slice(0, topN);
    const topChunks = topResults.map(r => chunks[r.chunkIndex]);
    const topScoresArr = topResults.map(r => r.score);

    // Step 5: Generate answer
    const { answer, confidence } = generateAnswer(question, topChunks, topScoresArr);

    // Step 6: Build source references
    const sources: SourceReference[] = topResults
        .filter(r => r.score > 0)
        .slice(0, 3)
        .map(r => {
            const chunk = chunks[r.chunkIndex];
            const maxPossible = Math.max(...topScoresArr, 1);
            return {
                chunkIndex: r.chunkIndex,
                relevance: Math.min(r.score / maxPossible, 1),
                text: chunk.content.slice(0, 200) + (chunk.content.length > 200 ? '…' : ''),
                pageHint: chunk.pageHint,
            };
        });

    return {
        answer,
        sources,
        confidence,
        durationMs: performance.now() - start,
        question,
    };
}
