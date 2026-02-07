import React, { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../../../../store/editorStore';
import { usePDFStore } from '../../../../store/pdfStore';
import { StudioCanvas } from './StudioCanvas';
import { useImageStudioStore } from './useImageStudioStore';
import {
    X, Image as ImageIcon, Check, RotateCcw,
    Sun, Contrast, Droplet, MoveHorizontal, MoveVertical,
    Ghost, RotateCw, Wand2, Sliders, Crop, Maximize, Square, Sparkles, RefreshCw, Heart
} from 'lucide-react';
import clsx from 'clsx';

// Premium Filter Slider Component
const FilterSlider = ({ label, icon, value, min, max, step, onChange }: any) => {
    const percentage = ((value - min) / (max - min)) * 100;

    return (
        <div className="group">
            <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500 group-hover:text-blue-400 transition-colors">
                        {icon}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-300 transition-colors">
                        {label}
                    </span>
                </div>
                <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                    {Math.round(value * 100) / 100}
                </span>
            </div>
            <div className="relative h-5 flex items-center">
                <div className="absolute inset-x-0 h-1 bg-zinc-800 rounded-full overflow-hidden">
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
                    className="w-full h-5 appearance-none cursor-pointer bg-transparent relative z-10
                               [&::-webkit-slider-thumb]:appearance-none 
                               [&::-webkit-slider-thumb]:w-3.5 
                               [&::-webkit-slider-thumb]:h-3.5 
                               [&::-webkit-slider-thumb]:rounded-full 
                               [&::-webkit-slider-thumb]:bg-white 
                               [&::-webkit-slider-thumb]:shadow-lg 
                               [&::-webkit-slider-thumb]:border-2
                               [&::-webkit-slider-thumb]:border-blue-500
                               [&::-webkit-slider-thumb]:cursor-pointer
                               [&::-webkit-slider-thumb]:transition-transform
                               [&::-webkit-slider-thumb]:hover:scale-110"
                />
            </div>
        </div>
    );
};

type Tab = 'adjust' | 'transform' | 'crop' | 'effects';

export const ImageStudio: React.FC = () => {
    const { imageStudio, closeImageStudio, updateObject, addObject, saveToHistory } = useEditorStore();
    const { setAllParams, resetParams, params, setParam, activeTab, setActiveTab, dimensions } = useImageStudioStore();

    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (imageStudio.isOpen) {
            if (imageStudio.initialEditParams) {
                setAllParams(imageStudio.initialEditParams);
            } else {
                resetParams();
            }
        }
    }, [imageStudio.isOpen, imageStudio.initialEditParams, setAllParams, resetParams]);

    useEffect(() => {
        if (!imageStudio.isOpen || !containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                const { width, height } = entry.contentRect;
                setCanvasDimensions({ width, height });
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [imageStudio.isOpen]);

    if (!imageStudio.isOpen || !imageStudio.initialImageSrc) return null;

    const isEditMode = imageStudio.mode === 'edit';

    const handleAspectRatio = (ratio: number | null) => {
        if (!params.crop) return;

        const imgW = dimensions.width || 1000;
        const imgH = dimensions.height || 1000;

        if (ratio === null) {
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

        setParam('crop', { x: newX, y: newY, width: newW, height: newH });
    };

    const handleApply = () => {
        saveToHistory();
        const src = imageStudio.initialImageSrc!;

        if (!src) {
            console.error("No source image found for apply");
            closeImageStudio();
            return;
        }

        const { dimensions } = useImageStudioStore.getState();

        const originalW = dimensions.width || 1;
        const originalH = dimensions.height || 1;

        const cropW = params.crop ? params.crop.width : originalW;
        const cropH = params.crop ? params.crop.height : originalH;

        const newObjectData: any = {
            src: src,
            originalSrc: src,
            brightness: params.brightness,
            contrast: params.contrast,
            saturation: params.saturation,
            blurRadius: params.blur,
            noise: params.noise,
            grayscale: params.grayscale,
            sepia: params.sepia,
            invert: params.invert,
            flipX: params.flipX,
            flipY: params.flipY,
            rotation: params.rotation,
            crop: params.crop || undefined,
            cropShape: params.cropShape || 'rect', // Pass the shape!
            editParams: {
                ...params,
                crop: params.crop || undefined,
                cropShape: params.cropShape || 'rect'
            }
        };

        if (imageStudio.mode === 'create') {
            const img = new Image();
            img.onload = () => {
                const baseW = 300;
                const scale = baseW / cropW;
                const newH = cropH * scale;

                const newId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                try {
                    addObject({
                        id: newId,
                        type: 'image',
                        x: 100,
                        y: 100,
                        width: baseW,
                        height: newH,
                        ...newObjectData
                    });
                    closeImageStudio();
                } catch (err) {
                    console.error("ImageStudio: Error adding object:", err);
                }
            };
            img.src = src;
        } else if (imageStudio.mode === 'edit' && imageStudio.targetObjectId) {
            const editorState = useEditorStore.getState();
            const pdfState = usePDFStore.getState();

            let targetObject;

            if (editorState.currentPage) {
                targetObject = editorState.currentPage.objects.find(o => o.id === imageStudio.targetObjectId);
            }

            if (!targetObject) {
                for (const page of pdfState.pages) {
                    const found = page.objects.find(o => o.id === imageStudio.targetObjectId);
                    if (found) {
                        targetObject = found;
                        break;
                    }
                }
            }

            if (targetObject) {
                const safeWidth = targetObject.width || 0;
                const currentSourceW = targetObject.crop ? targetObject.crop.width : originalW;
                const scaleX = currentSourceW !== 0 ? safeWidth / currentSourceW : 1;
                const newWidth = cropW * scaleX;
                const newHeight = cropH * scaleX;
                newObjectData.width = newWidth;
                newObjectData.height = newHeight;
            }

            updateObject(imageStudio.targetObjectId, newObjectData);
            closeImageStudio();
        } else {
            closeImageStudio();
        }
    };

    const tabs: { id: Tab; icon: any; label: string }[] = [
        { id: 'adjust', icon: Sliders, label: 'Adjust' },
        { id: 'transform', icon: RefreshCw, label: 'Transform' },
        { id: 'crop', icon: Crop, label: 'Crop' },
        { id: 'effects', icon: Sparkles, label: 'Effects' },
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'adjust':
                return (
                    <div className="space-y-4">
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
                    <div className="space-y-3">
                        <button
                            onClick={() => setParam('rotation', (params.rotation + 90) % 360)}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 hover:border-white/10 text-zinc-400 hover:text-white transition-all"
                        >
                            <RotateCw size={18} />
                            <span className="text-xs font-semibold">Rotate 90°</span>
                            <span className="ml-auto text-[10px] bg-white/5 px-2 py-0.5 rounded">{params.rotation}°</span>
                        </button>
                        <button
                            onClick={() => setParam('flipX', !params.flipX)}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                                params.flipX
                                    ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                                    : "bg-zinc-800/50 hover:bg-zinc-800 border-white/5 hover:border-white/10 text-zinc-400 hover:text-white"
                            )}
                        >
                            <MoveHorizontal size={18} />
                            <span className="text-xs font-semibold">Flip Horizontal</span>
                            {params.flipX && <Check size={14} className="ml-auto" />}
                        </button>
                        <button
                            onClick={() => setParam('flipY', !params.flipY)}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                                params.flipY
                                    ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                                    : "bg-zinc-800/50 hover:bg-zinc-800 border-white/5 hover:border-white/10 text-zinc-400 hover:text-white"
                            )}
                        >
                            <MoveVertical size={18} />
                            <span className="text-xs font-semibold">Flip Vertical</span>
                            {params.flipY && <Check size={14} className="ml-auto" />}
                        </button>
                    </div>
                );
            case 'crop':
                return (
                    <div className="space-y-4">
                        {/* Shape Selection */}
                        <div className="space-y-2">
                            <span className="text-[10px] font-bold uppercase text-zinc-500">Shape</span>
                            <div className="flex gap-2">
                                {[
                                    { id: 'rect', label: 'Square', icon: Square },
                                    { id: 'circle', label: 'Circle', icon: null }, // Custom circle icon
                                    { id: 'heart', label: 'Heart', icon: Heart },
                                ].map(shape => (
                                    <button
                                        key={shape.id}
                                        onClick={() => setParam('cropShape', shape.id)}
                                        className={clsx(
                                            "flex-1 py-2 rounded-lg border flex items-center justify-center transition-all",
                                            (params.cropShape === shape.id || (!params.cropShape && shape.id === 'rect'))
                                                ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                                                : "bg-zinc-800/30 border-white/5 text-zinc-500 hover:text-white hover:bg-zinc-800"
                                        )}
                                        title={shape.label}
                                    >
                                        {shape.icon ? <shape.icon size={16} /> : <div className="w-4 h-4 rounded-full border-2 border-current" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Aspect Ratios */}
                        <div className="space-y-2">
                            <span className="text-[10px] font-bold uppercase text-zinc-500">Aspect Ratio</span>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { label: 'Original', ratio: null, icon: Maximize },
                                    { label: '1:1', ratio: 1, icon: Square },
                                    { label: '16:9', ratio: 16 / 9, icon: Crop },
                                    { label: '4:3', ratio: 4 / 3, icon: Crop },
                                    { label: '3:2', ratio: 3 / 2, icon: Crop },
                                    { label: '9:16', ratio: 9 / 16, icon: Crop },
                                ].map(p => (
                                    <button
                                        key={p.label}
                                        onClick={() => handleAspectRatio(p.ratio)}
                                        className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl bg-zinc-800/30 hover:bg-zinc-800 border border-white/5 hover:border-white/10 text-zinc-500 hover:text-white transition-all"
                                    >
                                        <p.icon size={14} />
                                        <span className="text-[9px] font-bold uppercase">{p.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Manual Dimensions */}
                        <div className="flex items-center gap-2">
                            <div className="flex-1 flex items-center gap-2 bg-zinc-900 rounded-lg px-2.5 py-2 border border-white/5">
                                <span className="text-[9px] uppercase font-bold text-zinc-500">W</span>
                                <input
                                    type="number"
                                    value={params.crop ? Math.round(params.crop.width) : ''}
                                    onChange={(e) => params.crop && setParam('crop', { ...params.crop, width: Number(e.target.value) })}
                                    className="flex-1 w-full bg-transparent text-xs font-mono text-zinc-300 focus:outline-none"
                                />
                            </div>
                            <span className="text-zinc-600">×</span>
                            <div className="flex-1 flex items-center gap-2 bg-zinc-900 rounded-lg px-2.5 py-2 border border-white/5">
                                <span className="text-[9px] uppercase font-bold text-zinc-500">H</span>
                                <input
                                    type="number"
                                    value={params.crop ? Math.round(params.crop.height) : ''}
                                    onChange={(e) => params.crop && setParam('crop', { ...params.crop, height: Number(e.target.value) })}
                                    className="flex-1 w-full bg-transparent text-xs font-mono text-zinc-300 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>
                );
            case 'effects':
                return (
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { key: 'grayscale', label: 'B&W' },
                            { key: 'sepia', label: 'Sepia' },
                            { key: 'invert', label: 'Invert' },
                        ].map(ef => (
                            <button
                                key={ef.key}
                                onClick={() => setParam(ef.key as any, params[ef.key as keyof typeof params] ? 0 : 1)}
                                className={clsx(
                                    "flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border transition-all",
                                    params[ef.key as keyof typeof params]
                                        ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                                        : "bg-zinc-800/30 border-white/5 text-zinc-500 hover:bg-zinc-800 hover:text-white hover:border-white/10"
                                )}
                            >
                                <Wand2 size={16} />
                                <span className="text-[9px] font-bold uppercase">{ef.label}</span>
                            </button>
                        ))}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={closeImageStudio}
            />

            {/* Modal Content - Side by Side Layout */}
            <div className="relative bg-[#18181b] w-full max-w-5xl h-[85vh] max-h-[800px] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex animate-in zoom-in-95 duration-200">

                {/* Left Side - Large Preview */}
                <div className="flex-1 relative bg-[#0a0a0b] flex items-center justify-center">
                    {/* Checkerboard Background */}
                    <div
                        className="absolute inset-0 opacity-[0.04]"
                        style={{
                            backgroundImage: `linear-gradient(45deg, #444 25%, transparent 25%), 
                                              linear-gradient(-45deg, #444 25%, transparent 25%), 
                                              linear-gradient(45deg, transparent 75%, #444 75%), 
                                              linear-gradient(-45deg, transparent 75%, #444 75%)`,
                            backgroundSize: '16px 16px',
                            backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
                        }}
                    />

                    {/* Canvas Container */}
                    <div ref={containerRef} className="absolute inset-4 flex items-center justify-center">
                        {canvasDimensions.width > 0 && canvasDimensions.height > 0 && (
                            <div className="relative rounded-lg overflow-hidden shadow-2xl ring-1 ring-white/10">
                                <StudioCanvas
                                    src={imageStudio.initialImageSrc}
                                    width={canvasDimensions.width}
                                    height={canvasDimensions.height}
                                />
                            </div>
                        )}
                    </div>

                    {/* Image Info */}
                    <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-medium text-zinc-400">
                            {dimensions.width > 0 ? `${Math.round(dimensions.width)} × ${Math.round(dimensions.height)} px` : 'Loading...'}
                        </span>
                    </div>
                </div>

                {/* Right Side - Controls Panel */}
                <div className="w-[320px] flex flex-col bg-[#18181b] border-l border-white/5">

                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                <ImageIcon size={14} className="text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white">
                                    {isEditMode ? 'Edit Image' : 'Add Image'}
                                </h3>
                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Studio</span>
                            </div>
                        </div>
                        <button
                            onClick={closeImageStudio}
                            className="w-7 h-7 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors flex items-center justify-center"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex p-1 gap-0.5 bg-[#0f0f10] border-b border-white/5">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={clsx(
                                    "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all text-[10px] font-bold uppercase tracking-wide",
                                    activeTab === tab.id
                                        ? "bg-[#18181b] text-white shadow"
                                        : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                <tab.icon size={12} />
                                <span className="hidden sm:inline">{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {renderTabContent()}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-white/5 bg-[#0f0f10] space-y-3">
                        <button
                            onClick={resetParams}
                            className="w-full flex items-center justify-center gap-2 text-zinc-500 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-wider py-2 hover:bg-white/5 rounded-lg"
                        >
                            <RotateCcw size={12} />
                            <span>Reset All</span>
                        </button>
                        <div className="flex gap-2">
                            <button
                                onClick={closeImageStudio}
                                className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 font-medium text-xs hover:bg-zinc-700 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleApply}
                                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition flex items-center justify-center gap-2"
                            >
                                <Check size={14} />
                                {isEditMode ? 'Update' : 'Add'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
