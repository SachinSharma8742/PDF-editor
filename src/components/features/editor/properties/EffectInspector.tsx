import React from 'react';
import { useEditorStore } from '../../../../store/editorStore';
import type { PDFObject } from '../../../../store/pdfStore';
import { Sparkles, Trash2, Eye, EyeOff } from 'lucide-react';
import { Slider } from './PropertyComponents';
import { CollapsibleSection } from './CollapsibleSection';
import { DEFAULT_ADJUSTMENT_PARAMS } from '../../../../utils/effectUtils';

interface EffectInspectorProps {
    object: PDFObject;
}

export const EffectInspector: React.FC<EffectInspectorProps> = ({ object }) => {
    const { updateObject, deleteObjects } = useEditorStore();

    if (object.type !== 'effect') return null;

    const params = { ...DEFAULT_ADJUSTMENT_PARAMS, ...object.effectParams };

    const handleParamChange = (key: string, value: number | boolean) => {
        updateObject(object.id, {
            effectParams: {
                ...object.effectParams,
                [key]: value
            }
        });
    };

    return (
        <div className="space-y-4">
            {/* Core Controls */}
            <CollapsibleSection
                title="Levels & Tone"
                icon={<Sparkles size={12} />}
                storageKey="effect_levels"
            >
                <div className="space-y-4">
                    {/* Black Point */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                            <span>Black Point</span>
                            <span className="text-blue-400 font-mono">{params.blackPoint}</span>
                        </div>
                        <Slider
                            value={params.blackPoint}
                            min={0}
                            max={120}
                            step={1}
                            onChange={(v) => handleParamChange('blackPoint', v)}
                        />
                        <p className="text-[9px] text-zinc-600">Darken shadows • Higher = crush more blacks</p>
                    </div>

                    {/* White Point */}
                    <div className="space-y-2 pt-2 border-t border-white/5">
                        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                            <span>White Point</span>
                            <span className="text-blue-400 font-mono">{params.whitePoint}</span>
                        </div>
                        <Slider
                            value={params.whitePoint}
                            min={130}
                            max={255}
                            step={1}
                            onChange={(v) => handleParamChange('whitePoint', v)}
                        />
                        <p className="text-[9px] text-zinc-600">Brighten highlights • Lower = whiter paper</p>
                    </div>

                    {/* Gamma */}
                    <div className="space-y-2 pt-2 border-t border-white/5">
                        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                            <span>Gamma</span>
                            <span className="text-blue-400 font-mono">{params.gamma.toFixed(2)}</span>
                        </div>
                        <Slider
                            value={params.gamma}
                            min={0.2}
                            max={3.0}
                            step={0.05}
                            onChange={(v) => handleParamChange('gamma', v)}
                        />
                        <p className="text-[9px] text-zinc-600">Midtone control • Higher = lighter mids</p>
                    </div>

                    {/* Contrast */}
                    <div className="space-y-2 pt-2 border-t border-white/5">
                        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                            <span>Contrast</span>
                            <span className="text-blue-400 font-mono">{params.contrast.toFixed(2)}</span>
                        </div>
                        <Slider
                            value={params.contrast}
                            min={0.5}
                            max={3.0}
                            step={0.05}
                            onChange={(v) => handleParamChange('contrast', v)}
                        />
                        <p className="text-[9px] text-zinc-600">Global separation • Max for hard edges</p>
                    </div>
                </div>
            </CollapsibleSection>

            {/* Advanced Controls */}
            <CollapsibleSection
                title="Advanced"
                icon={<Sparkles size={12} />}
                storageKey="effect_advanced"
            >
                <div className="space-y-4">
                    {/* Grayscale Toggle */}
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Grayscale</span>
                            <p className="text-[9px] text-zinc-600 mt-0.5">Convert to luminance-based B&W</p>
                        </div>
                        <button
                            onClick={() => handleParamChange('grayscale', !params.grayscale)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${params.grayscale
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'bg-white/5 text-zinc-500 border border-white/5'
                                }`}
                        >
                            {params.grayscale ? 'ON' : 'OFF'}
                        </button>
                    </div>

                    {/* Threshold Toggle + Slider */}
                    <div className="space-y-2 pt-2 border-t border-white/5">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Threshold</span>
                                <p className="text-[9px] text-zinc-600 mt-0.5">Binary mode — pure black & white</p>
                            </div>
                            <button
                                onClick={() => handleParamChange('thresholdEnabled', !params.thresholdEnabled)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${params.thresholdEnabled
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                    : 'bg-white/5 text-zinc-500 border border-white/5'
                                    }`}
                            >
                                {params.thresholdEnabled ? 'ON' : 'OFF'}
                            </button>
                        </div>

                        {params.thresholdEnabled && (
                            <div className="space-y-2 mt-2">
                                <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                                    <span>Level</span>
                                    <span className="text-blue-400 font-mono">{params.threshold}</span>
                                </div>
                                <Slider
                                    value={params.threshold}
                                    min={0}
                                    max={255}
                                    step={1}
                                    onChange={(v) => handleParamChange('threshold', v)}
                                />
                            </div>
                        )}
                    </div>

                    {/* Invert Toggle */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <div>
                            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Invert</span>
                            <p className="text-[9px] text-zinc-600 mt-0.5">Flip all colors</p>
                        </div>
                        <button
                            onClick={() => handleParamChange('invertEnabled', !params.invertEnabled)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${params.invertEnabled
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'bg-white/5 text-zinc-500 border border-white/5'
                                }`}
                        >
                            {params.invertEnabled ? 'ON' : 'OFF'}
                        </button>
                    </div>
                </div>
            </CollapsibleSection>

            {/* Master Opacity */}
            <CollapsibleSection
                title="Master Opacity"
                icon={<Sparkles size={12} />}
                storageKey="effect_opacity"
            >
                <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                        <span>Opacity</span>
                        <span className="text-blue-400">{Math.round((object.opacity ?? 1) * 100)}%</span>
                    </div>
                    <Slider
                        value={object.opacity ?? 1}
                        min={0}
                        max={1}
                        step={0.01}
                        onChange={(v) => updateObject(object.id, { opacity: v })}
                    />
                </div>
            </CollapsibleSection>

            {/* Info */}
            <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                <p className="text-[10px] text-blue-400 leading-relaxed font-medium">
                    <Sparkles size={10} className="inline mr-1 mb-0.5" />
                    This adjustment layer affects only objects beneath it in the stacking order — all objects, text, and images below this layer.
                </p>
            </div>
        </div>
    );
};
