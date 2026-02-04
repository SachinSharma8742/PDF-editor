import React, { useState } from 'react';
import { usePDFStore } from '../../../store/pdfStore';
import { Search, Replace, RefreshCw, ChevronLeft, ChevronRight, FileText, Target, Info } from 'lucide-react';
import { useEditorStore } from '../../../store/editorStore';

export const SearchReplacePanel: React.FC = () => {
    const { pages, updatePage } = usePDFStore();
    const { isActive, currentPage, updateObject, selectObject, originalPageId } = useEditorStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [replaceTerm, setReplaceTerm] = useState('');
    const [results, setResults] = useState<{ pageId: string, objId: string, text: string, pageNumber: number, isEditorPage?: boolean }[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = () => {
        if (!searchTerm) {
            setResults([]);
            return;
        }

        setIsSearching(true);
        const allResults: typeof results = [];

        // Search in main store pages
        pages.forEach(page => {
            // Skip the page that is currently being edited in EditorStore to avoid double results
            if (isActive && page.id === originalPageId) return;

            page.objects.forEach(obj => {
                if (obj.type === 'text' && obj.text?.toLowerCase().includes(searchTerm.toLowerCase())) {
                    allResults.push({
                        pageId: page.id,
                        objId: obj.id,
                        text: obj.text,
                        pageNumber: page.pageNumber
                    });
                }
            });
        });

        // Search in EditorStore's current page
        if (isActive && currentPage) {
            currentPage.objects.forEach(obj => {
                if (obj.type === 'text' && obj.text?.toLowerCase().includes(searchTerm.toLowerCase())) {
                    allResults.push({
                        pageId: currentPage.id,
                        objId: obj.id,
                        text: obj.text,
                        pageNumber: currentPage.pageNumber,
                        isEditorPage: true
                    });
                }
            });
        }

        setResults(allResults);
        setIsSearching(false);
    };

    const handleReplaceAll = () => {
        if (!searchTerm) return;

        pages.forEach(page => {
            let pageChanged = false;
            const newObjects = page.objects.map(obj => {
                if (obj.type === 'text' && obj.text?.toLowerCase().includes(searchTerm.toLowerCase())) {
                    pageChanged = true;
                    // Case insensitive replace is tricky in JS if we want to preserve case, 
                    // but for now simple global replace.
                    const regex = new RegExp(searchTerm, 'gi');
                    return { ...obj, text: obj.text.replace(regex, replaceTerm) };
                }
                return obj;
            });

            if (pageChanged) {
                updatePage(page.id, { objects: newObjects });
            }
        });

        handleSearch(); // Refresh results
        alert('Replacement complete!');
    };

    const handleReplaceSingle = (pageId: string, objId: string, isEditorPage?: boolean) => {
        if (isEditorPage) {
            const obj = currentPage?.objects.find(o => o.id === objId);
            if (!obj || obj.type !== 'text' || !obj.text) return;
            const regex = new RegExp(searchTerm, 'gi');
            updateObject(objId, { text: obj.text.replace(regex, replaceTerm) });
        } else {
            const page = pages.find(p => p.id === pageId);
            if (!page) return;
            const obj = page.objects.find(o => o.id === objId);
            if (!obj || obj.type !== 'text' || !obj.text) return;
            const regex = new RegExp(searchTerm, 'gi');
            const newObjects = page.objects.map(o => o.id === objId ? { ...o, text: o.text!.replace(regex, replaceTerm) } : o);
            updatePage(pageId, { objects: newObjects });
        }
        handleSearch();
    };

    const handleJumpToResult = (res: typeof results[0]) => {
        if (res.isEditorPage) {
            selectObject(res.objId);
            // Scroll logic would go here if we had a ref to the canvas or a way to trigger scroll
        } else {
            // Could switch page in main store maybe?
        }
    };

    return (
        <div className="flex flex-col h-full gap-4">
            <div className="space-y-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                    <input
                        type="text"
                        placeholder="Search for text..."
                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs text-white outline-none focus:border-blue-500/50"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                </div>

                <div className="relative">
                    <Replace className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                    <input
                        type="text"
                        placeholder="Replace with..."
                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs text-white outline-none focus:border-blue-500/50"
                        value={replaceTerm}
                        onChange={(e) => setReplaceTerm(e.target.value)}
                    />
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={handleSearch}
                        className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2 text-xs font-bold transition-all border border-white/5"
                    >
                        {isSearching ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
                        Find
                    </button>
                    <button
                        onClick={handleReplaceAll}
                        disabled={results.length === 0}
                        className="flex-2 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl py-2 px-4 text-xs font-bold transition-all shadow-lg shadow-blue-900/20"
                    >
                        <Replace size={14} />
                        Replace All
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar border-t border-white/5 pt-4">
                <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        Results ({results.length})
                    </span>
                </div>

                <div className="space-y-2">
                    {results.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-zinc-600 gap-2">
                            <FileText size={20} strokeWidth={1.5} />
                            <span className="text-[10px] uppercase font-bold tracking-tighter">No matches found</span>
                        </div>
                    ) : (
                        results.map((res, i) => (
                            <div key={`${res.objId}-${i}`} className="bg-white/[0.02] border border-white/5 rounded-xl p-3 hover:bg-white/[0.04] transition-all group">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-blue-400">Page {res.pageNumber + 1}</span>
                                        {res.isEditorPage && <span className="text-[8px] bg-blue-500/20 text-blue-300 px-1 rounded">EDITOR</span>}
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => handleJumpToResult(res)}
                                            className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition-all"
                                            title="Highlight in canvas"
                                        >
                                            <Target size={12} />
                                        </button>
                                        <button
                                            onClick={() => handleReplaceSingle(res.pageId, res.objId, res.isEditorPage)}
                                            className="text-[10px] bg-white/5 hover:bg-blue-600 px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-all text-white border border-white/5"
                                        >
                                            Replace
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[11px] text-zinc-300 line-clamp-2 leading-relaxed italic">
                                    "{res.text}"
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {results.length === 0 && !isSearching && (
                <div className="mx-1 p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl flex gap-3">
                    <Info size={14} className="text-blue-400 shrink-0" />
                    <p className="text-[10px] text-zinc-400 leading-tight">
                        <strong className="text-blue-300 block mb-0.5">Tip: Missing text?</strong>
                        Scanned PDFs are images. Use the <strong>OCR Tool</strong> to make text searchable and editable.
                    </p>
                </div>
            )}
        </div>
    );
};
