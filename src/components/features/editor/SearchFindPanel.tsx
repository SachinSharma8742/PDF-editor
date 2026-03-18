/**
 * SearchFindPanel
 *
 * Advanced Search & Find panel integrated with searchEngine.ts.
 * Searches both native PDF text layers and editor-placed text objects.
 * Supports regex, case-sensitive, whole-word, search history, and find & replace.
 *
 * Keyboard shortcuts:
 *   Ctrl/Cmd + F  — Open Find mode
 *   Ctrl/Cmd + H  — Open Replace mode
 *   Ctrl/Cmd + G  — Find next
 *   Escape        — Close panel
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    Search, X, ChevronUp, ChevronDown,
    CaseSensitive, WholeWord, Regex, Replace,
    ArrowRight, RotateCcw, Clock, Trash2, Info,
    FileText, Loader2, Star
} from 'lucide-react';
import clsx from 'clsx';
import { usePDFStore } from '../../../store/pdfStore';
import { useSearchHistory } from '../../../hooks/useSearchHistory';
import {
    searchInPDF,
    replaceText,
    createHighlight,
    type SearchOptions,
    type SearchResultItem,
} from '../../../utils/searchEngine';

interface SearchFindPanelProps {
    isOpen: boolean;
    onClose: () => void;
    defaultMode?: 'find' | 'replace';
}

export const SearchFindPanel: React.FC<SearchFindPanelProps> = ({
    isOpen,
    onClose,
    defaultMode = 'find',
}) => {
    const { pages, pdfDocument, updatePage } = usePDFStore();

    const [mode, setMode] = useState<'find' | 'replace'>(defaultMode);
    const [searchTerm, setSearchTerm] = useState('');
    const [replaceTerm, setReplaceTerm] = useState('');
    const [options, setOptions] = useState<SearchOptions>({
        caseSensitive: false,
        wholeWord: false,
        useRegex: false,
    });

    const [results, setResults] = useState<SearchResultItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [regexError, setRegexError] = useState<string | null>(null);
    const [statusMsg, setStatusMsg] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);

    const { history, addEntry, clearHistory, removeEntry } = useSearchHistory();
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Sync mode with prop
    useEffect(() => { setMode(defaultMode); }, [defaultMode]);

    // Focus on open, reset on close
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => searchInputRef.current?.focus(), 50);
        } else {
            setResults([]);
            setCurrentIndex(-1);
            setHasSearched(false);
            setRegexError(null);
            setStatusMsg(null);
            setShowHistory(false);
        }
    }, [isOpen]);

    // Keyboard shortcuts
    useEffect(() => {
        if (!isOpen) return;
        const handle = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { onClose(); return; }
            const isMeta = e.ctrlKey || e.metaKey;
            if (isMeta && e.key === 'g') {
                e.preventDefault();
                e.shiftKey ? goToPrev() : goToNext();
            }
            if (e.key === 'Enter' && document.activeElement === searchInputRef.current) {
                e.preventDefault();
                if (!hasSearched) { void runSearch(); }
                else { e.shiftKey ? goToPrev() : goToNext(); }
            }
        };
        window.addEventListener('keydown', handle);
        return () => window.removeEventListener('keydown', handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, hasSearched, results, currentIndex]);

    const runSearch = useCallback(async () => {
        setRegexError(null);
        setStatusMsg(null);
        if (!searchTerm.trim()) { setResults([]); setHasSearched(false); return; }

        // Validate regex early
        if (options.useRegex) {
            try { new RegExp(searchTerm); } catch (e) {
                setRegexError(e instanceof Error ? e.message : 'Invalid regex');
                setResults([]);
                setHasSearched(true);
                return;
            }
        }

        setIsSearching(true);
        try {
            const found = await searchInPDF(pdfDocument, searchTerm, pages, options);
            setResults(found);
            setCurrentIndex(found.length > 0 ? 0 : -1);
            setHasSearched(true);
            addEntry(searchTerm, found.length);
        } finally {
            setIsSearching(false);
        }
    }, [searchTerm, options, pdfDocument, pages, addEntry]);

    // Re-run when options change and a search has been done
    useEffect(() => {
        if (hasSearched && searchTerm.trim()) { void runSearch(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [options]);

    const goToNext = useCallback(() => {
        if (results.length === 0) return;
        setCurrentIndex((i) => (i + 1) % results.length);
    }, [results]);

    const goToPrev = useCallback(() => {
        if (results.length === 0) return;
        setCurrentIndex((i) => (i - 1 + results.length) % results.length);
    }, [results]);

    // Highlight the current match on its page by adding a temp highlight object
    const handleHighlightCurrent = useCallback(() => {
        if (currentIndex < 0 || currentIndex >= results.length) return;
        const result = results[currentIndex];
        if (!result.boundingRect) return;
        const page = pages.find((p) => p.id === result.pageId);
        if (!page) return;
        const highlight = createHighlight(result);
        updatePage(page.id, { objects: [...page.objects, highlight], isEdited: true });
        setStatusMsg(`Highlight added on page ${result.pageNumber}`);
    }, [currentIndex, results, pages, updatePage]);

    // Replace single: operates on editor text objects only
    const handleReplaceSingle = useCallback(() => {
        if (currentIndex < 0 || currentIndex >= results.length) return;
        const result = results[currentIndex];
        if (result.source !== 'object' || !result.objectId) {
            setStatusMsg('Cannot replace native PDF text — add text objects via the editor first.');
            return;
        }
        const page = pages.find((p) => p.id === result.pageId);
        if (!page) return;
        const newObjects = page.objects.map((obj) => {
            if (obj.id !== result.objectId || obj.type !== 'text' || !obj.text) return obj;
            const { result: replaced } = replaceText(obj.text, result.matchedText, replaceTerm, {
                ...options,
                useRegex: false, // single replace always literal on the exact match
            });
            return { ...obj, text: replaced };
        });
        updatePage(page.id, { objects: newObjects, isEdited: true });
        setStatusMsg('Replaced 1 occurrence');
        void runSearch();
    }, [currentIndex, results, pages, replaceTerm, options, updatePage, runSearch]);

    // Replace all: operates on editor text objects across all pages
    const handleReplaceAll = useCallback(() => {
        if (!searchTerm.trim()) return;
        let totalCount = 0;
        pages.forEach((page) => {
            let changed = false;
            const newObjects = page.objects.map((obj) => {
                if (obj.type !== 'text' || !obj.text) return obj;
                const { result: replaced, count } = replaceText(obj.text, searchTerm, replaceTerm, options);
                if (count > 0) { totalCount += count; changed = true; return { ...obj, text: replaced }; }
                return obj;
            });
            if (changed) updatePage(page.id, { objects: newObjects, isEdited: true });
        });
        setStatusMsg(`Replaced ${totalCount} occurrence${totalCount !== 1 ? 's' : ''} in editor objects`);
        setResults([]);
        setCurrentIndex(-1);
    }, [searchTerm, replaceTerm, options, pages, updatePage]);

    const selectHistory = useCallback((term: string) => {
        setSearchTerm(term);
        setShowHistory(false);
        setTimeout(() => searchInputRef.current?.focus(), 10);
    }, []);

    const toggleOption = useCallback(<K extends keyof SearchOptions>(key: K) => {
        setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    if (!isOpen) return null;

    const nativeCount = results.filter((r) => r.source === 'native').length;
    const objectCount = results.filter((r) => r.source === 'object').length;
    const currentResult = results[currentIndex];

    const panel = (
        <div
            className="fixed top-20 right-8 z-[200] w-[390px] bg-white/96 dark:bg-[#18181b]/98 backdrop-blur-2xl border border-zinc-200 dark:border-white/10 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.13)] dark:shadow-[0_30px_80px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-300"
            role="dialog"
            aria-label="Search & Find Panel"
        >
            {/* ── Header ───────────────────────────────────── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-white/5 bg-zinc-50/80 dark:bg-[#18181b]/70">
                <div className="flex items-center gap-2">
                    <Search size={15} className="text-blue-500" />
                    <span className="text-[12px] font-black text-zinc-800 dark:text-white uppercase tracking-widest">
                        Search & Find
                    </span>
                    {hasSearched && results.length > 0 && (
                        <span className="text-[9px] bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 font-black px-2 py-0.5 rounded-full">
                            {results.length}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 mr-1">
                        {(['find', 'replace'] as const).map((m) => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={clsx(
                                    "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                                    mode === m
                                        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                                )}
                            >
                                {m === 'find' ? 'Find' : 'Replace'}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-all"
                        title="Close (Esc)"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* ── Body ─────────────────────────────────────── */}
            <div className="p-4 space-y-3">
                {/* Search Input */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder={options.useRegex ? 'Search regex…' : 'Search text…'}
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setHasSearched(false); setStatusMsg(null); }}
                        onFocus={() => history.length > 0 && setShowHistory(true)}
                        onBlur={() => setTimeout(() => setShowHistory(false), 150)}
                        className={clsx(
                            "w-full bg-zinc-50 dark:bg-white/[0.04] border rounded-xl py-2.5 pl-9 pr-24 text-[12px] text-zinc-900 dark:text-white outline-none transition-all",
                            regexError
                                ? "border-red-400/70 focus:border-red-400"
                                : "border-zinc-200 dark:border-white/10 focus:border-blue-500/60 dark:focus:border-blue-500/40"
                        )}
                        aria-label="Search term"
                    />
                    {/* Option toggles */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                        {([
                            { key: 'caseSensitive' as const, Icon: CaseSensitive, title: 'Case Sensitive' },
                            { key: 'wholeWord' as const, Icon: WholeWord, title: 'Whole Word' },
                            { key: 'useRegex' as const, Icon: Regex, title: 'Use Regex' },
                        ]).map(({ key, Icon, title }) => (
                            <button
                                key={key}
                                onClick={() => toggleOption(key)}
                                title={title}
                                className={clsx(
                                    "p-1 rounded-md transition-all",
                                    options[key]
                                        ? "bg-blue-500/20 text-blue-500"
                                        : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5"
                                )}
                            >
                                <Icon size={13} />
                            </button>
                        ))}
                    </div>

                    {/* Search History dropdown */}
                    {showHistory && history.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden">
                            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100 dark:border-white/5">
                                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                                    <Clock size={10} /> Recent
                                </span>
                                <button onClick={clearHistory} className="text-[9px] text-red-400 hover:text-red-500 font-bold flex items-center gap-1">
                                    <Trash2 size={9} /> Clear
                                </button>
                            </div>
                            {history.slice(0, 8).map((entry) => (
                                <div
                                    key={entry.term}
                                    onMouseDown={() => selectHistory(entry.term)}
                                    className="flex items-center justify-between px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-white/5 cursor-pointer group"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Clock size={10} className="text-zinc-400 shrink-0" />
                                        <span className="text-[11px] text-zinc-700 dark:text-zinc-300 truncate">{entry.term}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {entry.resultCount !== undefined && (
                                            <span className="text-[9px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">{entry.resultCount}</span>
                                        )}
                                        <button
                                            onMouseDown={(e) => { e.stopPropagation(); removeEntry(entry.term); }}
                                            className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-red-400 transition-all"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {regexError && (
                    <p className="text-[10px] text-red-400 flex items-center gap-1.5 px-1">
                        <Info size={11} /> {regexError}
                    </p>
                )}

                {/* Replace input */}
                {mode === 'replace' && (
                    <div className="relative">
                        <Replace className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                        <input
                            type="text"
                            placeholder="Replace with…"
                            value={replaceTerm}
                            onChange={(e) => setReplaceTerm(e.target.value)}
                            className="w-full bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-[12px] text-zinc-900 dark:text-white outline-none focus:border-blue-500/60 dark:focus:border-blue-500/40 transition-all"
                            aria-label="Replace with"
                        />
                    </div>
                )}

                {/* Primary action row */}
                <div className="flex gap-2">
                    <button
                        onClick={() => void runSearch()}
                        disabled={isSearching}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                    >
                        {isSearching ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} strokeWidth={3} />}
                        {isSearching ? 'Searching…' : 'Find'}
                    </button>

                    {hasSearched && results.length > 0 && (
                        <>
                            <button onClick={goToPrev} className="p-2 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 rounded-xl transition-all active:scale-95" title="Previous (Shift+Enter)">
                                <ChevronUp size={14} />
                            </button>
                            <button onClick={goToNext} className="p-2 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 rounded-xl transition-all active:scale-95" title="Next (Enter / Ctrl+G)">
                                <ChevronDown size={14} />
                            </button>
                            <button
                                onClick={handleHighlightCurrent}
                                className="p-2 bg-yellow-50 dark:bg-yellow-500/10 hover:bg-yellow-100 dark:hover:bg-yellow-500/20 text-yellow-500 rounded-xl transition-all active:scale-95"
                                title="Add highlight to current match"
                            >
                                <Star size={14} />
                            </button>
                        </>
                    )}
                </div>

                {/* Replace buttons */}
                {mode === 'replace' && (
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
                            Replace All
                        </button>
                    </div>
                )}

                {/* Status message */}
                {statusMsg && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        <span className="text-[10px] text-green-400 font-bold">{statusMsg}</span>
                    </div>
                )}
            </div>

            {/* ── Results count bar ──────────────────────────── */}
            {hasSearched && (
                <div className={clsx(
                    "px-4 py-2 flex items-center justify-between border-t text-[10px]",
                    results.length > 0
                        ? "border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02]"
                        : "border-red-200/30 dark:border-red-500/10 bg-red-50/30 dark:bg-red-500/5"
                )}>
                    {results.length > 0 ? (
                        <>
                            <span className="text-zinc-500 dark:text-zinc-400 font-bold">
                                {currentIndex >= 0 ? `${currentIndex + 1} / ` : ''}{results.length} match{results.length !== 1 ? 'es' : ''}
                                {nativeCount > 0 && objectCount > 0 && (
                                    <span className="ml-1 text-zinc-400">({nativeCount} PDF, {objectCount} object{objectCount !== 1 ? 's' : ''})</span>
                                )}
                            </span>
                            <div className="flex items-center gap-1">
                                <button onClick={goToPrev} className="p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"><ChevronUp size={12} /></button>
                                <button onClick={goToNext} className="p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"><ChevronDown size={12} /></button>
                            </div>
                        </>
                    ) : (
                        <span className="text-red-400 font-bold flex items-center gap-1.5">
                            <Info size={11} /> No matches found
                        </span>
                    )}
                </div>
            )}

            {/* ── Results list ───────────────────────────────── */}
            {hasSearched && results.length > 0 && (
                <div className="max-h-52 overflow-y-auto border-t border-zinc-100 dark:border-white/5">
                    {results.map((result, i) => {
                        const before = result.contextText.slice(0, result.matchStart);
                        const matched = result.contextText.slice(result.matchStart, result.matchEnd);
                        const after = result.contextText.slice(result.matchEnd);
                        return (
                            <button
                                key={`${result.objectId ?? 'native'}-${result.matchStart}-${i}`}
                                onClick={() => setCurrentIndex(i)}
                                className={clsx(
                                    "w-full text-left px-4 py-2.5 transition-all border-b border-zinc-100/50 dark:border-white/[0.03] last:border-none hover:bg-zinc-50 dark:hover:bg-white/[0.03]",
                                    i === currentIndex && "bg-blue-50/80 dark:bg-blue-500/10"
                                )}
                            >
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className={clsx(
                                        "text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md",
                                        i === currentIndex ? "bg-blue-500 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                                    )}>P{result.pageNumber}</span>
                                    <FileText size={10} className="text-zinc-400" />
                                    <span className={clsx(
                                        "text-[8px] font-bold uppercase tracking-widest px-1 py-0.5 rounded",
                                        result.source === 'native'
                                            ? "text-indigo-400 bg-indigo-500/10"
                                            : "text-emerald-400 bg-emerald-500/10"
                                    )}>{result.source}</span>
                                </div>
                                <span className="text-[11px] text-zinc-300 dark:text-zinc-400 leading-relaxed">
                                    {before.length > 20 ? '…' + before.slice(-20) : before}
                                    <mark className="bg-yellow-400/30 text-yellow-200 dark:text-yellow-300 rounded px-0.5">{matched}</mark>
                                    {after.length > 30 ? after.slice(0, 30) + '…' : after}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── Tip box when no matches ────────────────────── */}
            {hasSearched && results.length === 0 && !regexError && (
                <div className="px-4 pb-4">
                    <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl flex gap-2.5">
                        <Info size={13} className="text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                            <strong className="text-blue-400 block mb-0.5">No matches found</strong>
                            For scanned PDFs, run <strong>OCR</strong> first to make text searchable. 
                            Only editor text objects support Find & Replace.
                        </p>
                    </div>
                </div>
            )}

            {/* ── Keyboard shortcuts bar ────────────────────── */}
            <div className="px-4 py-2 bg-zinc-50 dark:bg-[#18181b]/60 border-t border-zinc-100 dark:border-white/5 flex flex-wrap gap-x-3 gap-y-1">
                {[
                    { keys: 'Enter', label: 'Next' },
                    { keys: 'Shift+Enter', label: 'Prev' },
                    { keys: 'Ctrl+G', label: 'Find Next' },
                    { keys: 'Ctrl+H', label: 'Replace' },
                    { keys: 'Esc', label: 'Close' },
                ].map(({ keys, label }) => (
                    <span key={keys} className="text-[9px] text-zinc-400 dark:text-zinc-500">
                        <kbd className="font-mono bg-zinc-200 dark:bg-zinc-700 px-1 py-0.5 rounded text-[8px]">{keys}</kbd>{' '}{label}
                    </span>
                ))}
            </div>
        </div>
    );

    return createPortal(panel, document.body);
};

// Also export the current result for callers that need it
export type { SearchResultItem, SearchOptions };
