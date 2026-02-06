import React from 'react';
import { useImageStudioStore } from './useImageStudioStore';
import {
    Sun, Contrast, Droplet, MoveHorizontal, MoveVertical,
    Ghost, RotateCw, Wand2, Sliders, Eraser, Loader2,
    Check, X, Undo2, RotateCcw, ScanLine
} from 'lucide-react';
import clsx from 'clsx';
import { useEditorStore } from '../../../../store/editorStore';

// Reusing FilterSlider from ImageEditorPanel or recreating it for isolation
const FilterSlider = ({ label, icon, value, min, max, step, onChange }: any) => (
    <div className="space-y-3">
        <div className="flex items-center justify-between text-zinc-400">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider">
                {icon} <span>{label}</span>
            </div>
            <span className="text-[11px] font-mono text-zinc-300">{Math.round(value * 100) / 100}</span>
        </div>
        <div className="relative h-6 flex items-center">
            <input
                type="range"
                min={min} max={max} step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
            />
        </div>
    </div>
);

export const StudioToolbar: React.FC<{ onApply: () => void; onCancel: () => void }> = ({ onApply, onCancel }) => {
    const { params, setParam, activeTab, setActiveTab, resetParams } = useImageStudioStore();
    const { imageStudio } = useEditorStore();

    const isEditMode = imageStudio.mode === 'edit';

    const renderTools = () => {
        switch (activeTab) {
            case 'adjust':
                return (
                    <div className="grid grid-cols-2 gap-x-8 gap-y-6 pt-2">
                        <FilterSlider
                            label="Brightness"
                            icon={<Sun size={14} />}
                            value={params.brightness}
                            min={-1} max={1} step={0.05}
                            onChange={(v: number) => setParam('brightness', v)}
                        />
                        <FilterSlider
                            label="Contrast"
                            icon={<Contrast size={14} />}
                            value={params.contrast}
                            min={-100} max={100} step={5}
                            onChange={(v: number) => setParam('contrast', v)}
                        />
                        <FilterSlider
                            label="Saturation"
                            icon={<Droplet size={14} />}
                            value={params.saturation}
                            min={-2} max={10} step={0.1}
                            onChange={(v: number) => setParam('saturation', v)}
                        />
                        <FilterSlider
                            label="Blur"
                            icon={<Ghost size={14} />}
                            value={params.blur}
                            min={0} max={40} step={1}
                            onChange={(v: number) => setParam('blur', v)}
                        />
                    </div>
                );
            case 'crop':
                return (
                    <div className="flex flex-col gap-4 pt-2">
                        <div className="flex justify-center gap-4">
                            <button
                                onClick={() => setParam('rotation', (params.rotation + 90) % 360)}
                                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 hover:text-white transition-all w-24"
                            >
                                <RotateCw size={20} />
                                <span className="text-[10px] font-bold uppercase">Rotate</span>
                            </button>
                            <button
                                onClick={() => setParam('flipX', !params.flipX)}
                                className={clsx(
                                    "flex flex-col items-center gap-2 p-3 rounded-xl transition-all w-24",
                                    params.flipX ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "bg-zinc-800/50 hover:bg-zinc-800 hover:text-white"
                                )}
                            >
                                <MoveHorizontal size={20} />
                                <span className="text-[10px] font-bold uppercase">Flip X</span>
                            </button>
                            <button
                                onClick={() => setParam('flipY', !params.flipY)}
                                className={clsx(
                                    "flex flex-col items-center gap-2 p-3 rounded-xl transition-all w-24",
                                    params.flipY ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "bg-zinc-800/50 hover:bg-zinc-800 hover:text-white"
                                )}
                            >
                                <MoveVertical size={20} />
                                <span className="text-[10px] font-bold uppercase">Flip Y</span>
                            </button>
                        </div>
                    </div>
                );
            case 'effects':
                return (
                    <div className="flex items-center gap-4 pt-2">
                        {[
                            { key: 'grayscale', label: 'B&W' },
                            { key: 'sepia', label: 'Sepia' },
                            { key: 'invert', label: 'Invert' },
                        ].map(ef => (
                            <button
                                key={ef.key}
                                onClick={() => setParam(ef.key as any, params[ef.key as keyof typeof params] ? 0 : 1)}
                                className={clsx(
                                    "w-20 h-20 rounded-xl flex flex-col items-center justify-center gap-2 transition-all border",
                                    params[ef.key as keyof typeof params]
                                        ? "bg-blue-600/20 border-blue-500/50 text-blue-400"
                                        : "bg-white/[0.02] border-white/5 text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                                )}
                            >
                                <Wand2 size={20} />
                                <span className="text-[10px] font-bold uppercase">{ef.label}</span>
                            </button>
                        ))}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="bg-[#121214] border-t border-white/5 flex flex-col flex-shrink-0 z-50">

            {/* Tabs */}
            <div className="flex items-center px-4 py-1.5 border-b border-white/5 gap-2 bg-[#09090b]">
                {[
                    { id: 'adjust', icon: Sliders, label: 'Adjust' },
                    { id: 'crop', icon: RotateCw, label: 'Shape' },
                    { id: 'effects', icon: Wand2, label: 'Filters' },

                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={clsx(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-[10px] font-bold uppercase tracking-wide",
                            activeTab === tab.id
                                ? "bg-white/10 text-white"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                        )}
                    >
                        <tab.icon size={12} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Dynamic Tool Content */}
            <div className="p-4 h-[140px] overflow-y-auto custom-scrollbar bg-[#121214]">
                {renderTools()}
            </div>

            {/* Footer Actions */}
            <div className="px-4 py-3 border-t border-white/5 bg-[#09090b] flex justify-between items-center">
                <button
                    onClick={resetParams}
                    className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-wider px-2"
                >
                    <RotateCcw size={12} /> Reset
                </button>

                <div className="flex gap-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 font-medium text-xs hover:bg-zinc-700 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onApply}
                        className="px-6 py-2 rounded-lg bg-blue-600 text-white font-bold text-xs shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition flex items-center gap-2"
                    >
                        {isEditMode ? 'Update' : 'Add Image'} <Check size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};
