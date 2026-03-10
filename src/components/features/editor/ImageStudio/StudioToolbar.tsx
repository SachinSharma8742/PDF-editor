import React from 'react';
import { useImageStudioStore, type ImageStudioStore } from './useImageStudioStore';
import {
    Sun, Contrast, Droplet, MoveHorizontal, MoveVertical,
    RotateCw, Wand2, Sliders, Check, RotateCcw,
    Crop, Maximize, Square, Sparkles, RefreshCw
} from 'lucide-react';

import clsx from 'clsx';
import { useEditorStore } from '../../../../store/editorStore';

interface FilterSliderProps {
    label: string;
    icon: React.ReactNode;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
    onPointerDown?: () => void;
}

// Premium Filter Slider Component
const FilterSlider: React.FC<FilterSliderProps> = ({ label, icon, value, min, max, step, onChange, onPointerDown }) => {
    const percentage = ((value - min) / (max - min)) * 100;

    return (
        <div className="group">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-zinc-500 group-hover:text-blue-400 transition-colors">
                        {icon}
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-300 transition-colors">
                        {label}
                    </span>
                </div>
                <span className="text-[11px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                    {Math.round(value * 100) / 100}
                </span>
            </div>
            <div className="relative h-6 flex items-center">
                {/* Track Background */}
                <div className="absolute inset-x-0 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    {/* Fill */}
                    <div
                        className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all"
                        style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
                    />
                </div>
                <input
                    type="range"
                    min={min} max={max} step={step}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    onPointerDown={onPointerDown}
                    className="w-full h-6 appearance-none cursor-pointer bg-transparent relative z-10
                               [&::-webkit-slider-thumb]:appearance-none 
                               [&::-webkit-slider-thumb]:w-4 
                               [&::-webkit-slider-thumb]:h-4 
                               [&::-webkit-slider-thumb]:rounded-full 
                               [&::-webkit-slider-thumb]:bg-white 
                               [&::-webkit-slider-thumb]:shadow-lg 
                               [&::-webkit-slider-thumb]:shadow-blue-500/30
                               [&::-webkit-slider-thumb]:border-2
                               [&::-webkit-slider-thumb]:border-blue-500
                               [&::-webkit-slider-thumb]:cursor-pointer
                               [&::-webkit-slider-thumb]:transition-all
                               [&::-webkit-slider-thumb]:hover:scale-110
                               [&::-moz-range-thumb]:w-4 
                               [&::-moz-range-thumb]:h-4 
                               [&::-moz-range-thumb]:rounded-full 
                               [&::-moz-range-thumb]:bg-white 
                               [&::-moz-range-thumb]:border-2
                               [&::-moz-range-thumb]:border-blue-500"
                />
            </div>
        </div>
    );
};

interface TransformButtonProps {
    icon: React.ElementType;
    label: string;
    active: boolean;
    onClick: () => void;
}

// Transform Button Component
const TransformButton: React.FC<TransformButtonProps> = ({ icon: Icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={clsx(
            "flex flex-col items-center gap-2 px-5 py-3 rounded-xl transition-all border group",
            active
                ? "bg-gradient-to-b from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400 shadow-lg shadow-blue-500/10"
                : "bg-zinc-800/30 border-white/5 text-zinc-500 hover:bg-zinc-800 hover:text-white hover:border-white/10"
        )}
    >
        <Icon size={20} className={clsx("transition-transform", active ? "scale-110" : "group-hover:scale-110")} />
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
);

interface AspectButtonProps {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
}

// Aspect Ratio Button Component
const AspectButton: React.FC<AspectButtonProps> = ({ icon: Icon, label, onClick }) => (
    <button
        onClick={onClick}
        className="flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-800/30 hover:bg-zinc-800 border border-white/5 hover:border-white/10 text-zinc-500 hover:text-white transition-all group"
    >
        <Icon size={16} className="group-hover:scale-110 transition-transform" />
        <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </button>
);





interface EffectButtonProps {
    label: string;
    active: boolean;
    onClick: () => void;
}

// Effect Button Component
const EffectButton: React.FC<EffectButtonProps> = ({ label, active, onClick }) => (
    <button
        onClick={onClick}
        className={clsx(
            "flex-1 min-w-[80px] h-[70px] rounded-xl flex flex-col items-center justify-center gap-2 transition-all border group",
            active
                ? "bg-gradient-to-br from-purple-500/20 to-pink-500/10 border-purple-500/30 text-purple-400 shadow-lg shadow-purple-500/10"
                : "bg-zinc-800/30 border-white/5 text-zinc-500 hover:bg-zinc-800 hover:text-white hover:border-white/10"
        )}
    >
        <Wand2 size={18} className={clsx("transition-transform", active ? "rotate-12" : "group-hover:rotate-12")} />
        <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </button>
);

export const StudioToolbar: React.FC<{ onApply: () => void; onCancel: () => void }> = ({ onApply, onCancel }) => {
    const { params, setParam, activeTab, setActiveTab, resetParams, dimensions, pushHistory } = useImageStudioStore();
    const { imageStudio } = useEditorStore();

    const isEditMode = imageStudio.mode === 'edit';

    const handleAspectRatio = (ratio: number | null) => {
        if (!params.crop) return;

        const imgW = dimensions.width || 1000;
        const imgH = dimensions.height || 1000;

        if (ratio === null) {
            pushHistory();
            setParam('crop', { x: 0, y: 0, width: imgW, height: imgH });
            return;
        }

        let newW, newH;

        if ((imgW / imgH) > ratio) {
            newH = imgH;
            newW = newH * ratio;
        } else {
            newW = imgW;
            newH = newW / ratio;
        }

        const newX = (imgW - newW) / 2;
        const newY = (imgH - newH) / 2;

        pushHistory();
        setParam('crop', { x: newX, y: newY, width: newW, height: newH });
    };

    const tabs = [
        { id: 'adjust', icon: Sliders, label: 'Adjust' },
        { id: 'transform', icon: RefreshCw, label: 'Transform' },
        { id: 'crop', icon: Crop, label: 'Crop' },
        { id: 'effects', icon: Sparkles, label: 'Effects' },
    ];

    const renderTools = () => {
        switch (activeTab) {
            case 'adjust':
                return (
                    <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                        <FilterSlider
                            label="Brightness"
                            icon={<Sun size={12} />}
                            value={params.brightness}
                            min={-1} max={1} step={0.05}
                            onChange={(v: number) => setParam('brightness', v)}
                            onPointerDown={pushHistory}
                        />
                        <FilterSlider
                            label="Contrast"
                            icon={<Contrast size={12} />}
                            value={params.contrast}
                            min={-100} max={100} step={5}
                            onChange={(v: number) => setParam('contrast', v)}
                            onPointerDown={pushHistory}
                        />
                        <FilterSlider
                            label="Saturation"
                            icon={<Droplet size={12} />}
                            value={params.saturation}
                            min={-2} max={10} step={0.1}
                            onChange={(v: number) => setParam('saturation', v)}
                            onPointerDown={pushHistory}
                        />
                    </div>
                );
            case 'transform':
                return (
                    <div className="flex items-center justify-center gap-4">
                        <TransformButton
                            icon={RotateCw}
                            label="Rotate 90°"
                            active={false}
                            onClick={() => { pushHistory(); setParam('rotation', (params.rotation + 90) % 360); }}
                        />
                        <div className="w-px h-12 bg-white/10" />
                        <TransformButton
                            icon={MoveHorizontal}
                            label="Flip X"
                            active={params.flipX}
                            onClick={() => { pushHistory(); setParam('flipX', !params.flipX); }}
                        />
                        <TransformButton
                            icon={MoveVertical}
                            label="Flip Y"
                            active={params.flipY}
                            onClick={() => { pushHistory(); setParam('flipY', !params.flipY); }}
                        />
                    </div>
                );
            case 'crop':
                return (
                    <div className="flex flex-col gap-4">


                        {/* Aspect Ratio Presets - Moved to top as primary control */}
                        <div className="flex items-center justify-center gap-3 pt-2">
                            <AspectButton icon={Maximize} label="Original" onClick={() => handleAspectRatio(null)} />
                            <AspectButton icon={Square} label="1:1" onClick={() => handleAspectRatio(1)} />
                            <AspectButton icon={Crop} label="16:9" onClick={() => handleAspectRatio(16 / 9)} />
                            <AspectButton icon={Crop} label="4:3" onClick={() => handleAspectRatio(4 / 3)} />
                            <AspectButton icon={Crop} label="3:2" onClick={() => handleAspectRatio(3 / 2)} />
                        </div>

                        {/* Manual Dimensions */}
                        <div className="flex items-center justify-center gap-4">
                            <div className="flex items-center gap-2 bg-zinc-900/80 rounded-xl px-3 py-2 border border-white/5">
                                <span className="text-[10px] uppercase font-bold text-zinc-500">W</span>
                                <input
                                    type="number"
                                    value={params.crop ? Math.round(params.crop.width) : ''}
                                    onChange={(e) => params.crop && setParam('crop', { ...params.crop, width: Number(e.target.value) })}
                                    className="w-16 bg-transparent text-xs font-mono text-zinc-300 focus:outline-none focus:text-white"
                                    placeholder="Width"
                                />
                            </div>
                            <span className="text-zinc-600">×</span>
                            <div className="flex items-center gap-2 bg-zinc-900/80 rounded-xl px-3 py-2 border border-white/5">
                                <span className="text-[10px] uppercase font-bold text-zinc-500">H</span>
                                <input
                                    type="number"
                                    value={params.crop ? Math.round(params.crop.height) : ''}
                                    onChange={(e) => params.crop && setParam('crop', { ...params.crop, height: Number(e.target.value) })}
                                    className="w-16 bg-transparent text-xs font-mono text-zinc-300 focus:outline-none focus:text-white"
                                    placeholder="Height"
                                />
                            </div>
                        </div>
                    </div>
                );
            case 'effects':
                return (
                    <div className="flex items-center justify-center gap-4">
                        <EffectButton
                            label="Grayscale"
                            active={params.grayscale === 1}
                            onClick={() => { pushHistory(); setParam('grayscale', params.grayscale ? 0 : 1); }}
                        />
                        <EffectButton
                            label="Sepia"
                            active={params.sepia === 1}
                            onClick={() => { pushHistory(); setParam('sepia', params.sepia ? 0 : 1); }}
                        />
                        <EffectButton
                            label="Invert"
                            active={params.invert === 1}
                            onClick={() => { pushHistory(); setParam('invert', params.invert ? 0 : 1); }}
                        />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="bg-gradient-to-b from-[#141416] to-[#0c0c0d] border-t border-white/[0.06] flex flex-col flex-shrink-0">
            {/* Tabs */}
            <div className="flex items-center justify-center px-6 py-3 border-b border-white/[0.04] gap-2">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as ImageStudioStore['activeTab'])}
                        className={clsx(
                            "flex items-center gap-2.5 px-5 py-2 rounded-xl transition-all text-[11px] font-bold uppercase tracking-wider",
                            activeTab === tab.id
                                ? "bg-white text-black shadow-lg shadow-white/20"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                        )}
                    >
                        <tab.icon size={14} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Dynamic Tool Content */}
            <div className="px-8 py-4 min-h-[110px] flex items-center justify-center">
                {renderTools()}
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-white/[0.04] bg-[#0a0a0b] flex justify-between items-center">
                <button
                    onClick={resetParams}
                    className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-[11px] font-bold uppercase tracking-wider px-4 py-2 hover:bg-white/5 rounded-xl group"
                >
                    <RotateCcw size={14} className="group-hover:-rotate-180 transition-transform duration-500" />
                    <span>Reset All</span>
                </button>

                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="px-5 py-2.5 rounded-xl bg-zinc-800/50 border border-white/10 text-zinc-300 font-semibold text-xs hover:bg-zinc-800 hover:border-white/20 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onApply}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:from-blue-500 hover:to-blue-400 transition-all flex items-center gap-2 group"
                    >
                        <span>{isEditMode ? 'Update Image' : 'Add Image'}</span>
                        <Check size={14} className="group-hover:scale-110 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
};
