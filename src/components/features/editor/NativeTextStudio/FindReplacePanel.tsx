import React, { useEffect, useCallback } from 'react';
import { useEditorStore } from '../../../../store/editorStore';
import { Search, Replace, ChevronUp, ChevronDown, X, CaseSensitive, RefreshCw, Clock, Trash2, Regex, WholeWord, ListFilter, AlertTriangle, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { useSearchHistory } from '../../../../hooks/useSearchHistory';

interface FindReplacePanelProps {
    textItems: any[];
}

export const FindReplacePanel: React.FC<FindReplacePanelProps> = ({ textItems }) => {
    const {
        findReplaceState,
        setSearchTerm,
        setReplaceTerm,
        toggleCaseSensitive,
        toggleWholeWord,
        toggleRegex,
        toggleFuzzy,
        setCurrentMatchIndex,
        findMatches,
        navigateMatch,
        replaceCurrentMatch,
        replaceAllMatches,
        setFindReplaceOpen
    } = useEditorStore();
    const { history, addEntry, removeEntry, clearHistory } = useSearchHistory();

    const { searchTerm, replaceTerm, caseSensitive, wholeWord, useRegex, useFuzzy, regexError, matches, currentMatchIndex, isOpen } = findReplaceState;

    const hasFuzzyResult = matches.some((m) => m.isFuzzy);
    const canReplaceCurrent = currentMatchIndex >= 0 && currentMatchIndex < matches.length && !matches[currentMatchIndex]?.isFuzzy;
    const canReplaceAll = matches.some((m) => !m.isFuzzy);

    const filteredHistory = searchTerm.trim()
        ? history
            .filter((entry) => entry.term.toLowerCase().includes(searchTerm.trim().toLowerCase()))
            .slice(0, 5)
        : history.slice(0, 5);

    // Re-run search when search options change
    useEffect(() => {
        if (searchTerm.trim()) {
            findMatches(textItems);
        }
    }, [searchTerm, caseSensitive, wholeWord, useRegex, useFuzzy, textItems]);

    const commitSearchToHistory = useCallback(() => {
        const normalized = searchTerm.trim();
        if (!normalized) return;
        addEntry(normalized, matches.length);
    }, [searchTerm, matches.length, addEntry]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            commitSearchToHistory();
            if (e.shiftKey) {
                navigateMatch('prev');
            } else {
                navigateMatch('next');
            }
        }
        if (e.key === 'Escape') {
            setFindReplaceOpen(false);
        }
    }, [commitSearchToHistory, navigateMatch, setFindReplaceOpen]);

    if (!isOpen) return null;

    return (
        <div className="bg-white/90 dark:bg-zinc-900/80 backdrop-blur-md rounded-xl border border-zinc-200 dark:border-white/10 p-4 space-y-3 animate-in slide-in-from-top-2 duration-200 shadow-xl dark:shadow-none transition-colors">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Search size={12} className="text-indigo-600 dark:text-indigo-400" />
                    Find & Replace
                </h3>
                <button
                    onClick={() => setFindReplaceOpen(false)}
                    className="p-1 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Search Input */}
            <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Find text..."
                    className="w-full pl-9 pr-20 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-lg text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:border-indigo-500/50 transition-all shadow-inner dark:shadow-none"
                    autoFocus
                />
                {/* Match Counter & Navigation */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {matches.length > 0 && (
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mr-1 tabular-nums">
                            {currentMatchIndex + 1}/{matches.length}
                        </span>
                    )}
                    <button
                        onClick={() => {
                            commitSearchToHistory();
                            navigateMatch('prev');
                        }}
                        disabled={matches.length === 0}
                        className="p-1 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors"
                        title="Previous (Shift+Enter)"
                    >
                        <ChevronUp size={14} />
                    </button>
                    <button
                        onClick={() => {
                            commitSearchToHistory();
                            navigateMatch('next');
                        }}
                        disabled={matches.length === 0}
                        className="p-1 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors"
                        title="Next (Enter)"
                    >
                        <ChevronDown size={14} />
                    </button>
                </div>
            </div>

            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={toggleCaseSensitive}
                        className={clsx(
                            "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all",
                            caseSensitive
                                ? "bg-indigo-600 text-white"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                        )}
                        title="Case sensitive"
                    >
                        <CaseSensitive size={12} /> Aa
                    </button>
                    <button
                        onClick={toggleWholeWord}
                        className={clsx(
                            "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all",
                            wholeWord
                                ? "bg-indigo-600 text-white"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                        )}
                        title="Whole word"
                    >
                        <WholeWord size={12} /> Word
                    </button>
                    <button
                        onClick={toggleRegex}
                        className={clsx(
                            "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all",
                            useRegex
                                ? "bg-indigo-600 text-white"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                        )}
                        title="Regex"
                    >
                        <Regex size={12} /> Regex
                    </button>
                    <button
                        onClick={toggleFuzzy}
                        className={clsx(
                            "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all",
                            useFuzzy
                                ? "bg-indigo-600 text-white"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                        )}
                        title="Fuzzy typo-tolerant matching"
                    >
                        <Sparkles size={12} /> Fuzzy
                    </button>
                </div>

                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                    <ListFilter size={10} /> {matches.length} matches
                </span>
            </div>

            {regexError && (
                <div className="flex items-center gap-1.5 text-[11px] text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-md px-2 py-1.5">
                    <AlertTriangle size={12} /> {regexError}
                </div>
            )}

            {hasFuzzyResult && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-md px-2 py-1.5">
                    <Sparkles size={12} /> Typo-tolerant matches shown. Replace works on exact matches only.
                </div>
            )}

            {filteredHistory.length > 0 && (
                <div className="rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/50 p-2 space-y-1">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                            <Clock size={10} /> Recent Searches
                        </span>
                        <button
                            onClick={clearHistory}
                            className="text-[10px] text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 font-medium flex items-center gap-1"
                        >
                            <Trash2 size={10} /> Clear
                        </button>
                    </div>

                    <div className="max-h-28 overflow-y-auto pr-1 space-y-1">
                        {filteredHistory.map((entry) => (
                            <div
                                key={entry.term}
                                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700/60 group"
                            >
                                <button
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        setSearchTerm(entry.term);
                                    }}
                                    className="min-w-0 flex-1 text-left"
                                >
                                    <span className="text-xs text-zinc-700 dark:text-zinc-200 truncate block">{entry.term}</span>
                                </button>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {entry.resultCount !== undefined && (
                                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 px-1.5 py-0.5 rounded-full">
                                            {entry.resultCount}
                                        </span>
                                    )}
                                    <button
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            removeEntry(entry.term);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-all"
                                        aria-label={`Remove ${entry.term}`}
                                    >
                                        <X size={11} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {matches.length > 0 && (
                <div className="rounded-lg border border-zinc-200 dark:border-white/10 bg-white/70 dark:bg-zinc-900/50 p-2 space-y-1">
                    <div className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 px-1">Match Preview</div>
                    <div className="max-h-28 overflow-y-auto pr-1 space-y-1">
                        {matches.slice(0, 12).map((match, idx) => {
                            const before = match.text.slice(Math.max(0, match.startIndex - 16), match.startIndex);
                            const after = match.text.slice(match.endIndex, Math.min(match.text.length, match.endIndex + 20));
                            return (
                                <button
                                    key={`${match.id}-${match.startIndex}-${idx}`}
                                    onClick={() => setCurrentMatchIndex(idx)}
                                    className={clsx(
                                        "w-full text-left px-2 py-1.5 rounded-md transition-colors",
                                        idx === currentMatchIndex
                                            ? "bg-indigo-600 text-white"
                                            : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                                    )}
                                >
                                    <span className="text-[11px]">
                                        {before}
                                        <mark className={clsx("rounded px-0.5", idx === currentMatchIndex ? "bg-white/25 text-white" : "bg-yellow-300/70 text-zinc-900")}>{match.matchedText}</mark>
                                        {after}
                                    </span>
                                    {match.isFuzzy && (
                                        <span className={clsx("ml-2 text-[10px] px-1.5 py-0.5 rounded-full", idx === currentMatchIndex ? "bg-white/25 text-white" : "bg-amber-100 text-amber-700")}>fuzzy</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Replace Input */}
            <div className="relative">
                <Replace size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                <input
                    type="text"
                    value={replaceTerm}
                    onChange={(e) => setReplaceTerm(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Replace with..."
                    className="w-full pl-9 pr-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-lg text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:border-indigo-500/50 transition-all shadow-inner dark:shadow-none"
                />
            </div>

            {/* Options & Actions */}
            <div className="flex items-center justify-end gap-2">
                {/* Replace Actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={replaceCurrentMatch}
                        disabled={!canReplaceCurrent}
                        className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white text-xs font-medium rounded-lg transition-colors shadow-sm dark:shadow-none"
                    >
                        Replace
                    </button>
                    <button
                        onClick={replaceAllMatches}
                        disabled={!canReplaceAll}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-lg shadow-indigo-500/20"
                    >
                        <RefreshCw size={12} />
                        Replace All
                    </button>
                </div>
            </div>

            {/* Status Message */}
            {searchTerm && matches.length === 0 && (
                <p className="text-xs text-zinc-500 text-center py-1">
                    No matches found
                </p>
            )}
        </div>
    );
};
