import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useEditorStore } from '../../../../store/editorStore';
import { type PDFObject } from '../../../../store/pdfStore';
import { StudioCanvas } from './StudioCanvas';
import { useImageStudioStore, type ImageEditParams, DEFAULT_EDIT_PARAMS } from './useImageStudioStore';
import { smartCrop } from '../../../../utils/smartCrop';
import { buildPipeline } from '../../../../imagePipeline/buildPipeline';
import { IMAGE_TOOLS, type ImageTool, CropIcon } from '../../../../config/imageTools';
import {
    RotateCw, Wand2, Sliders, RefreshCw,
    Loader2, Scan, Hammer,
    Check, X, Image as ImageIcon, RotateCcw, Sparkles,
    Square, Circle, Heart
} from 'lucide-react';
import clsx from 'clsx';


// Premium Filter Slider Component
interface FilterSliderProps {
    label: string;
    icon: React.ReactNode;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
    onPointerDown?: () => void;
    disabled?: boolean;
}

interface ShapeButtonProps {
    icon: React.ElementType;
    label: string;
    active: boolean;
    onClick: () => void;
}

const ShapeButton: React.FC<ShapeButtonProps> = ({ icon: Icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={clsx(
            "flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl transition-all border group",
            active
                ? "bg-blue-600/20 border-blue-500/50 text-blue-400"
                : "bg-zinc-800/30 border-white/5 text-zinc-500 hover:bg-zinc-800 hover:text-white hover:border-white/10"
        )}
    >
        <Icon size={16} className={clsx("transition-transform", active ? "scale-110" : "group-hover:scale-110")} />
        <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </button>
);

const FilterSlider = ({ label, icon, value, min, max, step, onChange, onPointerDown, disabled }: FilterSliderProps) => {
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
                    onPointerDown={onPointerDown}
                    disabled={disabled}
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

type Tab = 'transform' | 'adjust' | 'effects' | 'crop' | 'tools';

// Aspect ratio presets
const ASPECT_RATIOS = [
    { label: 'Free', value: null },
    { label: '1:1', value: 1 },
    { label: '4:3', value: 4 / 3 },
    { label: '3:2', value: 3 / 2 },
    { label: '16:9', value: 16 / 9 },
    { label: '9:16', value: 9 / 16 },
] as const;

export const ImageStudio: React.FC = () => {
    const { imageStudio, closeImageStudio, updateObject, addObject, saveToHistory } = useEditorStore();
    const { setAllParams, resetParams, params, setParam, activeTab, setActiveTab, dimensions } = useImageStudioStore();

    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });

    // Background removal state
    const [bgRemovalProgress, setBgRemovalProgress] = useState<{ stage: string; percent: number } | null>(null);
    const [, setBgRemovalError] = useState<string | null>(null);
    const [isBgProcessing, setIsBgProcessing] = useState(false);

    // Image preprocessing state
    const [isSmartCropping, setIsSmartCropping] = useState(false);
    const [isDeskewing, setIsDeskewing] = useState(false);
    const [isUpscaling, setIsUpscaling] = useState(false);

    const [, setPreprocessError] = useState<string | null>(null);

    // Crop aspect ratio state
    const [selectedAspectRatio, setSelectedAspectRatio] = useState<number | null>(null);

    useEffect(() => {
        if (imageStudio.isOpen) {
            if (imageStudio.initialEditParams) {
                setAllParams(imageStudio.initialEditParams as unknown as ImageEditParams);
            } else {
                resetParams();
            }

            // Phase 4: Initialize Source Bitmap for Pipeline
            if (imageStudio.initialImageSrc) {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.src = imageStudio.initialImageSrc;
                img.onload = async () => {
                    try {
                        const bitmap = await createImageBitmap(img);
                        useImageStudioStore.getState().setSourceBitmap(bitmap);
                        useImageStudioStore.getState().setDimensions(img.naturalWidth, img.naturalHeight);
                    } catch (e) {
                        console.error("Failed to create bitmap", e);
                    }
                };
            }
        } else {
            useImageStudioStore.getState().setSourceBitmap(undefined as unknown as ImageBitmap);
        }
    }, [imageStudio.isOpen, imageStudio.initialImageSrc, imageStudio.initialEditParams, setAllParams, resetParams]);

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

    // Background removal handler
    const handleRemoveBackground = useCallback(async () => {
        const { operations, setOperation } = useImageStudioStore.getState();
        if (operations.cleanup.backgroundRemoved || isBgProcessing) return;

        setIsBgProcessing(true);
        setBgRemovalError(null);
        setBgRemovalProgress({ stage: 'Initializing...', percent: 0 });

        try {
            setOperation('cleanup', { backgroundRemoved: true });
            setBgRemovalProgress({ stage: 'Processing...', percent: 50 });

            setTimeout(() => {
                setBgRemovalProgress({ stage: 'Complete!', percent: 100 });
                setIsBgProcessing(false);
            }, 1000);

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Background removal failed';
            setBgRemovalError(message);
            setOperation('cleanup', { backgroundRemoved: false });
            setIsBgProcessing(false);
        }
    }, [isBgProcessing]);

    // Smart Crop handler — suggestion only (non-destructive)
    const handleSmartCrop = useCallback(async () => {
        const src = imageStudio.initialImageSrc;
        if (!src || isSmartCropping) return;

        setIsSmartCropping(true);
        setPreprocessError(null);

        try {
            const cropRect = await smartCrop(src);
            if (!cropRect) {
                setPreprocessError('No margins detected — image unchanged.');
            } else {
                // Non-destructive: set crop bounds as suggestion
                const { setOperation } = useImageStudioStore.getState();
                setOperation('transform', { crop: cropRect });
                setParam('crop', cropRect);
                // Stay in crop tab
                setActiveTab('crop');
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Smart crop failed';
            setPreprocessError(message);
        } finally {
            setIsSmartCropping(false);
        }
    }, [imageStudio.initialImageSrc, isSmartCropping, setParam, setActiveTab]);

    // Auto Deskew handler
    const handleDeskew = useCallback(async () => {
        const { operations, setOperation } = useImageStudioStore.getState();
        if (operations.cleanup.deskew || isDeskewing) return;

        setIsDeskewing(true);

        try {
            setOperation('cleanup', { deskew: true });
            setTimeout(() => setIsDeskewing(false), 500);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Deskew failed';
            console.error(message);
            setOperation('cleanup', { deskew: false });
            setIsDeskewing(false);
        }
    }, [isDeskewing]);

    // AI Upscale handler — once only
    const handleUpscale = useCallback(async () => {
        const { operations, setOperation } = useImageStudioStore.getState();
        if (operations.enhance.upscale || isUpscaling) return;

        setIsUpscaling(true);
        setPreprocessError(null);

        try {
            // Non-Destructive: Set factor to 2. No baking.
            // setOperation('enhance', { upscale: true }); // Update Store logic handles factor now?
            // Let's be explicit via setParam to trigger the logic we just added
            setParam('upscaleFactor', 2);

            setTimeout(() => setIsUpscaling(false), 500);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Upscale failed';
            setPreprocessError(message);
            setOperation('enhance', { upscale: false });
            setIsUpscaling(false);
        }
    }, [isUpscaling, setParam]);


    if (!imageStudio.isOpen || !imageStudio.initialImageSrc) return null;

    const isEditMode = imageStudio.mode === 'edit';
    const { isCropMode } = useImageStudioStore.getState();

    const handleApply = async () => {
        const { sourceBitmap, operations, pipelineCache, resetParams } = useImageStudioStore.getState();

        if (!sourceBitmap) {
            closeImageStudio();
            return;
        }

        saveToHistory();
        let finalSrc = imageStudio.initialImageSrc!;
        const { currentPage } = useEditorStore.getState();
        let finalWidth = dimensions.width;
        let finalHeight = dimensions.height;

        try {
            const { output } = await buildPipeline(sourceBitmap, operations, pipelineCache);

            // Convert Bitmap to DataURL for saving
            const canvas = document.createElement('canvas');
            canvas.width = output.width;
            canvas.height = output.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(output, 0, 0);
                finalSrc = canvas.toDataURL('image/png');

                const bakedAR = output.width / output.height;

                // Dimension Preservation Logic
                if (imageStudio.mode === 'edit' && imageStudio.targetObjectId && currentPage) {
                    const existingObj = currentPage.objects.find(o => o.id === imageStudio.targetObjectId);
                    if (existingObj) {
                        // Keep the visual width, adjust height for AR
                        finalWidth = existingObj.width || output.width;
                        finalHeight = finalWidth / bakedAR;
                    } else {
                        finalWidth = output.width;
                        finalHeight = output.height;
                    }
                } else {
                    // New Object: Use natural dimensions
                    finalWidth = output.width;
                    finalHeight = output.height;
                }
            }
            output.close();
        } catch (err) {
            console.error("ImageStudio: Error baking pipeline:", err);
            // Fallback to original if baking fails
        }

        const newObjectData: Partial<PDFObject> = {
            src: finalSrc,
            width: finalWidth,
            height: finalHeight,
            // Reset Edit Params since they are now baked into the image
            editParams: { ...DEFAULT_EDIT_PARAMS },
            brightness: DEFAULT_EDIT_PARAMS.brightness,
            contrast: DEFAULT_EDIT_PARAMS.contrast,
            saturation: DEFAULT_EDIT_PARAMS.saturation,
            grayscale: DEFAULT_EDIT_PARAMS.grayscale,
            sepia: DEFAULT_EDIT_PARAMS.sepia,
            invert: DEFAULT_EDIT_PARAMS.invert,
            flipX: DEFAULT_EDIT_PARAMS.flipX,
            flipY: DEFAULT_EDIT_PARAMS.flipY,
            rotation: DEFAULT_EDIT_PARAMS.rotation,
            crop: undefined, // Reset crop since it's baked
            cropShape: 'rect'
        };

        if (imageStudio.mode === 'create') {
            const newId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            addObject({
                id: newId,
                type: 'image',
                x: 100,
                y: 100,
                ...newObjectData
            });
        } else if (imageStudio.mode === 'edit' && imageStudio.targetObjectId) {
            updateObject(imageStudio.targetObjectId, {
                ...newObjectData
            });
        }

        resetParams();
        closeImageStudio();
    };

    const tabs: { id: Tab; icon: React.ElementType; label: string }[] = [
        { id: 'transform', icon: RefreshCw, label: 'Transform' },
        { id: 'crop', icon: CropIcon, label: 'Crop' },
        { id: 'adjust', icon: Sliders, label: 'Adjust' },
        { id: 'effects', icon: Wand2, label: 'Effects' },
        { id: 'tools', icon: Hammer, label: 'Tools' },
    ];

    const handleToolAction = (tool: ImageTool, value?: number) => {
        const { operations, setOperation, setParam } = useImageStudioStore.getState();

        // Don't allow other tool actions while in crop mode
        if (isCropMode && tool.category !== 'adjust') return;

        // 1. Sliders (Adjust/Clarity/Effects)
        if (tool.type === 'slider') {
            // General Slider Handler using operationKey
            if (tool.operationKey) {
                const parts = tool.operationKey.split('.');
                const paramName = parts[1]; // e.g. 'brightness', 'noiseReduction'

                if (paramName) {
                    // Update Param (UI)
                    setParam(paramName as keyof ImageEditParams, value || 0);
                    // Update Operation (Engine) - handled by store subscription/sync usually, 
                    // but here we might need to be explicit if setParam doesn't auto-sync everything?
                    // setParam in store DOES sync to operations for mapped keys.
                    // The store implementation of setParam explicitly maps 'noiseReduction', 'sharpen', etc.
                    // So setParam is enough!
                }
            }
            return;
        }

        // 2. Buttons / Toggles
        switch (tool.id) {
            case 'rotate': {
                useImageStudioStore.getState().pushHistory();
                const nextRotation = (params.rotation + 90) % 360;
                setParam('rotation', nextRotation);
                setOperation('transform', { rotate: nextRotation });
                break;
            }
            case 'flipX': {
                useImageStudioStore.getState().pushHistory();
                const nextFlipX = !params.flipX;
                setParam('flipX', nextFlipX);
                setOperation('transform', { flipX: nextFlipX });
                break;
            }
            case 'flipY': {
                useImageStudioStore.getState().pushHistory();
                const nextFlipY = !params.flipY;
                setParam('flipY', nextFlipY);
                setOperation('transform', { flipY: nextFlipY });
                break;
            }
            case 'deskew':
                useImageStudioStore.getState().pushHistory();
                handleDeskew();
                break;
            case 'bgRemoval':
                useImageStudioStore.getState().pushHistory();
                handleRemoveBackground();
                break;
            case 'upscale':
                useImageStudioStore.getState().pushHistory();
                handleUpscale();
                break;
            case 'resetMask':
                useImageStudioStore.getState().pushHistory();
                setOperation('cleanup', { backgroundRemoved: false });
                setBgRemovalProgress(null);
                setBgRemovalError(null);
                break;

            // EFFECTS:
            case 'grayscale':
            case 'sepia':
            case 'invert': {
                useImageStudioStore.getState().pushHistory();
                const opKey = tool.id as 'grayscale' | 'sepia' | 'invert';
                const nextVal = !operations.effects[opKey];
                setParam(opKey, nextVal ? 1 : 0);
                setOperation('effects', { [opKey]: nextVal });
                break;
            }

            case 'darkMode': {
                useImageStudioStore.getState().pushHistory();
                const nextInvert = !operations.effects.invert;
                setParam('invert', nextInvert ? 1 : 0);
                setOperation('effects', { invert: nextInvert });
                break;
            }

            default:
                // Generic Toggle if mapped
                if (tool.operationKey && tool.type === 'toggle') {
                    useImageStudioStore.getState().pushHistory();
                    const [category, op] = tool.operationKey.split('.');
                    if (category && op) {
                        const opsRecord = operations as unknown as Record<string, Record<string, unknown>>;
                        const currentVal = opsRecord[category]?.[op];
                        const nextVal = !currentVal;
                        if (category === 'transform' || category === 'effects') {
                            if (op in params) setParam(op as keyof ImageEditParams, (nextVal ? 1 : 0) as ImageEditParams[keyof ImageEditParams]);
                        }
                        setOperation(category as keyof typeof operations, { [op]: nextVal } as Partial<typeof operations[keyof typeof operations]>);
                    }
                }
                break;
        }
    };

    // --- Crop Mode Panel ---
    const renderCropPanel = () => {
        const { setCropMode, isCropMode: cropActive } = useImageStudioStore.getState();

        const handleAspectRatioChange = (ratio: number | null) => {
            useImageStudioStore.getState().pushHistory();
            setSelectedAspectRatio(ratio);
            if (ratio && params.crop) {
                // Adjust crop to match aspect ratio, keeping center
                const centerX = params.crop.x + params.crop.width / 2;
                const centerY = params.crop.y + params.crop.height / 2;
                const imgW = dimensions.width || 1000;
                const imgH = dimensions.height || 1000;

                let newW = params.crop.width;
                let newH = newW / ratio;

                if (newH > imgH) {
                    newH = imgH;
                    newW = newH * ratio;
                }
                if (newW > imgW) {
                    newW = imgW;
                    newH = newW / ratio;
                }

                const newX = Math.max(0, Math.min(centerX - newW / 2, imgW - newW));
                const newY = Math.max(0, Math.min(centerY - newH / 2, imgH - newH));

                const newCrop = { x: newX, y: newY, width: newW, height: newH };
                setParam('crop', newCrop);
                useImageStudioStore.getState().setOperation('transform', { crop: newCrop });
            }
        };

        const handleResetCrop = () => {
            useImageStudioStore.getState().pushHistory();
            const imgW = dimensions.width || 1000;
            const imgH = dimensions.height || 1000;
            const fullCrop = { x: 0, y: 0, width: imgW, height: imgH };
            setParam('crop', fullCrop);
            useImageStudioStore.getState().setOperation('transform', { crop: fullCrop });
            setSelectedAspectRatio(null);
        };

        return (
            <div className="space-y-5">
                {/* Crop Mode Indicator */}
                {!cropActive && (
                    <button
                        onClick={() => setCropMode(true)}
                        className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition flex items-center justify-center gap-2"
                    >
                        <CropIcon size={16} />
                        Enter Crop Mode
                    </button>
                )}

                {cropActive && (
                    <>
                        {/* Active Indicator */}
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                                Crop Mode Active
                            </span>
                        </div>

                        {/* Smart Suggest */}
                        <button
                            onClick={() => { useImageStudioStore.getState().pushHistory(); handleSmartCrop(); }}
                            disabled={isSmartCropping}
                            className={clsx(
                                "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all text-xs font-bold",
                                isSmartCropping
                                    ? "opacity-50 cursor-not-allowed bg-zinc-800/30 border-white/5 text-zinc-400"
                                    : "bg-zinc-800/30 border-white/5 text-zinc-300 hover:bg-zinc-800 hover:text-white hover:border-white/10"
                            )}
                        >
                            {isSmartCropping ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <Scan size={14} />
                            )}
                            {isSmartCropping ? 'Analyzing...' : 'Smart Suggest'}
                        </button>

                        {/* Shape Selection */}
                        <div className="flex items-center justify-center gap-3 py-2 border-b border-white/5">
                            <ShapeButton
                                icon={Square}
                                label="Rect"
                                active={!params.cropShape || params.cropShape === 'rect'}
                                onClick={() => { useImageStudioStore.getState().pushHistory(); setParam('cropShape', 'rect'); }}
                            />
                            <ShapeButton
                                icon={Circle}
                                label="Circle"
                                active={params.cropShape === 'circle'}
                                onClick={() => { useImageStudioStore.getState().pushHistory(); setParam('cropShape', 'circle'); }}
                            />
                            <ShapeButton
                                icon={Heart}
                                label="Heart"
                                active={params.cropShape === 'heart'}
                                onClick={() => { useImageStudioStore.getState().pushHistory(); setParam('cropShape', 'heart'); }}
                            />
                        </div>

                        {/* Aspect Ratio */}
                        <div className="space-y-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                                Aspect Ratio
                            </span>
                            <div className="grid grid-cols-3 gap-1.5">
                                {ASPECT_RATIOS.map((ar) => (
                                    <button
                                        key={ar.label}
                                        onClick={() => handleAspectRatioChange(ar.value)}
                                        className={clsx(
                                            "py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all",
                                            selectedAspectRatio === ar.value
                                                ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                                                : "bg-zinc-800/30 border-white/5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                                        )}
                                    >
                                        {ar.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Crop Info */}
                        {params.crop && (
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <div className="px-2 py-1.5 rounded bg-zinc-800/50 border border-white/5">
                                    <span className="text-zinc-500">X:</span>{' '}
                                    <span className="text-zinc-300 font-mono">{Math.round(params.crop.x)}</span>
                                </div>
                                <div className="px-2 py-1.5 rounded bg-zinc-800/50 border border-white/5">
                                    <span className="text-zinc-500">Y:</span>{' '}
                                    <span className="text-zinc-300 font-mono">{Math.round(params.crop.y)}</span>
                                </div>
                                <div className="px-2 py-1.5 rounded bg-zinc-800/50 border border-white/5">
                                    <span className="text-zinc-500">W:</span>{' '}
                                    <span className="text-zinc-300 font-mono">{Math.round(params.crop.width)}</span>
                                </div>
                                <div className="px-2 py-1.5 rounded bg-zinc-800/50 border border-white/5">
                                    <span className="text-zinc-500">H:</span>{' '}
                                    <span className="text-zinc-300 font-mono">{Math.round(params.crop.height)}</span>
                                </div>
                            </div>
                        )}

                        {/* Reset */}
                        <button
                            onClick={handleResetCrop}
                            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-white/5 bg-zinc-800/30 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all text-[10px] font-bold uppercase tracking-wider"
                        >
                            <RefreshCw size={12} />
                            Reset Crop
                        </button>

                        {/* Apply / Cancel - Restored */}
                        <div className="flex gap-2 pt-2 border-t border-white/5">
                            <button
                                onClick={useImageStudioStore.getState().cancelCrop}
                                className="flex-1 py-2 rounded-xl bg-zinc-800 text-zinc-300 font-medium text-xs hover:bg-zinc-700 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={useImageStudioStore.getState().applyCrop}
                                className="flex-1 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition flex items-center justify-center gap-1.5"
                            >
                                <Check size={12} />
                                Apply
                            </button>
                        </div>


                    </>
                )}
            </div>
        );
    };

    const renderTabContent = () => {
        // Crop has its own panel
        if (activeTab === 'crop') {
            return renderCropPanel();
        }

        const tools = IMAGE_TOOLS.filter(t => t.category === activeTab);
        const { operations } = useImageStudioStore.getState();

        return (
            <div className="space-y-6">
                {/* Sliders Section */}
                {tools.some(t => t.type === 'slider') && (
                    <div className="space-y-4">
                        {tools.filter(t => t.type === 'slider').map(tool => {
                            const config = tool.sliderConfig || { min: 0, max: 100, step: 1 };
                            const paramKey = tool.operationKey?.split('.')[1] as keyof ImageEditParams;
                            const value = (params[paramKey] as number) || 0;

                            return (
                                <FilterSlider
                                    key={tool.id}
                                    label={tool.label}
                                    icon={<tool.icon size={12} />}
                                    value={value}
                                    min={config.min}
                                    max={config.max}
                                    step={config.step}
                                    onChange={(v) => handleToolAction(tool, v)}
                                    onPointerDown={() => useImageStudioStore.getState().pushHistory()}
                                    disabled={tool.disabledIf?.(
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        operations as unknown as Record<string, any>,
                                        {
                                            isSmartCropping, isDeskewing, isUpscaling, isBgProcessing,
                                        }
                                    )}
                                />
                            );
                        })}
                    </div>
                )}

                {/* Buttons Grid */}
                {tools.some(t => t.type !== 'slider') && (
                    <div className="grid grid-cols-2 gap-3">
                        {tools.filter(t => t.type !== 'slider').map(tool => {
                            const isActive = (() => {
                                if (tool.type !== 'toggle') return false;
                                if (tool.operationKey) {
                                    const [cat, op] = tool.operationKey.split('.');
                                    return (operations as unknown as Record<string, Record<string, unknown>>)[cat]?.[op];
                                }
                                return false;
                            })();

                            const isDisabled = tool.disabledIf?.(
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                operations as unknown as Record<string, any>,
                                {
                                    isSmartCropping, isDeskewing, isUpscaling, isBgProcessing,
                                }
                            );

                            // Specific Loading State logic
                            let isLoading = false;
                            let loadingText = '';
                            if (tool.id === 'bgRemoval' && isBgProcessing) { isLoading = true; loadingText = 'Unmasking...'; }
                            if (tool.id === 'deskew' && isDeskewing) { isLoading = true; loadingText = 'Aligning...'; }
                            if (tool.id === 'upscale' && isUpscaling) { isLoading = true; loadingText = 'Upscaling...'; }

                            // Upscale "2x Applied" badge
                            const isUpscaleApplied = tool.id === 'upscale' && operations.enhance.upscale && !isUpscaling;
                            const isBgRemoved = tool.id === 'bgRemoval' && operations.cleanup.backgroundRemoved && !isBgProcessing;

                            // Special case for bgRemoval progress
                            if (tool.id === 'bgRemoval' && isBgProcessing && bgRemovalProgress) {
                                return (
                                    <div key={tool.id} className="col-span-2 p-3 rounded-xl bg-zinc-800/50 border border-white/5 space-y-2">
                                        <div className="flex items-center justify-between text-[10px] text-zinc-400">
                                            <span>{bgRemovalProgress.stage}</span>
                                            <span>{Math.round(bgRemovalProgress.percent)}%</span>
                                        </div>
                                        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${bgRemovalProgress.percent}%` }} />
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <button
                                    key={tool.id}
                                    onClick={() => handleToolAction(tool)}
                                    disabled={isDisabled || isLoading || isUpscaleApplied || isBgRemoved}
                                    className={clsx(
                                        "flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all h-20 relative group",
                                        isActive
                                            ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                                            : (isUpscaleApplied || isBgRemoved)
                                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                                : "bg-zinc-800/30 border-white/5 text-zinc-400 hover:bg-zinc-800 hover:text-white hover:border-white/10",
                                        (isDisabled || isLoading || isUpscaleApplied || isBgRemoved) && "opacity-60 cursor-not-allowed"
                                    )}
                                >
                                    {isLoading ? <Loader2 size={20} className="animate-spin" /> : <tool.icon size={20} className={isActive ? "text-blue-400" : (isUpscaleApplied || isBgRemoved) ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-300"} />}
                                    <span className="text-[10px] font-bold uppercase leading-tight text-center">
                                        {isLoading ? loadingText : tool.label}
                                    </span>
                                    {/* Upscale/BG Applied Badge */}
                                    {(isUpscaleApplied || isBgRemoved) && (
                                        <span className="absolute top-1 right-1 text-[8px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                                            Applied
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Empty State for category if no tools */}
                {tools.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-zinc-500">
                        <span className="text-xs">No tools available</span>
                    </div>
                )}
            </div>
        );
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
                <div className="w-[360px] flex flex-col bg-[#18181b] border-l border-white/5">

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

                    {/* Tabs + Content Area */}
                    <div className="flex-1 flex min-h-0">
                        {/* Vertical Tab Rail */}
                        <div className="w-[58px] flex flex-col items-center py-2 gap-0.5 bg-[#111113] border-r border-white/5 shrink-0">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        if (tab.id === 'crop') {
                                            useImageStudioStore.getState().setCropMode(true);
                                        } else {
                                            // If leaving crop mode via tab click, cancel crop
                                            if (isCropMode) {
                                                useImageStudioStore.getState().cancelCrop();
                                            }
                                            setActiveTab(tab.id as Tab);
                                        }
                                    }}
                                    disabled={isCropMode && tab.id !== 'crop'}
                                    className={clsx(
                                        "group relative w-[50px] flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg transition-all duration-200",
                                        activeTab === tab.id
                                            ? "bg-white/[0.08] text-white"
                                            : isCropMode && tab.id !== 'crop'
                                                ? "text-zinc-700 cursor-not-allowed"
                                                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                                    )}
                                >
                                    {/* Active indicator bar */}
                                    {activeTab === tab.id && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-blue-500" />
                                    )}
                                    <tab.icon size={16} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                                    <span className={clsx(
                                        "text-[8px] font-bold uppercase tracking-wider leading-none",
                                        activeTab === tab.id ? "text-blue-400" : "text-zinc-600"
                                    )}>
                                        {tab.label}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 overflow-y-auto p-4 min-w-0">
                            {renderTabContent()}
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-white/5 bg-[#0f0f10] space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            {/* History Controls */}
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={useImageStudioStore.getState().undo}
                                    disabled={!useImageStudioStore.getState().canUndo()}
                                    className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    title="Undo"
                                >
                                    <RotateCcw size={14} className={!useImageStudioStore.getState().canUndo() ? '' : '-scale-x-100'} />
                                </button>
                                <button
                                    onClick={useImageStudioStore.getState().redo}
                                    disabled={!useImageStudioStore.getState().canRedo()}
                                    className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    title="Redo"
                                >
                                    <RotateCw size={14} />
                                </button>
                            </div>

                            <button
                                onClick={resetParams}
                                className="px-3 py-2 flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-wider hover:bg-white/5 rounded-lg border border-transparent hover:border-white/5"
                            >
                                <Sparkles size={12} />
                                <span>Reset</span>
                            </button>
                        </div>

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
