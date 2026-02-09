import React from 'react';
import { useEditorStore } from '../../../store/editorStore';
import {
    Sparkles, Trash2, Eye, EyeOff, ChevronUp, ChevronDown,
    Zap, Moon, Contrast, Sun, Droplets, Wand2
} from 'lucide-react';
import clsx from 'clsx';
import type { PDFObject } from '../../../store/pdfStore';

const EFFECT_PRESETS = [
    {
        id: 'grayscale',
        name: 'Grey Mode',
        icon: Droplets,
        effect: 'grayscale',
        params: { intensity: 100 },
        description: 'Classic professional grayscale look'
    },
    {
        id: 'bw',
        name: 'Black & White',
        icon: Wand2,
        effect: 'bw',
        params: { threshold: 128 },
        description: 'High contrast binary monochrome'
    },
    {
        id: 'scanEnhance',
        name: 'Scan Enhance',
        icon: Zap,
        effect: 'scanEnhance',
        params: { contrast: 1.5, brightness: 1.1 },
        description: 'Perfect for document scanning'
    },
    {
        id: 'contrast',
        name: 'High Contrast',
        icon: Contrast,
        effect: 'contrast',
        params: { value: 150 },
        description: 'Make text pop and backgrounds clear'
    },
    {
        id: 'night',
        name: 'Night Mode',
        icon: Moon,
        effect: 'invert',
        params: { intensity: 100 },
        description: 'Invert colors for dark reading'
    },
    {
        id: 'brightness',
        name: 'Brighten',
        icon: Sun,
        effect: 'brightness',
        params: { value: 120 },
        description: 'Lighten up dark documents'
    }
];

export const EffectsPanel: React.FC = () => {
    const { currentPage, addObject, deleteObjects, updateObject } = useEditorStore();

    const activeEffects = currentPage?.objects.filter(obj => obj.type === 'effect') || [];

    const handleAddEffect = (preset: typeof EFFECT_PRESETS[0]) => {
        if (!currentPage) return;

        const newEffect: PDFObject = {
            id: `effect-${Date.now()}`,
            type: 'effect',
            effectType: preset.effect as any,
            effectParams: { ...preset.params },
            visible: true,
            opacity: 1,
            x: 0,
            y: 0,
            width: currentPage.width,
            height: currentPage.height,
            rotation: 0,
            name: preset.name
        };
        addObject(newEffect);
    };

    return (
        <div className="flex flex-col h-full bg-[#1e1e20] text-zinc-300">
            <div className="p-4 space-y-6 overflow-y-auto custom-scrollbar">
                {/* Active Effects Section */}
                <section>
                    <div className="flex items-center justify-between mb-4 px-1">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Active Effects</span>
                        <span className="text-[10px] text-zinc-600 bg-white/5 px-2 py-0.5 rounded-full">{activeEffects.length} Layers</span>
                    </div>

                    <div className="space-y-2">
                        {activeEffects.length === 0 ? (
                            <div className="border border-dashed border-white/5 rounded-xl p-6 text-center">
                                <Sparkles size={24} className="mx-auto mb-2 text-zinc-700" />
                                <p className="text-xs text-zinc-500">No effects applied yet. Choose a preset below.</p>
                            </div>
                        ) : (
                            activeEffects.map((effect, index) => (
                                <div
                                    key={effect.id}
                                    className="bg-white/5 border border-white/5 rounded-xl p-3 group transition-all hover:border-blue-500/30"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                                                <Sparkles size={14} />
                                            </div>
                                            <span className="text-sm font-medium text-zinc-200">{effect.name || effect.effectType}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => updateObject(effect.id, { visible: !effect.visible })}
                                                className={clsx(
                                                    "p-1.5 rounded-md transition-colors",
                                                    effect.visible ? "text-zinc-500 hover:text-white" : "text-amber-500"
                                                )}
                                            >
                                                {effect.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                                            </button>
                                            <button
                                                onClick={() => deleteObjects([effect.id])}
                                                className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Parameter Sliders */}
                                    <div className="space-y-3 px-1">
                                        {effect.effectParams && Object.entries(effect.effectParams).map(([key, value]) => (
                                            <div key={key} className="space-y-1.5">
                                                <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                                                    <span>{key}</span>
                                                    <span className="text-blue-400">{value}</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={key === 'intensity' || key === 'value' ? 0 : 0}
                                                    max={key === 'threshold' ? 255 : 200}
                                                    value={value as number}
                                                    onChange={(e) => {
                                                        const newVal = parseInt(e.target.value);
                                                        updateObject(effect.id, { effectParams: { ...effect.effectParams, [key]: newVal } });
                                                    }}
                                                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                />
                                            </div>
                                        ))}

                                        {/* Opacity Slider */}
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                                                <span>Opacity</span>
                                                <span className="text-blue-400">{Math.round((effect.opacity ?? 1) * 100)}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={(effect.opacity ?? 1) * 100}
                                                onChange={(e) => {
                                                    const newVal = parseInt(e.target.value) / 100;
                                                    updateObject(effect.id, { opacity: newVal });
                                                }}
                                                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* Presets Section */}
                <section>
                    <div className="mb-4 px-1">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Presets Library</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        {EFFECT_PRESETS.map((preset) => (
                            <button
                                key={preset.id}
                                onClick={() => handleAddEffect(preset)}
                                className="flex items-start gap-3 p-3 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 hover:border-blue-500/20 transition-all text-left"
                            >
                                <div className="p-2 rounded-lg bg-zinc-800 text-zinc-300">
                                    <preset.icon size={18} />
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-xs font-bold text-zinc-200 mb-0.5">{preset.name}</h4>
                                    <p className="text-[10px] text-zinc-500 leading-tight">{preset.description}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};
