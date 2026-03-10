import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FileText, Loader2, Copy, Check, AlertCircle } from 'lucide-react';
import { usePDFStore } from '../../../store/pdfStore';
import { SUMMARY_MODES, type SummaryMode, type DocumentSummary } from '../../../utils/documentSummarizer';

export const SummarizerPanel: React.FC = () => {
    const pages = usePDFStore(s => s.pages);
    const [mode, setMode] = useState<SummaryMode>('executive');
    const [isGenerating, setIsGenerating] = useState(false);
    const [summary, setSummary] = useState<DocumentSummary | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        return () => { workerRef.current?.terminate(); };
    }, []);

    const extractFullText = useCallback((): string => {
        // Extract text from all page objects
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

    const handleGenerate = useCallback(() => {
        const text = extractFullText();
        if (!text.trim()) {
            setError('No text content found in document pages.');
            return;
        }

        setIsGenerating(true);
        setError(null);
        setSummary(null);

        try {
            const worker = new Worker(
                new URL('../../../workers/nlp.worker.ts', import.meta.url),
                { type: 'module' }
            );
            workerRef.current = worker;

            const requestId = `summary-${Date.now()}`;

            worker.onmessage = (e) => {
                const { type, id, result, error: workerError } = e.data;
                if (id !== requestId) return;

                if (type === 'error') {
                    setError(workerError ?? 'Summarization failed.');
                } else if (type === 'summaryResult') {
                    setSummary(result as DocumentSummary);
                }
                setIsGenerating(false);
                worker.terminate();
            };

            worker.onerror = (err) => {
                setError(err.message || 'Worker error.');
                setIsGenerating(false);
                worker.terminate();
            };

            worker.postMessage({
                type: 'summarize',
                id: requestId,
                payload: { text, mode },
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start summarizer.');
            setIsGenerating(false);
        }
    }, [extractFullText, mode]);

    const handleCopy = useCallback(() => {
        if (!summary) return;
        const text = summary.sections
            .map(s => `## ${s.heading}\n${s.content}`)
            .join('\n\n');
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [summary]);

    return (
        <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2">
                <FileText size={16} className="text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                    Document Summarizer
                </h3>
            </div>

            {/* Mode Selector */}
            <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Summary Type
                </label>
                <div className="grid grid-cols-1 gap-1">
                    {SUMMARY_MODES.map(m => (
                        <button
                            key={m.id}
                            onClick={() => setMode(m.id)}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all ${mode === m.id
                                    ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-300'
                                    : 'bg-white/[0.02] border border-white/5 text-zinc-400 hover:text-zinc-200 hover:border-white/10'
                                }`}
                        >
                            <span className="text-sm">{m.icon}</span>
                            <div>
                                <div className="text-[11px] font-semibold">{m.label}</div>
                                <div className="text-[9px] text-zinc-500">{m.description}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Generate Button */}
            <button
                onClick={handleGenerate}
                disabled={isGenerating || pages.length === 0}
                className="w-full px-3 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
            >
                {isGenerating ? (
                    <>
                        <Loader2 size={14} className="animate-spin" />
                        Generating…
                    </>
                ) : (
                    <>
                        <FileText size={14} />
                        Generate Summary
                    </>
                )}
            </button>

            {/* Error */}
            {error && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[11px]">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    {error}
                </div>
            )}

            {/* Generated Summary */}
            {summary && (
                <div className="space-y-3">
                    {/* Meta */}
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] text-zinc-600">
                            Generated in {summary.durationMs.toFixed(0)}ms
                        </span>
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-emerald-400 transition-colors"
                        >
                            {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>

                    {/* Sections */}
                    <div className="space-y-3">
                        {summary.sections.map((section, idx) => (
                            <div key={idx} className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                <h4 className="text-[11px] font-bold text-white mb-1.5 flex items-center gap-1.5">
                                    {section.heading}
                                    {section.score !== undefined && (
                                        <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${section.score >= 0.7
                                                ? 'text-red-400 bg-red-500/10'
                                                : section.score >= 0.4
                                                    ? 'text-amber-400 bg-amber-500/10'
                                                    : 'text-zinc-500 bg-zinc-500/10'
                                            }`}>
                                            {Math.round(section.score * 100)}%
                                        </span>
                                    )}
                                </h4>
                                <div className="text-[11px] text-zinc-400 leading-relaxed whitespace-pre-wrap">
                                    {section.content}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Disclaimer */}
                    <div className="text-[9px] text-zinc-600 italic px-1">
                        {summary.disclaimer}
                    </div>
                </div>
            )}
        </div>
    );
};
