import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ShieldAlert, Loader2, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import type { RiskReport, RiskFlag } from '../../../../utils/riskScoringEngine';
import type { NativeTextItem } from '../../../../store/editorStore';

interface RiskScorePanelProps {
    textItems: NativeTextItem[];
}

export const RiskScorePanel: React.FC<RiskScorePanelProps> = ({ textItems }) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [report, setReport] = useState<RiskReport | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expandedFlag, setExpandedFlag] = useState<string | null>(null);
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        return () => { workerRef.current?.terminate(); };
    }, []);

    const handleAnalyze = useCallback(() => {
        if (textItems.length === 0) {
            setError('No text items to analyze.');
            return;
        }

        setIsAnalyzing(true);
        setError(null);
        setReport(null);

        const fullText = textItems
            .map(item => item.text || (item as unknown as Record<string, string>).str || '')
            .join('\n');

        try {
            const worker = new Worker(
                new URL('../../../../workers/aiAnalysis.worker.ts', import.meta.url),
                { type: 'module' }
            );
            workerRef.current = worker;
            const requestId = `risk-${Date.now()}`;

            worker.onmessage = (e) => {
                const { type, id, result, error: workerError } = e.data;
                if (id !== requestId) return;

                if (type === 'error') {
                    setError(workerError ?? 'Risk analysis failed.');
                } else if (type === 'riskResult') {
                    setReport(result as RiskReport);
                }
                setIsAnalyzing(false);
                worker.terminate();
            };

            worker.onerror = (err) => {
                setError(err.message || 'Worker error.');
                setIsAnalyzing(false);
                worker.terminate();
            };

            worker.postMessage({ type: 'scoreRisk', id: requestId, payload: { text: fullText } });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start analysis.');
            setIsAnalyzing(false);
        }
    }, [textItems]);

    const getRiskColor = (level: string): string => {
        switch (level) {
            case 'critical': return '#ef4444';
            case 'high': return '#f97316';
            case 'moderate': return '#f59e0b';
            case 'low': return '#10b981';
            default: return '#6b7280';
        }
    };

    const getRiskBg = (level: string): string => {
        switch (level) {
            case 'critical': return 'bg-red-500/10 border-red-500/20';
            case 'high': return 'bg-orange-500/10 border-orange-500/20';
            case 'moderate': return 'bg-amber-500/10 border-amber-500/20';
            case 'low': return 'bg-emerald-500/10 border-emerald-500/20';
            default: return 'bg-zinc-500/10 border-zinc-500/20';
        }
    };

    const getSeverityLabel = (severity: number): string => {
        if (severity >= 0.7) return 'HIGH';
        if (severity >= 0.4) return 'MED';
        return 'LOW';
    };

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2 px-1">
                <ShieldAlert size={14} className="text-orange-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    Risk Analysis
                </span>
            </div>

            {/* Analyze Button */}
            <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || textItems.length === 0}
                className="w-full px-3 py-2.5 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
            >
                {isAnalyzing ? (
                    <>
                        <Loader2 size={14} className="animate-spin" />
                        Scoring Risk…
                    </>
                ) : (
                    <>
                        <ShieldAlert size={14} />
                        Analyze Risk
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

            {/* Risk Report */}
            {report && (
                <div className="space-y-3">
                    {/* Risk Meter */}
                    <div className={`p-3 rounded-xl border ${getRiskBg(report.level)}`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-white uppercase tracking-wider">
                                Overall Risk
                            </span>
                            <span
                                className="text-lg font-black"
                                style={{ color: getRiskColor(report.level) }}
                            >
                                {report.overallScore}/100
                            </span>
                        </div>

                        {/* Score Bar */}
                        <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden mb-2">
                            <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                    width: `${report.overallScore}%`,
                                    backgroundColor: getRiskColor(report.level),
                                }}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <span
                                className="text-[10px] font-bold uppercase tracking-widest"
                                style={{ color: getRiskColor(report.level) }}
                            >
                                {report.level} risk
                            </span>
                            <span className="text-[9px] text-zinc-500">
                                {report.durationMs.toFixed(0)}ms
                            </span>
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="text-[11px] text-zinc-400 leading-relaxed px-1">
                        {report.summary}
                    </div>

                    {/* Flagged Clauses */}
                    {report.flags.length > 0 && (
                        <div className="space-y-1.5">
                            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-1">
                                Risk Factors ({report.flags.length})
                            </div>

                            <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
                                {report.flags.map((flag: RiskFlag, idx: number) => {
                                    const isExpanded = expandedFlag === `${flag.category.id}-${idx}`;

                                    return (
                                        <div key={`${flag.category.id}-${idx}`} className="rounded-xl border border-white/5 overflow-hidden">
                                            <button
                                                onClick={() => setExpandedFlag(isExpanded ? null : `${flag.category.id}-${idx}`)}
                                                className="w-full flex items-center gap-2.5 p-2.5 hover:bg-white/[0.03] transition-colors text-left"
                                            >
                                                <span className="text-sm">{flag.category.icon}</span>
                                                <span className="flex-1 text-xs font-semibold text-white truncate">
                                                    {flag.category.name}
                                                </span>
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${flag.severity >= 0.7
                                                        ? 'text-red-400 bg-red-500/10 border-red-500/20'
                                                        : flag.severity >= 0.4
                                                            ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                                                            : 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20'
                                                    }`}>
                                                    {getSeverityLabel(flag.severity)} {Math.round(flag.severity * 100)}%
                                                </span>
                                                {isExpanded ? <ChevronUp size={12} className="text-zinc-500" /> : <ChevronDown size={12} className="text-zinc-500" />}
                                            </button>

                                            {isExpanded && (
                                                <div className="px-2.5 pb-2.5 space-y-2 border-t border-white/5">
                                                    <div className="mt-2 text-[11px] text-zinc-400 leading-relaxed">
                                                        {flag.reasoning}
                                                    </div>
                                                    {flag.evidence && (
                                                        <div className="text-[10px] text-zinc-500 p-2 rounded-lg bg-white/[0.02] italic">
                                                            "{flag.evidence.slice(0, 250)}{flag.evidence.length > 250 ? '…' : ''}"
                                                        </div>
                                                    )}
                                                    <div className="text-[9px] text-zinc-600">
                                                        {flag.category.description}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Clause Analysis Stats */}
                    <div className="text-[9px] text-zinc-600 px-1">
                        Based on {report.clauseAnalysis.clauses.length} detected clauses in {report.clauseAnalysis.totalSections} text sections
                    </div>
                </div>
            )}
        </div>
    );
};
