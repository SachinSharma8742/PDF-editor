import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Scale, Loader2, ChevronDown, ChevronUp, AlertCircle, Plus, X } from 'lucide-react';
import type { ClauseAnalysisResult, DetectedClause } from '../../../../utils/clauseDetection';
import { addCustomClause, removeCustomClause, getAllPatterns } from '../../../../utils/clauseDetection';
import type { NativeTextItem } from '../../../../store/editorStore';

interface ClausePanelProps {
    textItems: NativeTextItem[];
}

export const ClausePanel: React.FC<ClausePanelProps> = ({ textItems }) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<ClauseAnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expandedClause, setExpandedClause] = useState<string | null>(null);
    const [showCustom, setShowCustom] = useState(false);
    const [customName, setCustomName] = useState('');
    const [customKeywords, setCustomKeywords] = useState('');
    const workerRef = useRef<Worker | null>(null);

    // Cleanup worker on unmount
    useEffect(() => {
        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    const handleAnalyze = useCallback(() => {
        if (textItems.length === 0) {
            setError('No text items to analyze.');
            return;
        }

        setIsAnalyzing(true);
        setError(null);
        setResult(null);

        // Combine all text items into full document text
        const fullText = textItems
            .map(item => item.text || (item as unknown as Record<string, string>).str || '')
            .join('\n');

        try {
            const worker = new Worker(
                new URL('../../../../workers/nlp.worker.ts', import.meta.url),
                { type: 'module' }
            );
            workerRef.current = worker;

            const requestId = `clause-${Date.now()}`;

            worker.onmessage = (e) => {
                const { type, id, result: workerResult, error: workerError } = e.data;
                if (id !== requestId) return;

                if (type === 'error') {
                    setError(workerError ?? 'Analysis failed.');
                } else if (type === 'clauseResult') {
                    setResult(workerResult as ClauseAnalysisResult);
                }
                setIsAnalyzing(false);
                worker.terminate();
            };

            worker.onerror = (err) => {
                setError(err.message || 'Worker error.');
                setIsAnalyzing(false);
                worker.terminate();
            };

            worker.postMessage({ type: 'detectClauses', id: requestId, payload: { text: fullText } });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start analysis.');
            setIsAnalyzing(false);
        }
    }, [textItems]);

    const handleAddCustom = useCallback(() => {
        const name = customName.trim();
        const keywords = customKeywords.split(',').map(k => k.trim()).filter(Boolean);
        if (!name || keywords.length === 0) return;
        addCustomClause(name, keywords);
        setCustomName('');
        setCustomKeywords('');
    }, [customName, customKeywords]);

    const getConfidenceColor = (confidence: number): string => {
        if (confidence >= 0.6) return 'text-green-400 bg-green-500/10 border-green-500/20';
        if (confidence >= 0.35) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
    };

    const getConfidenceLabel = (confidence: number): string => {
        if (confidence >= 0.6) return 'HIGH';
        if (confidence >= 0.35) return 'MED';
        return 'LOW';
    };

    // Group clauses by pattern
    const groupedClauses: Map<string, DetectedClause[]> = new Map();
    if (result) {
        for (const clause of result.clauses) {
            const key = clause.pattern.id;
            const existing = groupedClauses.get(key) || [];
            existing.push(clause);
            groupedClauses.set(key, existing);
        }
    }

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2 px-1">
                <Scale size={14} className="text-violet-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    Clause Detection
                </span>
            </div>

            {/* Analyze Button */}
            <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || textItems.length === 0}
                className="w-full px-3 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
            >
                {isAnalyzing ? (
                    <>
                        <Loader2 size={14} className="animate-spin" />
                        Analyzing…
                    </>
                ) : (
                    <>
                        <Scale size={14} />
                        Analyze Clauses
                    </>
                )}
            </button>

            {/* Custom Clause Toggle */}
            <button
                onClick={() => setShowCustom(!showCustom)}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
            >
                <Plus size={10} />
                Custom Patterns ({getAllPatterns().length - 10})
            </button>

            {showCustom && (
                <div className="space-y-2 p-2 rounded-lg bg-white/[0.02] border border-white/5">
                    <input
                        value={customName}
                        onChange={e => setCustomName(e.target.value)}
                        placeholder="Pattern name…"
                        className="w-full px-2 py-1.5 text-xs bg-white/5 border border-white/10 rounded-md text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50"
                    />
                    <input
                        value={customKeywords}
                        onChange={e => setCustomKeywords(e.target.value)}
                        placeholder="Keywords (comma separated)…"
                        className="w-full px-2 py-1.5 text-xs bg-white/5 border border-white/10 rounded-md text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50"
                    />
                    <button
                        onClick={handleAddCustom}
                        disabled={!customName.trim() || !customKeywords.trim()}
                        className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[10px] font-bold rounded-md transition-colors"
                    >
                        Add Pattern
                    </button>

                    {/* Show custom patterns */}
                    {getAllPatterns().filter(p => p.category === 'custom').map(p => (
                        <div key={p.id} className="flex items-center justify-between text-[10px] text-zinc-400 p-1.5 bg-white/[0.02] rounded">
                            <span>{p.name}</span>
                            <button onClick={() => removeCustomClause(p.id)} className="text-red-400 hover:text-red-300">
                                <X size={10} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[11px]">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    {error}
                </div>
            )}

            {/* Results */}
            {result && (
                <div className="space-y-2">
                    {/* Stats */}
                    <div className="text-[10px] text-zinc-500 px-1">
                        {result.clauses.length} clause{result.clauses.length !== 1 ? 's' : ''} detected in {result.totalSections} sections · {result.durationMs.toFixed(0)}ms
                    </div>

                    {result.clauses.length === 0 ? (
                        <div className="text-center py-6 text-zinc-600 text-xs">
                            No clauses detected in this document.
                        </div>
                    ) : (
                        <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                            {[...groupedClauses.entries()].map(([patternId, clauses]) => {
                                const primary = clauses[0];
                                const isExpanded = expandedClause === patternId;
                                const maxConf = Math.max(...clauses.map(c => c.confidence));

                                return (
                                    <div key={patternId} className="rounded-xl border border-white/5 overflow-hidden">
                                        <button
                                            onClick={() => setExpandedClause(isExpanded ? null : patternId)}
                                            className="w-full flex items-center gap-2.5 p-2.5 hover:bg-white/[0.03] transition-colors text-left"
                                        >
                                            <div
                                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                                style={{ backgroundColor: primary.pattern.color }}
                                            />
                                            <span className="flex-1 text-xs font-semibold text-white truncate">
                                                {primary.pattern.name}
                                            </span>
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getConfidenceColor(maxConf)}`}>
                                                {getConfidenceLabel(maxConf)} {Math.round(maxConf * 100)}%
                                            </span>
                                            {clauses.length > 1 && (
                                                <span className="text-[9px] text-zinc-500">×{clauses.length}</span>
                                            )}
                                            {isExpanded ? <ChevronUp size={12} className="text-zinc-500" /> : <ChevronDown size={12} className="text-zinc-500" />}
                                        </button>

                                        {isExpanded && (
                                            <div className="px-2.5 pb-2.5 space-y-2 border-t border-white/5">
                                                {clauses.map((clause, ci) => (
                                                    <div key={ci} className="mt-2 text-[11px] text-zinc-400 leading-relaxed p-2 rounded-lg bg-white/[0.02]">
                                                        <div className="text-[9px] text-zinc-600 mb-1">
                                                            Section {clause.sectionIndex + 1} · Confidence {Math.round(clause.confidence * 100)}%
                                                        </div>
                                                        {clause.matchedText.slice(0, 300)}
                                                        {clause.matchedText.length > 300 && '…'}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
