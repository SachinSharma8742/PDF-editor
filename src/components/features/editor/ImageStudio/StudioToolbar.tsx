import React, { useRef } from 'react';
import { useImageStudioStore } from './useImageStudioStore';
import {
    Sun, Contrast, Droplet, MoveHorizontal, MoveVertical,
    Ghost, RotateCw, Wand2, Sliders, Check, RotateCcw,
    Crop, Maximize, Square, Ratio
} from 'lucide-react';
import clsx from 'clsx';
import { useEditorStore } from '../../../../store/editorStore';

const FilterSlider = ({ label, icon, value, min, max, step, onChange }: any) => (
    <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-zinc-400">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {icon} <span>{label}</span>
            </div>
            <span className="text-[10px] font-mono text-zinc-300 bg-white/5 px-1.5 py-0.5 rounded">{Math.round(value * 100) / 100}</span>
        </div>
        <div className="relative flex items-center h-4">
            <input
                type="range"
                min={min} max={max} step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
        </div>
    </div>
);

export const StudioToolbar: React.FC<{ onApply: () => void; onCancel: () => void }> = ({ onApply, onCancel }) => {
    const { params, setParam, activeTab, setActiveTab, resetParams, dimensions } = useImageStudioStore();
    const { imageStudio } = useEditorStore();

    const isEditMode = imageStudio.mode === 'edit';

    const handleAspectRatio = (ratio: number | null) => {
        if (!params.crop) return;

        const imgW = dimensions.width || 1000;
        const imgH = dimensions.height || 1000;

        // "Original" / Reset
        if (ratio === null) {
            setParam('crop', {
                x: 0,
                y: 0,
                width: imgW,
                height: imgH
            });
            return;
        }

        // Smart Crop Logic: Maximize within Image Dimensions
        // Use the full image as the bounding context to find the largest possible box of the target ratio.

        let newW, newH;

        if ((imgW / imgH) > ratio) {
            // Image is wider than target ratio
            // Height is the constraint -> Use full height
            newH = imgH;
            newW = newH * ratio;
        } else {
            // Image is taller than target ratio
            // Width is the constraint -> Use full width
            newW = imgW;
            newH = newW / ratio;
        }

        // Center the new box (which will be centered in the image)
        const newX = (imgW - newW) / 2;
        const newY = (imgH - newH) / 2;

        setParam('crop', {
            x: newX,
            y: newY,
            width: newW,
            height: newH
        });
    };

    const renderTools = () => {
        switch (activeTab) {
            case 'adjust':
                return (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-1">
                        <FilterSlider
                            label="Brightness"
                            icon={<Sun size={12} />}
                            value={params.brightness}
                            min={-1} max={1} step={0.05}
                            onChange={(v: number) => setParam('brightness', v)}
                        />
                        <FilterSlider
                            label="Contrast"
                            icon={<Contrast size={12} />}
                            value={params.contrast}
                            min={-100} max={100} step={5}
                            onChange={(v: number) => setParam('contrast', v)}
                        />
                        <FilterSlider
                            label="Saturation"
                            icon={<Droplet size={12} />}
                            value={params.saturation}
                            min={-2} max={10} step={0.1}
                            onChange={(v: number) => setParam('saturation', v)}
                        />
                        <FilterSlider
                            label="Blur"
                            icon={<Ghost size={12} />}
                            value={params.blur}
                            min={0} max={40} step={1}
                            onChange={(v: number) => setParam('blur', v)}
                        />
                    </div>
                );
            case 'transform':
                return (
                    <div className="flex items-center justify-center gap-4 pt-1">
                        <button
                            onClick={() => setParam('rotation', (params.rotation + 90) % 360)}
                            className="group flex flex-col items-center gap-1.5 p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 hover:text-white transition-all w-20 border border-transparent hover:border-white/10"
                        >
                            <RotateCw size={18} className="text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                            <span className="text-[10px] font-bold uppercase tracking-wide">Rotate</span>
                        </button>
                        <div className="w-px h-8 bg-white/10 mx-2" />
                        <button
                            onClick={() => setParam('flipX', !params.flipX)}
                            className={clsx(
                                "flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all w-20 border",
                                params.flipX
                                    ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                    : "bg-zinc-800/50 text-zinc-500 border-transparent hover:bg-zinc-800 hover:text-white hover:border-white/10"
                            )}
                        >
                            <MoveHorizontal size={18} />
                            <span className="text-[10px] font-bold uppercase tracking-wide">Flip X</span>
                        </button>
                        <button
                            onClick={() => setParam('flipY', !params.flipY)}
                            className={clsx(
                                "flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all w-20 border",
                                params.flipY
                                    ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                    : "bg-zinc-800/50 text-zinc-500 border-transparent hover:bg-zinc-800 hover:text-white hover:border-white/10"
                            )}
                        >
                            <MoveVertical size={18} />
                            <span className="text-[10px] font-bold uppercase tracking-wide">Flip Y</span>
                        </button>
                    </div>
                );
            case 'crop':
                return (
                    <div className="flex flex-col gap-3 pt-1">
                        {/* Presets */}
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide justify-center">
                            {[
                                { label: 'Original', ratio: null, icon: Maximize },
                                { label: 'Square', ratio: 1, icon: Square },
                                { label: '16:9', ratio: 16 / 9, icon: Ratio },
                                { label: '4:3', ratio: 4 / 3, icon: Ratio },
                                { label: '3:2', ratio: 3 / 2, icon: Ratio },
                            ].map((p, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleAspectRatio(p.ratio)}
                                    className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800/30 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 transition min-w-[60px]"
                                >
                                    <p.icon size={14} />
                                    <span className="text-[9px] font-bold uppercase">{p.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Manual Input */}
                        <div className="flex items-center justify-center gap-3">
                            <div className="flex items-center gap-2 bg-zinc-900 rounded-lg px-2 py-1 border border-white/5">
                                <span className="text-[10px] uppercase font-bold text-zinc-500">W</span>
                                <input
                                    type="number"
                                    value={params.crop ? Math.round(params.crop.width) : ''}
                                    onChange={(e) => params.crop && setParam('crop', { ...params.crop, width: Number(e.target.value) })}
                                    className="w-12 bg-transparent text-xs font-mono text-zinc-300 focus:outline-none"
                                    placeholder="W"
                                />
                            </div>
                            <div className="flex items-center gap-2 bg-zinc-900 rounded-lg px-2 py-1 border border-white/5">
                                <span className="text-[10px] uppercase font-bold text-zinc-500">H</span>
                                <input
                                    type="number"
                                    value={params.crop ? Math.round(params.crop.height) : ''}
                                    onChange={(e) => params.crop && setParam('crop', { ...params.crop, height: Number(e.target.value) })}
                                    className="w-12 bg-transparent text-xs font-mono text-zinc-300 focus:outline-none"
                                    placeholder="H"
                                />
                            </div>
                        </div>
                    </div>
                );
            case 'effects':
                return (
                    <div className="flex items-center gap-3 pt-1 overflow-x-auto pb-2 scrollbar-hide">
                        {[
                            { key: 'grayscale', label: 'B&W' },
                            { key: 'sepia', label: 'Sepia' },
                            { key: 'invert', label: 'Invert' },
                        ].map(ef => (
                            <button
                                key={ef.key}
                                onClick={() => setParam(ef.key as any, params[ef.key as keyof typeof params] ? 0 : 1)}
                                className={clsx(
                                    "w-16 h-16 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all border",
                                    params[ef.key as keyof typeof params]
                                        ? "bg-blue-500/10 border-blue-500/50 text-blue-400 shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]"
                                        : "bg-zinc-800/30 border-white/5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 hover:border-white/10"
                                )}
                            >
                                <Wand2 size={16} />
                                <span className="text-[9px] font-bold uppercase tracking-wider">{ef.label}</span>
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
            <div className="flex items-center justify-center px-4 py-2 border-b border-white/5 gap-1 bg-[#18181b]">
                {[
                    { id: 'adjust', icon: Sliders, label: 'Adjust' },
                    { id: 'transform', icon: RotateCw, label: 'Transform' },
                    { id: 'crop', icon: Crop, label: 'Crop' },
                    { id: 'effects', icon: Wand2, label: 'Filters' },

                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-1.5 rounded-full transition-all text-[11px] font-bold uppercase tracking-wider",
                            activeTab === tab.id
                                ? "bg-white text-black shadow-lg shadow-white/10"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                        )}
                    >
                        <tab.icon size={12} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Dynamic Tool Content */}
            <div className="p-5 min-h-[120px] bg-[#121214]">
                {renderTools()}
            </div>

            {/* Footer Actions */}
            <div className="px-5 py-4 border-t border-white/5 bg-[#09090b] flex justify-between items-center">
                <button
                    onClick={resetParams}
                    className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-wider px-2 py-1 hover:bg-white/5 rounded-lg"
                >
                    <RotateCcw size={12} /> Reset
                </button>

                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg bg-transparent border border-white/10 text-zinc-300 font-medium text-xs hover:bg-white/5 transition"
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
