import React, { useEffect, useCallback } from 'react';
import { useEditorStore } from '../../../../store/editorStore';
import { Search, Replace, ChevronUp, ChevronDown, X, CaseSensitive, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

interface FindReplacePanelProps {
    textItems: any[];
}

export const FindReplacePanel: React.FC<FindReplacePanelProps> = ({ textItems }) => {
    const {
        findReplaceState,
        setSearchTerm,
        setReplaceTerm,
        toggleCaseSensitive,
        findMatches,
        navigateMatch,
        replaceCurrentMatch,
        replaceAllMatches,
        setFindReplaceOpen
    } = useEditorStore();

    const { searchTerm, replaceTerm, caseSensitive, matches, currentMatchIndex, isOpen } = findReplaceState;

    // Re-run search when search term or case sensitivity changes
    useEffect(() => {
        if (searchTerm.trim()) {
            findMatches(textItems);
        }
    }, [searchTerm, caseSensitive, textItems]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                navigateMatch('prev');
            } else {
                navigateMatch('next');
            }
        }
        if (e.key === 'Escape') {
            setFindReplaceOpen(false);
        }
    }, [navigateMatch, setFindReplaceOpen]);

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
                        onClick={() => navigateMatch('prev')}
                        disabled={matches.length === 0}
                        className="p-1 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors"
                        title="Previous (Shift+Enter)"
                    >
                        <ChevronUp size={14} />
                    </button>
                    <button
                        onClick={() => navigateMatch('next')}
                        disabled={matches.length === 0}
                        className="p-1 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors"
                        title="Next (Enter)"
                    >
                        <ChevronDown size={14} />
                    </button>
                </div>
            </div>

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
            <div className="flex items-center justify-between gap-2">
                {/* Case Sensitive Toggle */}
                <button
                    onClick={toggleCaseSensitive}
                    className={clsx(
                        "flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all",
                        caseSensitive
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white"
                    )}
                    title="Match Case"
                >
                    <CaseSensitive size={14} />
                    <span>Aa</span>
                </button>

                {/* Replace Actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={replaceCurrentMatch}
                        disabled={matches.length === 0 || currentMatchIndex < 0}
                        className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white text-xs font-medium rounded-lg transition-colors shadow-sm dark:shadow-none"
                    >
                        Replace
                    </button>
                    <button
                        onClick={replaceAllMatches}
                        disabled={matches.length === 0}
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
