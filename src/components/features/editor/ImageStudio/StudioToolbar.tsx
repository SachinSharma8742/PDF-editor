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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-4">
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
                        <FilterSlider
                            label="Noise"
                            icon={<ScanLine size={14} />} // Mock noise icon
                            value={params.noise}
                            min={0} max={4} step={0.1}
                            onChange={(v: number) => setParam('noise', v)}
                        />
                    </div>
                );
            case 'crop':
                return (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4">
                        <p className="text-sm">Crop & Rotate</p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setParam('rotation', (params.rotation + 90) % 360)}
                                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 hover:text-white transition-all"
                            >
                                <RotateCw size={20} />
                                <span className="text-[10px] font-bold uppercase">Rotate 90°</span>
                            </button>
                            <button
                                onClick={() => setParam('flipX', !params.flipX)}
                                className={clsx(
                                    "flex flex-col items-center gap-2 p-4 rounded-xl transition-all",
                                    params.flipX ? "bg-blue-600 text-white" : "bg-zinc-800/50 hover:bg-zinc-800 hover:text-white"
                                )}
                            >
                                <MoveHorizontal size={20} />
                                <span className="text-[10px] font-bold uppercase">Flip X</span>
                            </button>
                            <button
                                onClick={() => setParam('flipY', !params.flipY)}
                                className={clsx(
                                    "flex flex-col items-center gap-2 p-4 rounded-xl transition-all",
                                    params.flipY ? "bg-blue-600 text-white" : "bg-zinc-800/50 hover:bg-zinc-800 hover:text-white"
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
                    <div className="flex items-center justify-center gap-4 p-4">
                        {[
                            { key: 'grayscale', label: 'B&W' },
                            { key: 'sepia', label: 'Sepia' },
                            { key: 'invert', label: 'Invert' },
                        ].map(ef => (
                            <button
                                key={ef.key}
                                onClick={() => setParam(ef.key as any, params[ef.key as keyof typeof params] ? 0 : 1)}
                                className={clsx(
                                    "w-24 h-24 rounded-xl flex flex-col items-center justify-center gap-2 transition-all border",
                                    params[ef.key as keyof typeof params]
                                        ? "bg-blue-600 border-blue-400 text-white"
                                        : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                                )}
                            >
                                <Wand2 size={24} />
                                <span className="text-xs font-bold uppercase">{ef.label}</span>
                            </button>
                        ))}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="h-[320px] bg-[#09090b] border-t border-white/10 flex flex-col flex-shrink-0 z-50">
            {/* Top Bar of Toolbar: Cancel/Apply and Tabs */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#121214]">
                <button
                    onClick={onCancel}
                    className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors px-4 py-2 hover:bg-white/5 rounded-lg"
                >
                    <X size={18} />
                    <span className="text-xs font-bold uppercase tracking-widest">Cancel</span>
                </button>

                {/* Tabs */}
                <div className="flex items-center bg-black/50 p-1 rounded-full border border-white/5">
                    {[
                        { id: 'adjust', icon: Sliders, label: 'Adjust' },
                        { id: 'crop', icon: RotateCw, label: 'Transform' },
                        { id: 'effects', icon: Wand2, label: 'Effects' },

                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={clsx(
                                "flex items-center gap-2 px-6 py-2 rounded-full transition-all text-xs font-bold uppercase tracking-wide",
                                activeTab === tab.id
                                    ? "bg-zinc-800 text-white shadow-sm"
                                    : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            <tab.icon size={14} />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={resetParams}
                        className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors px-3 py-2"
                        title="Reset All"
                    >
                        <RotateCcw size={16} />
                    </button>
                    <button
                        onClick={onApply}
                        className="flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-full transition-all shadow-lg shadow-blue-900/20 font-bold text-xs uppercase tracking-widest"
                    >
                        <Check size={16} />
                        <span>{isEditMode ? 'Update Image' : 'Insert Image'}</span>
                    </button>
                </div>
            </div>

            {/* Dynamic Tool Content */}
            <div className="flex-1 overflow-auto custom-scrollbar relative">
                {renderTools()}
            </div>
        </div>
    );
};
