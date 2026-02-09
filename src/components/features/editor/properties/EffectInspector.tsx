import React from 'react';
import { useEditorStore } from '../../../../store/editorStore';
import type { PDFObject } from '../../../../store/pdfStore';
import { Sparkles, Trash2, Eye, EyeOff } from 'lucide-react';
import { Slider } from './PropertyComponents';
import { CollapsibleSection } from './CollapsibleSection';

interface EffectInspectorProps {
    object: PDFObject;
}

export const EffectInspector: React.FC<EffectInspectorProps> = ({ object }) => {
    const { updateObject, deleteObjects } = useEditorStore();

    if (object.type !== 'effect') return null;

    const handleParamChange = (key: string, value: number) => {
        updateObject(object.id, {
            effectParams: {
                ...object.effectParams,
                [key]: value
            }
        });
    };

    return (
        <div className="space-y-4">
            <CollapsibleSection
                title="Effect Settings"
                icon={<Sparkles size={12} />}
                storageKey="effect_settings"
            >
                <div className="space-y-4">
                    {/* Opacity */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                            <span>Master Opacity</span>
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

                    {/* Parameters */}
                    {object.effectParams && Object.entries(object.effectParams).map(([key, value]) => (
                        <div key={key} className="space-y-2 pt-2 border-t border-white/5">
                            <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                                <span>{key}</span>
                                <span className="text-blue-400">{value}</span>
                            </div>
                            <Slider
                                value={value as number}
                                min={key === 'intensity' || key === 'value' ? 0 : 0}
                                max={key === 'threshold' ? 255 : 200}
                                step={1}
                                onChange={(v) => handleParamChange(key, v)}
                            />
                        </div>
                    ))}
                </div>
            </CollapsibleSection>

            {/* Selection Logic: Adjustment layers affect everything below them */}
            <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                <p className="text-[10px] text-blue-400 leading-relaxed font-medium">
                    <Sparkles size={10} className="inline mr-1 mb-0.5" />
                    This adjustment layer affects all layers positioned below it in the stack.
                </p>
            </div>
        </div>
    );
};
