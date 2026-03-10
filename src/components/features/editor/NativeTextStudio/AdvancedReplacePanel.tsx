import React, { useState, useCallback, useMemo } from 'react';
import { Search, Replace, Regex, CaseSensitive, ChevronDown, ChevronUp, Check, X, Loader2 } from 'lucide-react';
import { useEditorStore } from '../../../../store/editorStore';
import type { NativeTextItem } from '../../../../store/editorStore';
import {
    buildSearchIndex,
    semanticSearch,
    generatePreviewDiff,
    applyReplacements,
    countMatches,
    getMatchedPages,
} from '../../../../utils/semanticTextEngine';
import type { SemanticMatch, ReplacementPreview } from '../../../../utils/semanticTextEngine';

interface AdvancedReplacePanelProps {
    textItems: NativeTextItem[];
    isOpen: boolean;
}

export const AdvancedReplacePanel: React.FC<AdvancedReplacePanelProps> = ({ textItems, isOpen }) => {
    const { updateNativeTextEdit, saveToHistory } = useEditorStore();

    const [searchQuery, setSearchQuery] = useState('');
    const [replaceText, setReplaceText] = useState('');
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [useRegex, setUseRegex] = useState(false);
    const [contextFilter, setContextFilter] = useState<'all' | 'headers' | 'paragraphs'>('all');
    const [showPreview, setShowPreview] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [appliedCount, setAppliedCount] = useState<number | null>(null);

    // Build index from text items
    const index = useMemo(() => buildSearchIndex(textItems), [textItems]);

    // Run search
    const matches: SemanticMatch[] = useMemo(() => {
        if (!searchQuery.trim()) return [];
        return semanticSearch(index, searchQuery, {
            caseSensitive,
            useRegex,
            contextFilter,
        });
    }, [index, searchQuery, caseSensitive, useRegex, contextFilter]);

    // Generate previews
    const [previews, setPreviews] = useState<ReplacementPreview[]>([]);

    const handlePreview = useCallback(() => {
        if (matches.length === 0) return;
        const diffs = generatePreviewDiff(matches, replaceText);
        setPreviews(diffs);
        setShowPreview(true);
    }, [matches, replaceText]);

    const togglePreviewSelection = useCallback((index: number) => {
        setPreviews(prev => prev.map((p, i) =>
            i === index ? { ...p, selected: !p.selected } : p
        ));
    }, []);

    const handleApply = useCallback(() => {
        if (previews.length === 0) return;

        setIsApplying(true);

        try {
            // Save current state to history for undo
            saveToHistory();

            // Apply replacements
            const updatedItems = applyReplacements(previews, replaceText);
            const count = Object.keys(updatedItems).length;

            // Commit via existing pipeline
            for (const [id, item] of Object.entries(updatedItems)) {
                updateNativeTextEdit(id, item);
            }

            setAppliedCount(count);
            setShowPreview(false);
            setPreviews([]);
            setSearchQuery('');
            setReplaceText('');

            // Clear success message after 3 seconds
            setTimeout(() => setAppliedCount(null), 3000);
        } catch (err) {
            console.error('Advanced replace failed:', err);
        } finally {
            setIsApplying(false);
        }
    }, [previews, replaceText, updateNativeTextEdit, saveToHistory]);

    if (!isOpen) return null;

    const matchCount = countMatches(matches);
    const matchedPages = getMatchedPages(matches);
    const selectedCount = previews.filter(p => p.selected).length;

    return (
        <div className="space-y-3 bg-purple-500/5 border border-purple-500/20 rounded-xl p-3 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 mb-2">
                <Replace size={14} className="text-purple-400" />
                <span className="text-[10px] font-black text-purple-300 uppercase tracking-widest">Advanced Replace</span>
            </div>

            {/* Search Input */}
            <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setShowPreview(false); setPreviews([]); }}
                    placeholder="Search text..."
                    className="w-full pl-9 pr-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50"
                />
            </div>

            {/* Replace Input */}
            <div className="relative">
                <Replace size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                    type="text"
                    value={replaceText}
                    onChange={(e) => setReplaceText(e.target.value)}
                    placeholder="Replace with..."
                    className="w-full pl-9 pr-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50"
                />
            </div>

            {/* Options Row */}
            <div className="flex items-center gap-2 flex-wrap">
                <button
                    onClick={() => { setCaseSensitive(!caseSensitive); setShowPreview(false); }}
                    className={`p-1.5 rounded-md transition-colors ${caseSensitive ? 'bg-purple-600 text-white' : 'bg-white/5 text-zinc-500 hover:text-white'
                        }`}
                    title="Case Sensitive"
                >
                    <CaseSensitive size={14} />
                </button>
                <button
                    onClick={() => { setUseRegex(!useRegex); setShowPreview(false); }}
                    className={`p-1.5 rounded-md transition-colors ${useRegex ? 'bg-purple-600 text-white' : 'bg-white/5 text-zinc-500 hover:text-white'
                        }`}
                    title="Use Regex"
                >
                    <Regex size={14} />
                </button>

                {/* Context Filter */}
                <select
                    value={contextFilter}
                    onChange={(e) => { setContextFilter(e.target.value as 'all' | 'headers' | 'paragraphs'); setShowPreview(false); }}
                    className="text-[10px] bg-black/30 border border-white/10 text-zinc-300 rounded-md px-2 py-1.5 focus:outline-none"
                >
                    <option value="all">All Text</option>
                    <option value="headers">Headers Only</option>
                    <option value="paragraphs">Paragraphs Only</option>
                </select>
            </div>

            {/* Match Count */}
            {searchQuery && (
                <div className="flex items-center justify-between text-[10px]">
                    <span className={matchCount > 0 ? 'text-purple-300' : 'text-zinc-500'}>
                        {matchCount} match{matchCount !== 1 ? 'es' : ''} found
                        {matchedPages.length > 0 && ` on page${matchedPages.length > 1 ? 's' : ''} ${matchedPages.join(', ')}`}
                    </span>
                </div>
            )}

            {/* Preview / Apply */}
            {matchCount > 0 && !showPreview && (
                <button
                    onClick={handlePreview}
                    className="w-full py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-bold rounded-lg border border-purple-500/20 transition-colors flex items-center justify-center gap-2"
                >
                    <ChevronDown size={14} />
                    Preview Changes ({matchCount})
                </button>
            )}

            {/* Preview List */}
            {showPreview && previews.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {previews.map((preview, i) => (
                        <div
                            key={preview.match.id}
                            className={`p-2 rounded-lg border text-[11px] cursor-pointer transition-colors ${preview.selected
                                    ? 'bg-purple-500/10 border-purple-500/30'
                                    : 'bg-black/20 border-white/5 opacity-50'
                                }`}
                            onClick={() => togglePreviewSelection(i)}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <div className={`w-4 h-4 rounded flex items-center justify-center ${preview.selected ? 'bg-purple-600' : 'bg-white/10'
                                    }`}>
                                    {preview.selected && <Check size={10} className="text-white" />}
                                </div>
                                <span className="text-zinc-500">p.{preview.match.pageNumber}</span>
                                <span className="text-zinc-600 capitalize">{preview.match.context}</span>
                            </div>
                            <div className="pl-6 space-y-0.5">
                                <div className="text-red-400/70 line-through truncate">
                                    {preview.match.contextBefore}
                                    <span className="text-red-400 font-bold">{preview.match.matchedText}</span>
                                    {preview.match.contextAfter}
                                </div>
                                <div className="text-green-400/70 truncate">
                                    {preview.match.contextBefore}
                                    <span className="text-green-400 font-bold">{replaceText}</span>
                                    {preview.match.contextAfter}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Apply Buttons */}
            {showPreview && (
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleApply}
                        disabled={selectedCount === 0 || isApplying}
                        className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        {isApplying ? (
                            <><Loader2 size={14} className="animate-spin" /> Applying...</>
                        ) : (
                            <>Apply {selectedCount} Change{selectedCount !== 1 ? 's' : ''}</>
                        )}
                    </button>
                    <button
                        onClick={() => { setShowPreview(false); setPreviews([]); }}
                        className="p-2 bg-white/5 hover:bg-white/10 text-zinc-400 rounded-lg transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Collapse preview */}
            {showPreview && (
                <button
                    onClick={() => setShowPreview(false)}
                    className="w-full py-1 text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center justify-center gap-1 transition-colors"
                >
                    <ChevronUp size={12} />
                    Collapse Preview
                </button>
            )}

            {/* Success message */}
            {appliedCount !== null && (
                <div className="text-center text-green-400 text-[11px] font-semibold animate-in fade-in duration-300">
                    ✓ Replaced text in {appliedCount} item{appliedCount !== 1 ? 's' : ''}
                </div>
            )}
        </div>
    );
};
