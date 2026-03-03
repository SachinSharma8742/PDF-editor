/**
 * AI Analysis Worker
 *
 * Offloads contract risk scoring and document Q&A to a background thread.
 * Main thread posts { type, payload } messages; worker responds with results.
 *
 * Message types:
 *   - 'scoreRisk'    → runs riskScoringEngine.scoreContractRisk
 *   - 'answerQuestion' → runs documentQA.answerQuestion
 */

import { scoreContractRisk } from '../utils/riskScoringEngine';
import { answerQuestion } from '../utils/documentQA';

interface WorkerMessage {
    type: 'scoreRisk' | 'answerQuestion';
    id: string;
    payload: {
        text: string;
        question?: string;
    };
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
    const { type, id, payload } = e.data;

    try {
        switch (type) {
            case 'scoreRisk': {
                const result = scoreContractRisk(payload.text);
                self.postMessage({ type: 'riskResult', id, result });
                break;
            }
            case 'answerQuestion': {
                if (!payload.question) {
                    self.postMessage({ type: 'error', id, error: 'No question provided.' });
                    return;
                }
                const result = answerQuestion(payload.text, payload.question);
                self.postMessage({ type: 'qaResult', id, result });
                break;
            }
            default:
                self.postMessage({
                    type: 'error',
                    id,
                    error: `Unknown AI analysis worker message type: ${type}`,
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
