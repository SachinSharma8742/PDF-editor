/**
 * NLP Worker
 *
 * Offloads clause detection and document summarization to a background thread.
 * Main thread posts { type, payload } messages; worker responds with results.
 *
 * Message types:
 *   - 'detectClauses'    → runs clauseDetection.detectClauses
 *   - 'summarize'        → runs documentSummarizer.summarizeDocument
 */

import { detectClauses } from '../utils/clauseDetection';
import { summarizeDocument, type SummaryMode } from '../utils/documentSummarizer';

interface WorkerMessage {
    type: 'detectClauses' | 'summarize';
    id: string;
    payload: {
        text: string;
        mode?: SummaryMode;
    };
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
    const { type, id, payload } = e.data;

    try {
        switch (type) {
            case 'detectClauses': {
                const result = detectClauses(payload.text);
                self.postMessage({ type: 'clauseResult', id, result });
                break;
            }
            case 'summarize': {
                const mode = payload.mode ?? 'executive';
                const result = summarizeDocument(payload.text, mode);
                self.postMessage({ type: 'summaryResult', id, result });
                break;
            }
            default:
                self.postMessage({
                    type: 'error',
                    id,
                    error: `Unknown NLP worker message type: ${type}`,
                });
        }
    } catch (err) {
        self.postMessage({
            type: 'error',
            id,
            error: err instanceof Error ? err.message : String(err),
        });
    }
};
