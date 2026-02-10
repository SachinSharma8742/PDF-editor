import React from 'react';
import { useEditorStore } from '../../../store/editorStore';
import {
    Sparkles, Trash2, Eye, EyeOff,
    Zap, Moon, Contrast, SlidersHorizontal, Droplets, Wand2
} from 'lucide-react';
import clsx from 'clsx';
import type { PDFObject } from '../../../store/pdfStore';
import { DEFAULT_ADJUSTMENT_PARAMS } from '../../../utils/effectUtils';

/**
 * Presets are parameter sets of the single shared adjustment pipeline.
 * No hidden logic — each preset just assigns values to the pipeline params.
 */
const EFFECT_PRESETS = [
    {
        id: 'grayscale',
        name: 'Grey Mode',
        icon: Droplets,
        params: { ...DEFAULT_ADJUSTMENT_PARAMS, grayscale: true },
        description: 'Classic professional grayscale look'
    },
    {
        id: 'bw',
        name: 'Black & White',
        icon: Wand2,
        params: { ...DEFAULT_ADJUSTMENT_PARAMS, grayscale: true, blackPoint: 60, whitePoint: 200, contrast: 1.8 },
        description: 'High contrast binary monochrome'
    },
    {
        id: 'scanEnhance',
        name: 'Scan Enhance',
        icon: Zap,
        params: { ...DEFAULT_ADJUSTMENT_PARAMS, grayscale: true, blackPoint: 40, whitePoint: 210, gamma: 1.3, contrast: 1.5 },
        description: 'Perfect for document scanning & OCR'
    },
    {
        id: 'contrast',
        name: 'High Contrast',
        icon: Contrast,
        params: { ...DEFAULT_ADJUSTMENT_PARAMS, blackPoint: 30, whitePoint: 220, contrast: 2.0 },
        description: 'Make text pop and backgrounds clear'
    },
    {
        id: 'night',
        name: 'Night Mode',
        icon: Moon,
        params: { ...DEFAULT_ADJUSTMENT_PARAMS, invertEnabled: true },
        description: 'Invert colors for dark reading'
    },
] as const;

export const EffectsPanel: React.FC = () => {
    const { currentPage, addObject, deleteObjects, updateObject } = useEditorStore();

    const activeEffects = currentPage?.objects.filter(obj => obj.type === 'effect') || [];

    const handleAddEffect = (preset: typeof EFFECT_PRESETS[number]) => {
        if (!currentPage) return;

        // Remove existing effects first (Single Effect Mode)
        if (activeEffects.length > 0) {
            deleteObjects(activeEffects.map(obj => obj.id));
        }

        const newEffect: PDFObject = {
            id: `effect-${Date.now()}`,
            type: 'effect',
            effectType: 'adjustment',
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

    const handleAddCustomEffect = () => {
        if (!currentPage) return;

        // Remove existing effects first (Single Effect Mode)
        if (activeEffects.length > 0) {
            deleteObjects(activeEffects.map(obj => obj.id));
        }

        const newEffect: PDFObject = {
            id: `effect-${Date.now()}`,
            type: 'effect',
            effectType: 'adjustment',
            effectParams: { ...DEFAULT_ADJUSTMENT_PARAMS },
            visible: true,
            opacity: 1,
            x: 0,
            y: 0,
            width: currentPage.width,
            height: currentPage.height,
            rotation: 0,
            name: 'Custom Effect'
        };
        addObject(newEffect);
    };

    const formatParamValue = (key: string, value: any): string => {
        if (typeof value === 'boolean') return value ? 'ON' : 'OFF';
        if (key === 'gamma' || key === 'contrast') return (value as number).toFixed(2);
        return String(value);
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
                                <p className="text-xs text-zinc-500">No effects applied yet. Choose a preset below or add a Custom Effect.</p>
                            </div>
                        ) : (
                            activeEffects.map((effect) => (
                                <div
                                    key={effect.id}
                                    className="bg-white/5 border border-white/5 rounded-xl p-3 group transition-all hover:border-blue-500/30"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                                                <Sparkles size={14} />
                                            </div>
                                            <span className="text-sm font-medium text-zinc-200">{effect.name || 'Adjustment'}</span>
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

                                    {/* Show key parameters */}
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-1">
                                        {effect.effectParams && Object.entries(effect.effectParams)
                                            .filter(([key]) => !['thresholdEnabled', 'invertEnabled'].includes(key) || effect.effectParams?.[key])
                                            .slice(0, 6)
                                            .map(([key, value]) => (
                                                <div key={key} className="flex justify-between text-[9px] text-zinc-500">
                                                    <span className="uppercase tracking-wider">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                    <span className="text-blue-400 font-mono">{formatParamValue(key, value)}</span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* Custom Effect Button */}
                <section>
                    <button
                        onClick={handleAddCustomEffect}
                        className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl hover:from-blue-500/20 hover:to-purple-500/20 hover:border-blue-500/40 transition-all text-left"
                    >
                        <div className="p-2.5 rounded-lg bg-blue-500/20 text-blue-400">
                            <SlidersHorizontal size={20} />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-zinc-100 mb-0.5">Custom Effect</h4>
                            <p className="text-[10px] text-zinc-400 leading-tight">Manual control mode — unlock all sliders</p>
                        </div>
                    </button>
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
