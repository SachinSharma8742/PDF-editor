import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MessageCircleQuestion, Loader2, Send, AlertCircle, BookOpen, Sparkles, Zap } from 'lucide-react';
import { usePDFStore } from '../../../store/pdfStore';
import type { QAAnswer } from '../../../utils/documentQA';
import { extractDocumentText } from '../../../utils/extractDocumentText';
import { isGeminiAvailable, askGemini, buildQAPrompt } from '../../../utils/geminiClient';
import { expandQuery, suggestFeatures } from '../../../utils/queryExpander';
import { AppFeatureSuggestion } from './AppFeatureSuggestion';
import type { AppFeature } from '../../../utils/appFeatures';

interface QAHistoryEntry {
    question: string;
    answer: QAAnswer;
    suggestions: AppFeature[];
}

// Highlights page references like "page 3", "pages 3-5", "p. 4" in answer text
function AnswerText({ text }: { text: string }) {
    const parts = text.split(/((?:pages?\s*\d+(?:\s*[-–]\s*\d+)?|p\.\s*\d+))/gi);
    return (
        <>
            {parts.map((part, i) =>
                /^(?:pages?\s*\d+|p\.\s*\d+)/i.test(part) ? (
                    <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-sky-500/20 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold text-[10px] mx-0.5 border border-sky-400/30">
                        {part}
                    </span>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </>
    );
}

const SUGGESTED_QUESTIONS = [
    'What is the termination notice period?',
    'What are the payment terms?',
    'Who is liable for damages?',
    'When does the contract expire?',
    'What confidentiality obligations exist?',
    'What are the renewal terms?',
];

export const DocumentQAPanel: React.FC = () => {
    const pages = usePDFStore(s => s.pages);
    const pdfDocument = usePDFStore(s => s.pdfDocument);
    const [question, setQuestion] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [extractionStatus, setExtractionStatus] = useState<string>('');
    const [history, setHistory] = useState<QAHistoryEntry[]>([]);
    const [error, setError] = useState<string | null>(null);
    const workerRef = useRef<Worker | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        return () => { workerRef.current?.terminate(); };
    }, []);

    // Scroll to bottom on new answer
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [history]);

    const handleAsk = useCallback(async (q?: string) => {
        const queryText = q ?? question.trim();
        if (!queryText) return;

        setIsProcessing(true);
        setError(null);
        setExtractionStatus('Extracting text…');

        // ── Local processing (zero tokens) ──────────────────────
        const expanded = expandQuery(queryText);
        const suggestions = suggestFeatures(queryText);

        const text = await extractDocumentText(pdfDocument, pages, (p) => {
            const method = p.method === 'ocr' ? 'OCR' : 'native';
            setExtractionStatus(`Page ${p.current}/${p.total} — ${method}`);
        });

        setExtractionStatus('');

        if (!text.trim()) {
            setError('No text content found in document pages.');
            setIsProcessing(false);
            return;
        }

        try {
            if (isGeminiAvailable()) {
                // ── Groq path (uses expanded query) ─────────────────
                setExtractionStatus('Asking Groq…');
                const rawAnswer = await askGemini(buildQAPrompt(text, expanded));
                setHistory(prev => [...prev, {
                    question: queryText,
                    suggestions,
                    answer: {
                        answer: rawAnswer,
                        sources: [],
                        confidence: 1,
                        durationMs: 0,
                        question: queryText,
                    } satisfies QAAnswer,
                }]);
                setQuestion('');
                setIsProcessing(false);
            } else {
                // ── Fallback: local TF-IDF worker ────────────────────
                const worker = new Worker(
                    new URL('../../../workers/aiAnalysis.worker.ts', import.meta.url),
                    { type: 'module' }
                );
                workerRef.current = worker;
                const requestId = `qa-${Date.now()}`;

                worker.onmessage = (e) => {
                    const { type, id, result, error: workerError } = e.data;
                    if (id !== requestId) return;
                    if (type === 'error') {
                        setError(workerError ?? 'Q&A processing failed.');
                    } else if (type === 'qaResult') {
                        setHistory(prev => [...prev, { question: queryText, suggestions, answer: result as QAAnswer }]);
                        setQuestion('');
                    }
                    setIsProcessing(false);
                    worker.terminate();
                };

                worker.onerror = (err) => {
                    setError(err.message || 'Worker error.');
                    setIsProcessing(false);
                    worker.terminate();
                };

                worker.postMessage({ type: 'answerQuestion', id: requestId, payload: { text, question: queryText } });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start Q&A.');
            setIsProcessing(false);
        }
    }, [question, pdfDocument, pages]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAsk();
        }
    }, [handleAsk]);

    const getConfidenceColor = (c: number): string => {
        if (c >= 0.6) return 'text-emerald-400';
        if (c >= 0.3) return 'text-amber-400';
        return 'text-zinc-500';
    };

    return (
        <div className="p-4 flex flex-col h-full bg-zinc-50 dark:bg-transparent transition-colors">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                    <MessageCircleQuestion size={16} className="text-sky-600 dark:text-sky-400" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                        Ask Document
                    </h3>
                </div>
                {isGeminiAvailable() && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-[9px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                        <Zap size={8} />
                        Groq
                    </span>
                )}
            </div>

            {/* Conversation Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-3 min-h-0 custom-scrollbar">
                {history.length === 0 && !isProcessing && (
                    <div className="space-y-3">
                        <div className="text-center py-4">
                            <Sparkles size={24} className="mx-auto text-sky-400/30 mb-2" />
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-500">
                                Ask any question about the document
                            </p>
                        </div>

                        {/* Suggested Questions */}
                        <div className="space-y-1">
                            <div className="text-[9px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-wider px-1">
                                Suggested Questions
                            </div>
                            {SUGGESTED_QUESTIONS.map((sq, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleAsk(sq)}
                                    className="w-full text-left px-3 py-2 text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-sky-600 dark:hover:text-sky-300 bg-white dark:bg-white/[0.02] hover:bg-sky-50 dark:hover:bg-sky-500/5 border border-zinc-200 dark:border-white/5 hover:border-sky-200 dark:hover:border-sky-500/20 rounded-lg transition-all shadow-sm dark:shadow-none"
                                >
                                    {sq}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Q&A History */}
                {history.map((entry, idx) => (
                    <div key={idx} className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* User Question */}
                        <div className="flex justify-end">
                            <div className="max-w-[85%] px-3 py-2 rounded-xl bg-sky-600/10 dark:bg-sky-600/20 border border-sky-500/20 text-sky-700 dark:text-sky-200 text-[11px] shadow-sm">
                                {entry.question}
                            </div>
                        </div>

                        {/* AI Answer */}
                        <div className="space-y-1.5">
                            <div className="px-3 py-2.5 rounded-xl bg-white dark:bg-white/[0.03] border border-zinc-200 dark:border-white/5 text-[11px] text-zinc-700 dark:text-zinc-300 leading-relaxed shadow-sm transition-colors">
                                <AnswerText text={entry.answer.answer} />
                            </div>

                            {/* Sources */}
                            {entry.answer.sources.length > 0 && (
                                <div className="space-y-1 px-1">
                                    <div className="text-[9px] text-zinc-400 dark:text-zinc-600 font-bold uppercase tracking-wider flex items-center gap-1">
                                        <BookOpen size={8} />
                                        Sources
                                    </div>
                                    {entry.answer.sources.map((src, si) => (
                                        <div key={si} className="px-2 py-1.5 rounded-lg bg-zinc-100 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 text-[10px] text-zinc-500 dark:text-zinc-500">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                {src.pageHint && (
                                                    <span className="text-[8px] px-1 py-0.5 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded font-bold">
                                                        P{src.pageHint}
                                                    </span>
                                                )}
                                                <span className="text-[8px] text-zinc-400 dark:text-zinc-600">
                                                    Relevance: {Math.round(src.relevance * 100)}%
                                                </span>
                                            </div>
                                            <div className="text-zinc-600 dark:text-zinc-500 italic leading-snug">
                                                {src.text}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Meta */}
                            <div className="flex items-center gap-2 px-1">
                                {entry.answer.sources.length === 0 ? (
                                    <span className="flex items-center gap-1 text-[8px] font-bold text-sky-600 dark:text-sky-400">
                                        <Zap size={8} /> Groq AI
                                    </span>
                                ) : (
                                    <span className={`text-[8px] font-bold ${getConfidenceColor(entry.answer.confidence)}`}>
                                        Confidence: {Math.round(entry.answer.confidence * 100)}%
                                    </span>
                                )}
                                {entry.answer.durationMs > 0 && (
                                    <span className="text-[8px] text-zinc-400 dark:text-zinc-600">
                                        {entry.answer.durationMs.toFixed(0)}ms
                                    </span>
                                )}
                            </div>

                            {/* App Feature Suggestion — shown below answer, never interrupts it */}
                            {entry.suggestions.length > 0 && (
                                <AppFeatureSuggestion features={entry.suggestions} />
                            )}
                        </div>
                    </div>
                ))}

                {/* Loading */}
                {isProcessing && (
                    <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-zinc-500">
                        <Loader2 size={12} className="animate-spin text-sky-500 dark:text-sky-400" />
                        {extractionStatus || 'Analyzing document…'}
                    </div>
                )}
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-start gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-300 text-[10px] mb-2">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    {error}
                </div>
            )}

            {/* Input */}
            <div className="flex gap-2 items-end">
                <input
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask a question…"
                    disabled={isProcessing}
                    className="flex-1 px-3 py-2 text-xs bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-sky-500/50 disabled:opacity-50 transition-all shadow-sm dark:shadow-none"
                />
                <button
                    onClick={() => handleAsk()}
                    disabled={isProcessing || !question.trim()}
                    className="p-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-xl transition-colors shrink-0 shadow-lg shadow-sky-500/20"
                >
                    <Send size={14} />
                </button>
            </div>

            {/* Disclaimer */}
            <div className="text-[8px] text-zinc-400 dark:text-zinc-600 italic mt-1.5 px-1">
                Answers are generated by pattern matching and may not be fully accurate.
            </div>
        </div>
    );
};
