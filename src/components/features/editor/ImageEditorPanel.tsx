import React from 'react';
import { useEditorStore } from '../../../store/editorStore';
import {
    Sun, Contrast, Droplet, MoveHorizontal, MoveVertical,
    Ghost, Layers, Scissors, RotateCw, Wand2, Image as ImageIcon,
    Palette, Circle, Square
} from 'lucide-react';
import clsx from 'clsx';

export const ImageEditorPanel: React.FC = () => {
    const { selectedObjectIds, updateObject, currentPage, isCropping, setCropping } = useEditorStore();

    const selectedObj = currentPage?.objects.find(o => o.id === selectedObjectIds[0]);

    if (!selectedObj || selectedObj.type !== 'image') {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500 opacity-50">
                <ImageIcon size={48} className="mb-4" />
                <p className="text-xs uppercase font-bold text-center">Select an image<br />to edit</p>
            </div>
        );
    }

    const filters = selectedObj.filters || [];
    const getFilterValue = (name: string, defaultVal: number = 0) => {
        const f = filters.find(f => f.name === name);
        return f ? f.value : defaultVal;
    };

    const updateFilter = (name: string, value: number) => {
        const newFilters = filters.filter(f => f.name !== name);
        if (value !== 0) { // Only store non-default values
            newFilters.push({ name, value });
        }
        updateObject(selectedObj.id, { filters: newFilters });
    };

    return (
        <div className="p-4 space-y-8 pb-20">
            {/* Header */}
            <div className="flex items-center gap-2 mb-6">
                <Wand2 size={16} className="text-blue-400" />
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-100">Image Studio</h3>
            </div>

            {/* Quick Actions / Transforms */}
            <div className="space-y-4">
                <SectionLabel label="Transforms" icon={<RotateCw size={12} />} />
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => updateObject(selectedObj.id, { flipX: !selectedObj.flipX })}
                        className={clsx(
                            "flex items-center justify-center gap-2 p-3 rounded-lg border transition-all",
                            selectedObj.flipX
                                ? "bg-blue-600/20 border-blue-500/50 text-blue-400"
                                : "bg-zinc-800 border-white/5 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                        )}
                    >
                        <MoveHorizontal size={16} />
                        <span className="text-[10px] font-bold uppercase">Flip X</span>
                    </button>
                    <button
                        onClick={() => updateObject(selectedObj.id, { flipY: !selectedObj.flipY })}
                        className={clsx(
                            "flex items-center justify-center gap-2 p-3 rounded-lg border transition-all",
                            selectedObj.flipY
                                ? "bg-blue-600/20 border-blue-500/50 text-blue-400"
                                : "bg-zinc-800 border-white/5 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                        )}
                    >
                        <MoveVertical size={16} />
                        <span className="text-[10px] font-bold uppercase">Flip Y</span>
                    </button>
                </div>
            </div>

            {/* Adjustment Sliders */}
            <div className="space-y-6">
                <SectionLabel label="Adjustments" icon={<SlidersIcon size={12} />} />

                <FilterSlider
                    label="Brightness"
                    icon={<Sun size={14} />}
                    value={selectedObj.brightness ?? 0}
                    min={-1} max={1} step={0.05}
                    onChange={(v: number) => updateObject(selectedObj.id, { brightness: v })}
                />

                <FilterSlider
                    label="Contrast"
                    icon={<Contrast size={14} />}
                    value={selectedObj.contrast ?? 0}
                    min={-100} max={100} step={5}
                    onChange={(v: number) => updateObject(selectedObj.id, { contrast: v })}
                />

                <FilterSlider
                    label="Saturation"
                    icon={<Droplet size={14} />}
                    value={selectedObj.saturation ?? 0}
                    min={-2} max={10} step={0.1}
                    onChange={(v: number) => updateObject(selectedObj.id, { saturation: v })}
                />

                <FilterSlider
                    label="Blur"
                    icon={<Ghost size={14} />}
                    value={selectedObj.blurRadius ?? 0}
                    min={0} max={40} step={1}
                    onChange={(v: number) => updateObject(selectedObj.id, { blurRadius: v })}
                />

                <FilterSlider
                    label="Noise"
                    icon={<SparklesIcon size={14} />}
                    value={selectedObj.noise ?? 0}
                    min={0} max={4} step={0.1}
                    onChange={(v: number) => updateObject(selectedObj.id, { noise: v })}
                />
            </div>

            {/* Effects / Toggles */}
            <div className="space-y-4">
                <SectionLabel label="Effects" icon={<Layers size={12} />} />
                <div className="grid grid-cols-2 gap-2">
                    <EffectToggle
                        label="Grayscale"
                        active={selectedObj.grayscale === 1}
                        onClick={() => updateObject(selectedObj.id, { grayscale: selectedObj.grayscale === 1 ? 0 : 1 })}
                    />
                    <EffectToggle
                        label="Invert"
                        active={selectedObj.invert === 1}
                        onClick={() => updateObject(selectedObj.id, { invert: selectedObj.invert === 1 ? 0 : 1 })}
                    />
                    <EffectToggle
                        label="Sepia"
                        active={selectedObj.sepia === 1}
                        onClick={() => updateObject(selectedObj.id, { sepia: selectedObj.sepia === 1 ? 0 : 1 })}
                    />
                </div>
            </div>

            {/* Styling */}
            <div className="space-y-6">
                <SectionLabel label="Styling" icon={<Palette size={12} />} />

                <FilterSlider
                    label="Opacity"
                    icon={<Droplet size={14} />}
                    value={selectedObj.opacity ?? 1}
                    min={0} max={1} step={0.05}
                    onChange={(v: number) => updateObject(selectedObj.id, { opacity: v })}
                />

                <FilterSlider
                    label="Corner Radius"
                    icon={<Circle size={14} />}
                    value={selectedObj.cornerRadius ?? 0}
                    min={0} max={100} step={1}
                    onChange={(v: number) => updateObject(selectedObj.id, { cornerRadius: v })}
                />

                <div className="space-y-2">
                    <div className="flex items-center justify-between text-zinc-400">
                        <div className="flex items-center gap-2 text-[10px] font-medium uppercase">
                            <Square size={14} /> <span>Border</span>
                        </div>
                        <span className="text-[10px] font-mono">{selectedObj.strokeWidth || 0}px</span>
                    </div>
                    <input
                        type="range"
                        min={0} max={20} step={1}
                        value={selectedObj.strokeWidth || 0}
                        onChange={(e) => updateObject(selectedObj.id, { strokeWidth: Number(e.target.value), stroke: selectedObj.stroke || '#000000' })}
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>
            </div>

            {/* Shadow */}
            <div className="space-y-6">
                <SectionLabel label="Shadow" icon={<Layers size={12} />} />
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Enable Shadow</span>
                    <button
                        onClick={() => {
                            if (selectedObj.shadowOpacity) {
                                // Disable
                                updateObject(selectedObj.id, { shadowOpacity: 0 });
                            } else {
                                // Enable defaults
                                updateObject(selectedObj.id, {
                                    shadowColor: '#000000',
                                    shadowBlur: 20,
                                    shadowOffsetX: 10,
                                    shadowOffsetY: 10,
                                    shadowOpacity: 0.5
                                });
                            }
                        }}
                        className={clsx(
                            "w-8 h-4 rounded-full transition-colors relative",
                            selectedObj.shadowOpacity ? "bg-blue-500" : "bg-zinc-700"
                        )}
                    >
                        <div className={clsx(
                            "w-2 h-2 rounded-full bg-white absolute top-1 transition-all",
                            selectedObj.shadowOpacity ? "left-5" : "left-1"
                        )} />
                    </button>
                </div>

                {selectedObj.shadowOpacity ? (
                    <>
                        <FilterSlider
                            label="Blur"
                            icon={<Ghost size={14} />}
                            value={selectedObj.shadowBlur ?? 0}
                            min={0} max={50} step={1}
                            onChange={(v: number) => updateObject(selectedObj.id, { shadowBlur: v })}
                        />
                        <FilterSlider
                            label="Distance"
                            icon={<MoveHorizontal size={14} />}
                            value={selectedObj.shadowOffsetX ?? 0}
                            min={-50} max={50} step={1}
                            onChange={(v: number) => updateObject(selectedObj.id, { shadowOffsetX: v, shadowOffsetY: v })}
                        />
                        <FilterSlider
                            label="Opacity"
                            icon={<Droplet size={14} />}
                            value={selectedObj.shadowOpacity ?? 0}
                            min={0} max={1} step={0.05}
                            onChange={(v: number) => updateObject(selectedObj.id, { shadowOpacity: v })}
                        />
                    </>
                ) : null}
            </div>

            {/* Crop */}
            <div className="pt-4 border-t border-white/5">
                <button
                    onClick={() => setCropping(!isCropping)}
                    className={clsx(
                        "w-full flex items-center justify-center gap-2 p-3 rounded-lg border transition-all",
                        isCropping
                            ? "bg-blue-600 border-blue-500 text-white"
                            : "bg-zinc-800 border-white/5 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                    )}
                >
                    <Scissors size={16} />
                    <span className="text-[10px] font-bold uppercase">{isCropping ? "Confirm Crop" : "Enter Crop Mode"}</span>
                </button>
            </div>
        </div>
    );
};

// --- Helpers ---

const SectionLabel = ({ label, icon }: { label: string, icon: React.ReactNode }) => (
    <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
        {icon} <span>{label}</span>
    </div>
);

const FilterSlider = ({ label, icon, value, min, max, step, onChange }: {
    label: string;
    icon: React.ReactNode;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (val: number) => void;
}) => (
    <div className="space-y-2">
        <div className="flex items-center justify-between text-zinc-400">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase">
                {icon} <span>{label}</span>
            </div>
            <span className="text-[10px] font-mono">{Math.round(value * 100) / 100}</span>
        </div>
        <div className="relative h-4 flex items-center">
            <input
                type="range"
                min={min} max={max} step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
        </div>
    </div>
);

const EffectToggle = ({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={clsx(
            "p-3 rounded-lg border transition-all text-[10px] font-bold uppercase",
            active
                ? "bg-blue-600/20 border-blue-500/50 text-blue-400"
                : "bg-zinc-800 border-white/5 text-zinc-400 hover:bg-zinc-700 hover:text-white"
        )}
    >
        {label}
    </button>
);

// Missing icons mock
const SlidersIcon = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
);
const SparklesIcon = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>
);
