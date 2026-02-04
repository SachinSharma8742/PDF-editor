import React from 'react';
import { useEditorStore } from '../../../../store/editorStore';
import { usePDFStore } from '../../../../store/pdfStore';
import { PropertyLabel, Slider, ColorGrid, SimpleInput, ToggleButton, IconButton } from './PropertyComponents';
import {
    FileText, Wand2, Layers, Grid3X3, Type, Repeat,
    AlignLeft, AlignCenter, AlignRight, LayoutTemplate,
    Trash2, Eraser, ArrowUpToLine, ArrowDownToLine,
    Maximize2, RotateCw
} from 'lucide-react';

export const PagePropertyPanel: React.FC = () => {
    const { currentPage } = useEditorStore();
    const { updatePage, deletePage, removeBlankPages, applyStructureToAllPages } = usePDFStore();

    if (!currentPage) return null;

    const handleUpdate = (updates: any) => {
        updatePage(currentPage.id, updates);
    };

    return (
        <div className="flex flex-col h-full bg-[#1e1e20] text-white">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5 bg-[#18181b] sticky top-0 z-10 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <LayoutTemplate size={14} />
                    </div>
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-tight text-zinc-200">
                            Page Architect
                        </h3>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest leading-none mt-1">
                            Editing Page {currentPage.pageNumber}
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar">

                {/* --- Section 1: Page Setup & Operations --- */}
                <div className="space-y-6">
                    <PropertyLabel label="Setup & Operations" icon={<Maximize2 size={12} />} />

                    {/* Geometry & Presets */}
                    <div className="space-y-4 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
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
                                        ? 'bg-blue-600 border-blue-500 text-white'
                                        : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:bg-white/5'
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
                                className="flex-1 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-zinc-400 hover:bg-white/5 flex items-center justify-center gap-2 group transition-all"
                            >
                                <Repeat size={12} className="group-hover:rotate-90 transition-transform" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Rotate</span>
                            </button>
                            <button
                                onClick={() => handleUpdate({ rotation: (currentPage.rotation || 0) + 90 })}
                                className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-zinc-400 hover:bg-white/5 flex items-center justify-center gap-2 transition-all"
                            >
                                <RotateCw size={12} />
                            </button>
                        </div>
                    </div>

                    {/* Flow Actions (Quick management) */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => deletePage(currentPage.id)}
                            className="p-3 bg-red-500/5 hover:bg-red-500/15 text-red-500/70 hover:text-red-500 rounded-xl border border-red-500/10 flex items-center justify-center gap-2 group transition-all"
                        >
                            <Trash2 size={14} className="group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Delete</span>
                        </button>
                        <button
                            onClick={() => removeBlankPages()}
                            className="p-3 bg-white/[0.03] hover:bg-white/[0.08] text-zinc-400 hover:text-white rounded-xl border border-white/5 flex items-center justify-center gap-2 group transition-all"
                        >
                            <Eraser size={14} className="group-hover:rotate-12 transition-transform" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Cleanup</span>
                        </button>
                    </div>
                </div>

                {/* --- Section 2: Aesthetics & Identity --- */}
                <div className="space-y-6 pt-6 border-t border-white/5">
                    <PropertyLabel label="Style & Elements" icon={<Wand2 size={12} />} />

                    {/* Aesthetics Group */}
                    <div className="space-y-4 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                        <div className="grid grid-cols-3 gap-2">
                            {['none', 'sepia', 'grayscale', 'vintage', 'cool', 'warm'].map(filter => (
                                <button
                                    key={filter}
                                    onClick={() => handleUpdate({ filter })}
                                    className={`p-2 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all border ${currentPage.filter === filter
                                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/40'
                                        : 'bg-white/[0.03] border-white/10 text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
                                        }`}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Tint Overlay</span>
                                <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: currentPage.overlayColor || 'transparent' }} />
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

                        <div className="space-y-2 border-t border-white/5 pt-3">
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Surface Texture</span>
                            <div className="grid grid-cols-4 gap-2">
                                {['none', 'paper', 'grain', 'canvas'].map(tex => (
                                    <button
                                        key={tex}
                                        onClick={() => handleUpdate({ texture: tex, textureOpacity: 0.2 })}
                                        className={`p-1.5 rounded-lg text-[8px] font-bold uppercase border transition-all ${currentPage.texture === tex
                                            ? 'bg-zinc-700 border-zinc-500 text-white'
                                            : 'bg-transparent border-white/5 text-zinc-600 hover:border-white/20'
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
                                className="text-[9px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest"
                            >
                                Sync Global
                            </button>
                        </div>

                        <div className="space-y-2">
                            {/* Header Toggle */}
                            <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5 flex justify-between items-center group hover:border-white/10 transition-colors">
                                <div className="flex items-center gap-3">
                                    <ArrowUpToLine size={13} className="text-zinc-500 group-hover:text-blue-400 transition-colors" />
                                    <span className="text-[10px] uppercase font-bold text-zinc-400">Header</span>
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
                            <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5 flex justify-between items-center group hover:border-white/10 transition-colors">
                                <div className="flex items-center gap-3">
                                    <ArrowDownToLine size={13} className="text-zinc-500 group-hover:text-blue-400 transition-colors" />
                                    <span className="text-[10px] uppercase font-bold text-zinc-400">Footer</span>
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
                            <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5 flex justify-between items-center group hover:border-white/10 transition-colors">
                                <div className="flex items-center gap-3">
                                    <Type size={13} className="text-zinc-500 group-hover:text-blue-400 transition-colors" />
                                    <span className="text-[10px] uppercase font-bold text-zinc-400">Watermark</span>
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
                            <div className="bg-black/20 p-4 rounded-2xl border border-white/5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                {currentPage.structure?.header && (
                                    <div className="space-y-2">
                                        <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Header Text</span>
                                        <input
                                            type="text"
                                            value={currentPage.structure.header.text}
                                            onChange={(e) => handleUpdate({
                                                structure: { ...currentPage.structure, header: { ...currentPage.structure!.header!, text: e.target.value } }
                                            })}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] text-white outline-none focus:border-blue-500/30"
                                        />
                                    </div>
                                )}
                                {currentPage.structure?.footer && (
                                    <div className="space-y-2">
                                        <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Footer Text</span>
                                        <input
                                            type="text"
                                            value={currentPage.structure.footer.text}
                                            onChange={(e) => handleUpdate({
                                                structure: { ...currentPage.structure, footer: { ...currentPage.structure!.footer!, text: e.target.value } }
                                            })}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] text-white outline-none focus:border-blue-500/30"
                                        />
                                    </div>
                                )}
                                {currentPage.watermark?.text && (
                                    <div className="space-y-2">
                                        <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Watermark Text</span>
                                        <input
                                            type="text"
                                            value={currentPage.watermark.text}
                                            onChange={(e) => handleUpdate({ watermark: { ...currentPage.watermark!, text: e.target.value } })}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] text-white outline-none focus:border-blue-500/30 font-bold uppercase tracking-widest"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};
