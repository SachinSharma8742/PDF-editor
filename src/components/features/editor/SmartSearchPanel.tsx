import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    Search, Replace, X, ChevronDown, ChevronUp, Clock, Trash2,
    RotateCcw, CaseSensitive, WholeWord, Regex, ArrowRight,
    Info, FileText, ChevronRight, ChevronLeft
} from 'lucide-react';
import clsx from 'clsx';
import { useSearchHistory } from '../../../hooks/useSearchHistory';
import {
    searchAcrossPages,
    replaceSingleMatch,
    replaceAllMatches,
    type SearchOptions,
    type SearchMatch,
} from '../../../utils/batchOperations';
import { usePDFStore } from '../../../store/pdfStore';

interface SmartSearchPanelProps {
    isOpen: boolean;
    onClose: () => void;
    defaultMode?: 'find' | 'replace';
    allowReplace?: boolean;
}

export const SmartSearchPanel: React.FC<SmartSearchPanelProps> = ({ isOpen, onClose, defaultMode = 'find', allowReplace = true }) => {
    const { pages } = usePDFStore();
    const [mode, setMode] = useState<'find' | 'replace'>(allowReplace ? defaultMode : 'find');
    const [searchTerm, setSearchTerm] = useState('');
    const [replaceTerm, setReplaceTerm] = useState('');
    const [options, setOptions] = useState<SearchOptions>({
        caseSensitive: false,
        wholeWord: false,
        useRegex: false,
    });
    const [results, setResults] = useState<SearchMatch[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [hasSearched, setHasSearched] = useState(false);
    const [regexError, setRegexError] = useState<string | null>(null);
    const [searchInputFocused, setSearchInputFocused] = useState(false);
    const [replaceStatus, setReplaceStatus] = useState<string | null>(null);

    const { history, addEntry, clearHistory, removeEntry } = useSearchHistory();
    const searchInputRef = useRef<HTMLInputElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const filteredHistory = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        if (!normalizedSearch) {
            return history.slice(0, 5);
        }

        return history
            .filter((entry) => entry.term.toLowerCase().includes(normalizedSearch))
            .slice(0, 5);
    }, [history, searchTerm]);

    useEffect(() => {
        if (allowReplace) {
            setMode(defaultMode);
            return;
        }

        setMode('find');
    }, [allowReplace, defaultMode]);

    // Focus search input when panel opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => searchInputRef.current?.focus(), 50);
        } else {
            // Reset state on close
            setResults([]);
            setCurrentIndex(-1);
            setHasSearched(false);
            setRegexError(null);
            setSearchInputFocused(false);
            setReplaceStatus(null);
        }
    }, [isOpen]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMeta = e.ctrlKey || e.metaKey;

            if (e.key === 'Escape') {
                onClose();
                return;
            }

            if (!isOpen) return;

            if (isMeta && e.key === 'g' && !e.shiftKey) {
                e.preventDefault();
                goToNext();
            } else if (isMeta && e.key === 'g' && e.shiftKey) {
                e.preventDefault();
                goToPrev();
            } else if (e.key === 'Enter' && document.activeElement === searchInputRef.current) {
                e.preventDefault();
                if (e.shiftKey) {
                    goToPrev();
                } else {
                    if (!hasSearched || results.length === 0) {
                        handleSearch();
                    } else {
                        goToNext();
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, hasSearched, results, currentIndex]);

    const handleSearch = useCallback(() => {
        setRegexError(null);
        setReplaceStatus(null);

        if (!searchTerm.trim()) {
            setResults([]);
            setHasSearched(false);
            return;
        }

        // Validate regex
        if (options.useRegex) {
            try {
                new RegExp(searchTerm);
            } catch (e) {
                setRegexError(e instanceof Error ? e.message : 'Invalid regex');
                setResults([]);
                setHasSearched(true);
                return;
            }
        }

        const found = searchAcrossPages(searchTerm, options);
        setResults(found);
        setCurrentIndex(found.length > 0 ? 0 : -1);
        setHasSearched(true);
        addEntry(searchTerm, found.length);
    }, [searchTerm, options, addEntry]);

    // Re-search when options change (if already searched)
    useEffect(() => {
        if (hasSearched && searchTerm.trim()) {
            handleSearch();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [options]);

    const goToNext = useCallback(() => {
        if (results.length === 0) return;
        setCurrentIndex((prev) => (prev + 1) % results.length);
    }, [results]);

    const goToPrev = useCallback(() => {
        if (results.length === 0) return;
        setCurrentIndex((prev) => (prev - 1 + results.length) % results.length);
    }, [results]);

    const handleReplaceSingle = useCallback(() => {
        if (currentIndex < 0 || currentIndex >= results.length) return;
        replaceSingleMatch(results[currentIndex], replaceTerm, options);
        setReplaceStatus('Replaced 1 occurrence');
        // Re-search to update results
        const found = searchAcrossPages(searchTerm, options);
        setResults(found);
        // Move to next or stay
        setCurrentIndex(found.length > 0 ? Math.min(currentIndex, found.length - 1) : -1);
    }, [currentIndex, results, replaceTerm, options, searchTerm]);

    const handleReplaceAll = useCallback(() => {
        if (!searchTerm.trim()) return;
        const count = replaceAllMatches(searchTerm, replaceTerm, options);
        setReplaceStatus(`Replaced ${count} occurrence${count !== 1 ? 's' : ''}`);
        setResults([]);
        setCurrentIndex(-1);
    }, [searchTerm, replaceTerm, options]);

    const selectHistoryEntry = useCallback((term: string) => {
        setSearchTerm(term);
        setTimeout(() => searchInputRef.current?.focus(), 10);
    }, []);

    const showHistory = searchInputFocused && filteredHistory.length > 0;

    const toggleOption = useCallback((key: keyof SearchOptions) => {
        setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const highlightMatch = (text: string, match: SearchMatch) => {
        const before = text.slice(0, match.matchStart);
        const matched = text.slice(match.matchStart, match.matchEnd);
        const after = text.slice(match.matchEnd);
        return (
            <span className="text-[11px] text-zinc-300 leading-relaxed">
                {before.length > 20 ? '...' + before.slice(-20) : before}
                <mark className="bg-yellow-500/30 text-yellow-200 rounded px-0.5">{matched}</mark>
                {after.length > 30 ? after.slice(0, 30) + '...' : after}
            </span>
        );
    };

    if (!isOpen) return null;

    const totalPages = pages.length;

    const panel = (
        <div
            ref={panelRef}
            className="fixed top-20 right-8 z-[200] w-[380px] bg-white/95 dark:bg-[#1e1e20]/98 backdrop-blur-2xl border border-zinc-200 dark:border-white/10 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.12)] dark:shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-300"
            role="dialog"
            aria-label="Smart Search Panel"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-white/5 bg-zinc-50/80 dark:bg-[#18181b]/60">
                <div className="flex items-center gap-2">
                    <Search size={15} className="text-blue-500" />
                    <span className="text-[12px] font-black text-zinc-800 dark:text-white uppercase tracking-widest">
                        Smart Search
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    {allowReplace && (
                        <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 mr-1">
                            <button
                                onClick={() => setMode('find')}
                                className={clsx(
                                    "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                                    mode === 'find'
                                        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                                )}
                            >
                                Find
                            </button>
                            <button
                                onClick={() => setMode('replace')}
                                className={clsx(
                                    "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                                    mode === 'replace'
                                        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                                )}
                            >
                                Replace
                            </button>
                        </div>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-all"
                        title="Close (Esc)"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
                {/* Search Input */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder={options.useRegex ? 'Search regex...' : 'Search text...'}
                        value={searchTerm}
                        onChange={(e) => {
                            const nextTerm = e.target.value;
                            setSearchTerm(nextTerm);
                            setHasSearched(false);
                            setReplaceStatus(null);
                            setRegexError(null);
                            if (!nextTerm.trim()) {
                                setResults([]);
                                setCurrentIndex(-1);
                            }
                        }}
                        onFocus={() => setSearchInputFocused(true)}
                        onBlur={() => setTimeout(() => setSearchInputFocused(false), 120)}
                        className={clsx(
                            "w-full bg-zinc-50 dark:bg-white/[0.04] border rounded-xl py-2.5 pl-9 pr-24 text-[12px] text-zinc-900 dark:text-white outline-none transition-all",
                            regexError
                                ? "border-red-400/60 focus:border-red-400"
                                : "border-zinc-200 dark:border-white/10 focus:border-blue-500/60 dark:focus:border-blue-500/40"
                        )}
                        aria-label="Search term"
                        aria-invalid={regexError ? 'true' : undefined}
                    />

                    {/* Option toggles inside input */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                        <button
                            onClick={() => toggleOption('caseSensitive')}
                            title="Case Sensitive (match uppercase/lowercase)"
                            className={clsx(
                                "p-1 rounded-md transition-all",
                                options.caseSensitive
                                    ? "bg-blue-500/20 text-blue-500"
                                    : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5"
                            )}
                        >
                            <CaseSensitive size={13} />
                        </button>
                        <button
                            onClick={() => toggleOption('wholeWord')}
                            title="Whole Word (match complete words)"
                            className={clsx(
                                "p-1 rounded-md transition-all",
                                options.wholeWord
                                    ? "bg-blue-500/20 text-blue-500"
                                    : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5"
                            )}
                        >
                            <WholeWord size={13} />
                        </button>
                        <button
                            onClick={() => toggleOption('useRegex')}
                            title="Use Regular Expression"
                            className={clsx(
                                "p-1 rounded-md transition-all",
                                options.useRegex
                                    ? "bg-blue-500/20 text-blue-500"
                                    : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5"
                            )}
                        >
                            <Regex size={13} />
                        </button>
                    </div>
                </div>

                {showHistory && (
                    <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-white/[0.03] p-2">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                                <Clock size={10} /> Recent Searches
                            </span>
                            <button
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    clearHistory();
                                }}
                                className="text-[9px] text-red-400 hover:text-red-500 font-bold uppercase tracking-wider flex items-center gap-1"
                            >
                                <Trash2 size={9} /> Clear
                            </button>
                        </div>
                        <div className="space-y-1.5 max-h-28 overflow-y-auto pr-0.5">
                            {filteredHistory.map((entry) => (
                                <div
                                    key={entry.term}
                                    className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-white/5"
                                >
                                    <button
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            selectHistoryEntry(entry.term);
                                        }}
                                        className="min-w-0 flex-1 text-left"
                                    >
                                        <span className="text-[11px] text-zinc-700 dark:text-zinc-300 truncate block">{entry.term}</span>
                                    </button>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {entry.resultCount !== undefined && (
                                            <span className="text-[9px] text-zinc-500 bg-white dark:bg-zinc-800 px-1.5 py-0.5 rounded-full border border-zinc-200 dark:border-white/10">
                                                {entry.resultCount}
                                            </span>
                                        )}
                                        <button
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                removeEntry(entry.term);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-red-400 transition-all"
                                            aria-label={`Remove ${entry.term} from history`}
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {regexError && (
                    <p className="text-[10px] text-red-400 flex items-center gap-1.5 px-1">
                        <Info size={11} /> {regexError}
                    </p>
                )}

                {/* Replace Input */}
                {allowReplace && mode === 'replace' && (
                    <div className="relative">
                        <Replace className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                        <input
                            type="text"
                            placeholder="Replace with..."
                            value={replaceTerm}
                            onChange={(e) => setReplaceTerm(e.target.value)}
                            className="w-full bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-[12px] text-zinc-900 dark:text-white outline-none focus:border-blue-500/60 dark:focus:border-blue-500/40 transition-all"
                            aria-label="Replace term"
                        />
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={handleSearch}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                    >
                        <Search size={12} strokeWidth={3} />
                        Find
                    </button>

                    {hasSearched && results.length > 0 && (
                        <>
                            <button
                                onClick={goToPrev}
                                className="p-2 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 rounded-xl transition-all active:scale-95"
                                title="Previous match (Shift+Ctrl+G)"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <button
                                onClick={goToNext}
                                className="p-2 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 rounded-xl transition-all active:scale-95"
                                title="Next match (Ctrl+G)"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </>
                    )}
                </div>

                {/* Replace Buttons */}
                {allowReplace && mode === 'replace' && (
                    <div className="flex gap-2">
                        <button
                            onClick={handleReplaceSingle}
                            disabled={currentIndex < 0 || results.length === 0}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 disabled:opacity-40 text-zinc-700 dark:text-zinc-300 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all border border-zinc-200 dark:border-white/5 active:scale-95"
                        >
                            <ArrowRight size={11} strokeWidth={3} />
                            Replace
                        </button>
                        <button
                            onClick={handleReplaceAll}
                            disabled={!searchTerm.trim()}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-amber-500/20 active:scale-95"
                        >
                            <RotateCcw size={11} strokeWidth={3} />
                            All
                        </button>
                    </div>
                )}

                {/* Replace Status */}
                {allowReplace && replaceStatus && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        <span className="text-[10px] text-green-400 font-bold">{replaceStatus}</span>
                    </div>
                )}
            </div>

            {/* Results Count Bar */}
            {hasSearched && (
                <div className={clsx(
                    "px-4 py-2 flex items-center justify-between border-t",
                    results.length > 0
                        ? "border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02]"
                        : "border-red-200/30 dark:border-red-500/10 bg-red-50/30 dark:bg-red-500/5"
                )}>
                    {results.length > 0 ? (
                        <>
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold">
                                {currentIndex >= 0 ? `${currentIndex + 1} of ` : ''}{results.length} match{results.length !== 1 ? 'es' : ''} across {totalPages} pages
                            </span>
                            <div className="flex items-center gap-1">
                                <button onClick={goToPrev} className="p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" title="Previous">
                                    <ChevronUp size={12} />
                                </button>
                                <button onClick={goToNext} className="p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" title="Next">
                                    <ChevronDown size={12} />
                                </button>
                            </div>
                        </>
                    ) : (
                        <span className="text-[10px] text-red-400 font-bold flex items-center gap-1.5">
                            <Info size={11} /> No matches found
                        </span>
                    )}
                </div>
            )}

            {/* Results List */}
            {hasSearched && results.length > 0 && (
                <div className="max-h-52 overflow-y-auto border-t border-zinc-100 dark:border-white/5">
                    {results.map((result, i) => (
                        <button
                            key={`${result.objId}-${result.matchStart}-${i}`}
                            onClick={() => setCurrentIndex(i)}
                            className={clsx(
                                "w-full text-left px-4 py-2.5 transition-all border-b border-zinc-100/50 dark:border-white/[0.03] last:border-none hover:bg-zinc-50 dark:hover:bg-white/[0.04]",
                                i === currentIndex && "bg-blue-50/80 dark:bg-blue-500/10"
                            )}
                        >
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className={clsx(
                                    "text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md",
                                    i === currentIndex
                                        ? "bg-blue-500 text-white"
                                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                                )}>
                                    P{result.pageNumber}
                                </span>
                                <FileText size={10} className="text-zinc-400" />
                            </div>
                            {highlightMatch(result.text, result)}
                        </button>
                    ))}
                </div>
            )}

            {/* Tip: no matches */}
            {hasSearched && results.length === 0 && !regexError && (
                <div className="px-4 pb-4">
                    <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl flex gap-2.5">
                        <Info size={13} className="text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                            <strong className="text-blue-400 block mb-0.5">Tip: Missing text?</strong>
                            Scanned PDFs are images. Use the <strong>OCR Tool</strong> first to make text searchable.
                        </p>
                    </div>
                </div>
            )}

            {/* Keyboard Shortcuts hint */}
            <div className="px-4 py-2 bg-zinc-50 dark:bg-[#18181b]/60 border-t border-zinc-100 dark:border-white/5 flex flex-wrap gap-x-3 gap-y-1">
                {[
                    { keys: 'Enter', label: 'Next' },
                    { keys: 'Shift+Enter', label: 'Prev' },
                    { keys: 'Ctrl+G', label: 'Find Next' },
                    { keys: 'Esc', label: 'Close' },
                ].map(({ keys, label }) => (
                    <span key={keys} className="text-[9px] text-zinc-400 dark:text-zinc-500">
                        <kbd className="font-mono bg-zinc-200 dark:bg-zinc-700 px-1 py-0.5 rounded text-[8px]">{keys}</kbd>
                        {' '}{label}
                    </span>
                ))}
            </div>
        </div>
    );

    return createPortal(panel, document.body);
};
