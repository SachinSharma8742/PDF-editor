import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MessageCircleQuestion, Loader2, Send, AlertCircle, BookOpen, Sparkles } from 'lucide-react';
import { usePDFStore } from '../../../store/pdfStore';
import type { QAAnswer } from '../../../utils/documentQA';

interface QAHistoryEntry {
    question: string;
    answer: QAAnswer;
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
    const [question, setQuestion] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
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

    const extractFullText = useCallback((): string => {
        const texts: string[] = [];
        for (const page of pages) {
            for (const obj of page.objects || []) {
                if (obj.type === 'text' && obj.text) {
                    texts.push(obj.text);
                }
            }
        }
        return texts.join('\n\n');
    }, [pages]);

    const handleAsk = useCallback((q?: string) => {
        const queryText = q ?? question.trim();
        if (!queryText) return;

        const text = extractFullText();
        if (!text.trim()) {
            setError('No text content found in document pages.');
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
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
                    const answer = result as QAAnswer;
                    setHistory(prev => [...prev, { question: queryText, answer }]);
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

            worker.postMessage({
                type: 'answerQuestion',
                id: requestId,
                payload: { text, question: queryText },
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start Q&A.');
            setIsProcessing(false);
        }
    }, [question, extractFullText]);

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
        <div className="p-4 flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <MessageCircleQuestion size={16} className="text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                    Ask Document
                </h3>
            </div>

            {/* Conversation Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-3 min-h-0">
                {history.length === 0 && !isProcessing && (
                    <div className="space-y-3">
                        <div className="text-center py-4">
                            <Sparkles size={24} className="mx-auto text-sky-400/30 mb-2" />
                            <p className="text-[11px] text-zinc-500">
                                Ask any question about the document
                            </p>
                        </div>

                        {/* Suggested Questions */}
                        <div className="space-y-1">
                            <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider px-1">
                                Suggested Questions
                            </div>
                            {SUGGESTED_QUESTIONS.map((sq, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleAsk(sq)}
                                    className="w-full text-left px-3 py-2 text-[11px] text-zinc-400 hover:text-sky-300 bg-white/[0.02] hover:bg-sky-500/5 border border-white/5 hover:border-sky-500/20 rounded-lg transition-all"
                                >
                                    {sq}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Q&A History */}
                {history.map((entry, idx) => (
                    <div key={idx} className="space-y-2">
                        {/* User Question */}
                        <div className="flex justify-end">
                            <div className="max-w-[85%] px-3 py-2 rounded-xl bg-sky-600/20 border border-sky-500/20 text-sky-200 text-[11px]">
                                {entry.question}
                            </div>
                        </div>

                        {/* AI Answer */}
                        <div className="space-y-1.5">
                            <div className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-zinc-300 leading-relaxed">
                                {entry.answer.answer}
                            </div>

                            {/* Sources */}
                            {entry.answer.sources.length > 0 && (
                                <div className="space-y-1 px-1">
                                    <div className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider flex items-center gap-1">
                                        <BookOpen size={8} />
                                        Sources
                                    </div>
                                    {entry.answer.sources.map((src, si) => (
                                        <div key={si} className="px-2 py-1.5 rounded-lg bg-white/[0.02] border border-white/5 text-[10px] text-zinc-500">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                {src.pageHint && (
                                                    <span className="text-[8px] px-1 py-0.5 bg-sky-500/10 text-sky-400 rounded font-bold">
                                                        P{src.pageHint}
                                                    </span>
                                                )}
                                                <span className="text-[8px] text-zinc-600">
                                                    Relevance: {Math.round(src.relevance * 100)}%
                                                </span>
                                            </div>
                                            <div className="text-zinc-500 italic leading-snug">
                                                {src.text}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Meta */}
                            <div className="flex items-center gap-2 px-1">
                                <span className={`text-[8px] font-bold ${getConfidenceColor(entry.answer.confidence)}`}>
                                    Confidence: {Math.round(entry.answer.confidence * 100)}%
                                </span>
                                <span className="text-[8px] text-zinc-600">
                                    {entry.answer.durationMs.toFixed(0)}ms
                                </span>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Loading */}
                {isProcessing && (
                    <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-zinc-500">
                        <Loader2 size={12} className="animate-spin text-sky-400" />
                        Analyzing document…
                    </div>
                )}
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-start gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[10px] mb-2">
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
                    className="flex-1 px-3 py-2 text-xs bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-sky-500/50 disabled:opacity-50"
                />
                <button
                    onClick={() => handleAsk()}
                    disabled={isProcessing || !question.trim()}
                    className="p-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-xl transition-colors shrink-0"
                >
                    <Send size={14} />
                </button>
            </div>

            {/* Disclaimer */}
            <div className="text-[8px] text-zinc-600 italic mt-1.5 px-1">
                Answers are generated by pattern matching and may not be fully accurate.
            </div>
        </div>
    );
};
