import React from 'react';
import { useEditorStore } from '../../../../store/editorStore';
import { usePDFStore } from '../../../../store/pdfStore';
import { Slider, ColorGrid, SimpleInput, ToggleButton } from './PropertyComponents';
import {
    Wand2, LayoutTemplate,
    Trash2, Eraser, ArrowUpToLine, ArrowDownToLine,
    Maximize2, RotateCw, Repeat, Type
} from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';

export const PagePropertyPanel: React.FC = () => {
    const { currentPage, updateCurrentPage } = useEditorStore();
    const { updatePage, deletePage, removeBlankPages, applyStructureToAllPages } = usePDFStore();

    if (!currentPage) return null;

    const handleUpdate = (updates: any) => {
        // Update both stores for immediate visual feedback
        updatePage(currentPage.id, updates);      // Persist to pdfStore
        updateCurrentPage(updates);                // Update editorStore for canvas
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#1e1e20] text-zinc-900 dark:text-white transition-colors duration-500">
            {/* Header */}
            <div className="px-6 py-5 border-b border-zinc-100 dark:border-white/5 bg-white/50 dark:bg-[#18181b] sticky top-0 z-10 backdrop-blur-xl transition-colors">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20 shadow-sm">
                        <LayoutTemplate size={16} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-zinc-900 dark:text-zinc-200">
                            Page Architect
                        </h3>
                        <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest mt-1">
                            Refining Page {currentPage.pageNumber}
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-2 overflow-y-auto custom-scrollbar bg-zinc-50/30 dark:bg-transparent">

                {/* --- Section 1: Page Setup & Operations --- */}
                <CollapsibleSection
                    title="Setup & Operations"
                    icon={<Maximize2 size={12} />}
                    storageKey="page_setup"
                >
                    <div className="space-y-4">
                        {/* Geometry & Presets */}
                        <div className="space-y-4 bg-white/50 dark:bg-white/[0.02] p-4 rounded-2xl border border-zinc-200 dark:border-white/5 shadow-inner dark:shadow-none transition-colors duration-300">
                            <div className="grid grid-cols-4 gap-2">
                                {['A4', 'Letter', 'Legal', 'Tabloid'].map(preset => (
                                    <button
                                        key={preset}
                                        onClick={() => {
                                            const dims: any = {
                                                'A4': { width: 595, height: 842 },
                                                'Letter': { width: 612, height: 792 },
                                                'Legal': { width: 612, height: 1008 },
                                                'Tabloid': { width: 792, height: 1224 }
                                            }[preset];
                                            if (dims) handleUpdate(dims);
                                        }}
                                        className={`p-2 rounded-lg text-[9px] font-bold border transition-all ${(Math.round(currentPage.width) === 595 && preset === 'A4') ||
                                            (Math.round(currentPage.width) === 612 && preset === 'Letter' && Math.round(currentPage.height) === 792)
                                            ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                                            : 'bg-zinc-100 dark:bg-white/[0.03] border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-zinc-300'
                                            }`}
                                    >
                                        {preset}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <SimpleInput
                                    label="W"
                                    value={Math.round(currentPage.width)}
                                    onChange={(v) => handleUpdate({ width: v })}
                                />
                                <SimpleInput
                                    label="H"
                                    value={Math.round(currentPage.height)}
                                    onChange={(v) => handleUpdate({ height: v })}
                                />
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleUpdate({ width: currentPage.height, height: currentPage.width })}
                                    className="flex-1 p-2.5 rounded-xl bg-zinc-100 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-zinc-300 flex items-center justify-center gap-2 group transition-all"
                                >
                                    <Repeat size={12} className="group-hover:rotate-90 transition-transform" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Rotate</span>
                                </button>
                                <button
                                    onClick={() => handleUpdate({ rotation: (currentPage.rotation || 0) + 90 })}
                                    className="p-2.5 rounded-xl bg-zinc-100 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-zinc-300 flex items-center justify-center gap-2 transition-all"
                                >
                                    <RotateCw size={12} />
                                </button>
                            </div>
                        </div>

                        {/* Flow Actions (Quick management) */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => deletePage(currentPage.id)}
                                className="p-3 bg-red-500/5 hover:bg-red-500/15 text-red-600 dark:text-red-500/70 hover:text-red-700 dark:hover:text-red-500 rounded-xl border border-red-500/10 flex items-center justify-center gap-2 group transition-all"
                            >
                                <Trash2 size={14} className="group-hover:scale-110 transition-transform" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Delete</span>
                            </button>
                            <button
                                onClick={() => removeBlankPages()}
                                className="p-3 bg-zinc-100 dark:bg-white/[0.03] hover:bg-zinc-200 dark:hover:bg-white/[0.08] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-xl border border-zinc-200 dark:border-white/5 flex items-center justify-center gap-2 group transition-all"
                            >
                                <Eraser size={14} className="group-hover:rotate-12 transition-transform" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Cleanup</span>
                            </button>
                        </div>
                    </div>
                </CollapsibleSection>

                {/* --- Section 2: Aesthetics & Identity --- */}
                <CollapsibleSection
                    title="Style & Elements"
                    icon={<Wand2 size={12} />}
                    storageKey="page_style"
                >
                    <div className="space-y-4">
                        {/* Aesthetics Group */}
                        <div className="space-y-4 bg-white/50 dark:bg-white/[0.02] p-4 rounded-2xl border border-zinc-200 dark:border-white/5 shadow-inner dark:shadow-none transition-colors duration-300">
                            <div className="grid grid-cols-3 gap-2">
                                {['none', 'sepia', 'grayscale', 'vintage', 'cool', 'warm'].map(filter => (
                                    <button
                                        key={filter}
                                        onClick={() => handleUpdate({ filter })}
                                        className={`p-2 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all border ${currentPage.filter === filter
                                            ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/40'
                                            : 'bg-zinc-100 dark:bg-white/[0.03] border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-zinc-300'
                                            }`}
                                    >
                                        {filter}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Tint Overlay</span>
                                    <div className="w-3 h-3 rounded-full border border-zinc-200 dark:border-white/20 shadow-sm" style={{ backgroundColor: currentPage.overlayColor || 'transparent' }} />
                                </div>
                                <ColorGrid
                                    current={currentPage.overlayColor || 'transparent'}
                                    onSelect={(c) => handleUpdate({ overlayColor: c, overlayOpacity: currentPage.overlayOpacity || 0.15 })}
                                    recentColors={['#fef3c7', '#dcfce7', '#fee2e2', '#e0f2fe', '#f3e8ff']}
                                />
                                {currentPage.overlayColor && currentPage.overlayColor !== 'transparent' && (
                                    <Slider
                                        value={currentPage.overlayOpacity ?? 0.15}
                                        min={0} max={1} step={0.05}
                                        onChange={(v) => handleUpdate({ overlayOpacity: v })}
                                    />
                                )}
                            </div>

                            <div className="space-y-2 border-t border-zinc-200 dark:border-white/5 pt-3">
                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Surface Texture</span>
                                <div className="grid grid-cols-4 gap-2">
                                    {['none', 'paper', 'grain', 'canvas'].map(tex => (
                                        <button
                                            key={tex}
                                            onClick={() => handleUpdate({ texture: tex, textureOpacity: 0.2 })}
                                            className={`p-1.5 rounded-lg text-[8px] font-bold uppercase border transition-all ${currentPage.texture === tex
                                                ? 'bg-zinc-200 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-500 text-zinc-900 dark:text-white shadow-inner'
                                                : 'bg-transparent border-zinc-100 dark:border-white/5 text-zinc-400 dark:text-zinc-600 hover:border-zinc-300 dark:hover:border-white/20'
                                                }`}
                                        >
                                            {tex}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Fixed Structure Group */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Static Overlays</span>
                                <button
                                    onClick={() => applyStructureToAllPages('both', currentPage.structure)}
                                    className="text-[9px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 uppercase tracking-widest transition-colors"
                                >
                                    Sync Global
                                </button>
                            </div>

                            <div className="space-y-2">
                                {/* Header Toggle */}
                                <div className="bg-white/50 dark:bg-white/[0.03] p-3 rounded-xl border border-zinc-200 dark:border-white/5 flex justify-between items-center group hover:border-zinc-300 dark:hover:border-white/10 transition-colors shadow-sm dark:shadow-none">
                                    <div className="flex items-center gap-3">
                                        <ArrowUpToLine size={13} className="text-zinc-400 dark:text-zinc-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                                        <span className="text-[10px] uppercase font-bold text-zinc-600 dark:text-zinc-400">Header</span>
                                    </div>
                                    <ToggleButton
                                        active={!!currentPage.structure?.header}
                                        onClick={() => {
                                            const newStruct = { ...(currentPage.structure || {}) };
                                            if (newStruct.header) delete newStruct.header;
                                            else newStruct.header = { text: "Document Title", align: 'center', fontSize: 10, color: '#71717a', opacity: 0.8 };
                                            handleUpdate({ structure: newStruct });
                                        }}
                                    />
                                </div>

                                {/* Footer Toggle */}
                                <div className="bg-white/50 dark:bg-white/[0.03] p-3 rounded-xl border border-zinc-200 dark:border-white/5 flex justify-between items-center group hover:border-zinc-300 dark:hover:border-white/10 transition-colors shadow-sm dark:shadow-none">
                                    <div className="flex items-center gap-3">
                                        <ArrowDownToLine size={13} className="text-zinc-400 dark:text-zinc-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                                        <span className="text-[10px] uppercase font-bold text-zinc-600 dark:text-zinc-400">Footer</span>
                                    </div>
                                    <ToggleButton
                                        active={!!currentPage.structure?.footer}
                                        onClick={() => {
                                            const newStruct = { ...(currentPage.structure || {}) };
                                            if (newStruct.footer) delete newStruct.footer;
                                            else newStruct.footer = { text: "Page {{page}} of {{total}}", align: 'center', fontSize: 9, color: '#71717a', opacity: 0.8 };
                                            handleUpdate({ structure: newStruct });
                                        }}
                                    />
                                </div>

                                {/* Watermark Toggle */}
                                <div className="bg-white/50 dark:bg-white/[0.03] p-3 rounded-xl border border-zinc-200 dark:border-white/5 flex justify-between items-center group hover:border-zinc-300 dark:hover:border-white/10 transition-colors shadow-sm dark:shadow-none">
                                    <div className="flex items-center gap-3">
                                        <Type size={13} className="text-zinc-400 dark:text-zinc-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                                        <span className="text-[10px] uppercase font-bold text-zinc-600 dark:text-zinc-400">Watermark</span>
                                    </div>
                                    <ToggleButton
                                        active={!!currentPage.watermark?.text}
                                        onClick={() => {
                                            if (currentPage.watermark?.text) handleUpdate({ watermark: undefined });
                                            else handleUpdate({ watermark: { text: "DRAFT", color: "#71717a", opacity: 0.15, fontSize: 80, rotate: -45 } });
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Collapsible Details for Overlays */}
                            {(currentPage.structure?.header || currentPage.structure?.footer || currentPage.watermark?.text) && (
                                <div className="bg-zinc-100 dark:bg-black/20 p-4 rounded-2xl border border-zinc-200 dark:border-white/5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 shadow-inner">
                                    {currentPage.structure?.header && (
                                        <div className="space-y-2">
                                            <span className="text-[8px] font-black text-zinc-500 dark:text-zinc-600 uppercase tracking-widest">Header Text</span>
                                            <input
                                                type="text"
                                                value={currentPage.structure.header.text}
                                                onChange={(e) => handleUpdate({
                                                    structure: { ...currentPage.structure, header: { ...currentPage.structure!.header!, text: e.target.value } }
                                                })}
                                                className="w-full bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-lg p-2 text-[10px] text-zinc-900 dark:text-white outline-none focus:border-blue-500/30 transition-all shadow-sm"
                                            />
                                        </div>
                                    )}
                                    {currentPage.structure?.footer && (
                                        <div className="space-y-2">
                                            <span className="text-[8px] font-black text-zinc-500 dark:text-zinc-600 uppercase tracking-widest">Footer Text</span>
                                            <input
                                                type="text"
                                                value={currentPage.structure.footer.text}
                                                onChange={(e) => handleUpdate({
                                                    structure: { ...currentPage.structure, footer: { ...currentPage.structure!.footer!, text: e.target.value } }
                                                })}
                                                className="w-full bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-lg p-2 text-[10px] text-zinc-900 dark:text-white outline-none focus:border-blue-500/30 transition-all shadow-sm"
                                            />
                                        </div>
                                    )}
                                    {currentPage.watermark?.text && (
                                        <div className="space-y-2">
                                            <span className="text-[8px] font-black text-zinc-500 dark:text-zinc-600 uppercase tracking-widest">Watermark Text</span>
                                            <input
                                                type="text"
                                                value={currentPage.watermark.text}
                                                onChange={(e) => handleUpdate({ watermark: { ...currentPage.watermark!, text: e.target.value } })}
                                                className="w-full bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-lg p-2 text-[10px] text-zinc-900 dark:text-white outline-none focus:border-blue-500/30 font-bold uppercase tracking-widest transition-all shadow-sm"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </CollapsibleSection>

            </div>
        </div>
    );
};
