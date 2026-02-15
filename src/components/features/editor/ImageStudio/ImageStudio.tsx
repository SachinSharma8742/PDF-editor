import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useEditorStore } from '../../../../store/editorStore';
import { usePDFStore } from '../../../../store/pdfStore';
import { StudioCanvas } from './StudioCanvas';
import { useImageStudioStore, type ImageEditParams } from './useImageStudioStore';
import { removeBackground, refineMask } from '../../../../utils/backgroundRemoval';
import { smartCrop } from '../../../../utils/smartCrop';
import { deskew } from '../../../../utils/deskew';
import { backgroundCleanup } from '../../../../utils/backgroundCleanup';
import { colorEnhance } from '../../../../utils/colorEnhance';
import { detectSubject } from '../../../../utils/subjectDetection';
import { upscaleImage } from '../../../../utils/imageUpscale';
import { autoCleanupDocument } from '../../../../utils/documentCleanup';
import { detectLayout } from '../../../../utils/layoutDetection';
import { detectOCRRegions } from '../../../../utils/ocrRegionAssist';
import { segmentPage } from '../../../../utils/pageSegmentation';
import type { StudioRegion } from './StudioCanvas';
import {
    X, Image as ImageIcon, Check, RotateCcw,
    Sun, Contrast, Droplet, MoveHorizontal, MoveVertical,
    Ghost, RotateCw, Wand2, Sliders, Crop, Maximize, Square, Sparkles, RefreshCw, Heart,
    Eraser, Loader2, Scan, AlignVerticalSpaceAround, Focus, ArrowUpCircle, FileText, LayoutTemplate,
    TextSelect, Rows // Icons for new tools
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

type Tab = 'adjust' | 'transform' | 'crop' | 'effects' | 'background';

export const ImageStudio: React.FC = () => {
    const { imageStudio, closeImageStudio, updateObject, addObject, saveToHistory } = useEditorStore();
    const { setAllParams, resetParams, params, setParam, activeTab, setActiveTab, dimensions } = useImageStudioStore();

    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });

    // Background removal state
    const [bgRemovalProgress, setBgRemovalProgress] = useState<{ stage: string; percent: number } | null>(null);
    const [bgRemovalError, setBgRemovalError] = useState<string | null>(null);
    const [isBgProcessing, setIsBgProcessing] = useState(false);

    // Image preprocessing state
    const [isSmartCropping, setIsSmartCropping] = useState(false);
    const [isDeskewing, setIsDeskewing] = useState(false);
    const [isCleaning, setIsCleaning] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isDetecting, setIsDetecting] = useState(false);
    const [isUpscaling, setIsUpscaling] = useState(false);
    const [isDocCleaning, setIsDocCleaning] = useState(false);
    const [isLayoutScanning, setIsLayoutScanning] = useState(false);
    const [isOCRScanning, setIsOCRScanning] = useState(false);
    const [isPageSegmenting, setIsPageSegmenting] = useState(false);

    // Unified analysis state
    const [analysisRegions, setAnalysisRegions] = useState<StudioRegion[]>([]);
    const [preprocessError, setPreprocessError] = useState<string | null>(null);

    useEffect(() => {
        if (imageStudio.isOpen) {
            if (imageStudio.initialEditParams) {
                setAllParams(imageStudio.initialEditParams as unknown as ImageEditParams);
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

    // Background removal handlers (must be before early return for hooks rules)
    const handleRemoveBackground = useCallback(async () => {
        if (!imageStudio.initialImageSrc || isBgProcessing) return;

        setIsBgProcessing(true);
        setBgRemovalError(null);
        setBgRemovalProgress({ stage: 'Initializing...', percent: 0 });

        try {
            const { maskedSrc, rawMaskDataUrl } = await removeBackground(
                imageStudio.initialImageSrc,
                (stage, percent) => setBgRemovalProgress({ stage, percent })
            );

            setParam('backgroundMaskSrc', maskedSrc);
            setParam('rawMaskDataUrl', rawMaskDataUrl);
            setBgRemovalProgress({ stage: 'Complete!', percent: 100 });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Background removal failed';
            setBgRemovalError(message);
            // Restore original on error
            setParam('backgroundMaskSrc', null);
            setParam('rawMaskDataUrl', null);
        } finally {
            setIsBgProcessing(false);
        }
    }, [imageStudio.initialImageSrc, isBgProcessing, setParam]);

    const handleMaskRefinement = useCallback(async (feather: number, threshold: number) => {
        if (!imageStudio.initialImageSrc || !params.rawMaskDataUrl) return;

        try {
            const maskedSrc = await refineMask(
                imageStudio.initialImageSrc,
                params.rawMaskDataUrl,
                feather,
                threshold
            );
            setParam('backgroundMaskSrc', maskedSrc);
        } catch (err) {
            console.error('Mask refinement failed:', err);
        }
    }, [imageStudio.initialImageSrc, params.rawMaskDataUrl, setParam]);

    const handleResetMask = useCallback(() => {
        setParam('backgroundMaskSrc', null);
        setParam('rawMaskDataUrl', null);
        setParam('bgRemovalFeather', 0);
        setParam('bgRemovalThreshold', 128);
        setBgRemovalProgress(null);
        setBgRemovalError(null);
    }, [setParam]);

    // Smart Crop handler
    const handleSmartCrop = useCallback(async () => {
        const src = params.backgroundMaskSrc || imageStudio.initialImageSrc;
        if (!src || isSmartCropping) return;

        setIsSmartCropping(true);
        setPreprocessError(null);

        try {
            const croppedSrc = await smartCrop(src);
            if (croppedSrc === src) {
                setPreprocessError('No margins detected — image unchanged.');
            } else {
                setParam('backgroundMaskSrc', croppedSrc);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Smart crop failed';
            setPreprocessError(message);
        } finally {
            setIsSmartCropping(false);
        }
    }, [imageStudio.initialImageSrc, params.backgroundMaskSrc, isSmartCropping, setParam]);

    // Auto Deskew handler
    const handleDeskew = useCallback(async () => {
        const src = params.backgroundMaskSrc || imageStudio.initialImageSrc;
        if (!src || isDeskewing) return;

        setIsDeskewing(true);
        setPreprocessError(null);

        try {
            const correctedSrc = await deskew(src);
            if (correctedSrc === src) {
                setPreprocessError('No skew detected — image unchanged.');
            } else {
                setParam('backgroundMaskSrc', correctedSrc);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Deskew failed';
            setPreprocessError(message);
        } finally {
            setIsDeskewing(false);
        }
    }, [imageStudio.initialImageSrc, params.backgroundMaskSrc, isDeskewing, setParam]);

    // Background Cleanup handler
    const handleCleanup = useCallback(async () => {
        const src = params.backgroundMaskSrc || imageStudio.initialImageSrc;
        if (!src || isCleaning) return;

        setIsCleaning(true);
        setPreprocessError(null);

        try {
            const cleanedSrc = await backgroundCleanup(src);
            setParam('backgroundMaskSrc', cleanedSrc);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Background cleanup failed';
            setPreprocessError(message);
        } finally {
            setIsCleaning(false);
        }
    }, [imageStudio.initialImageSrc, params.backgroundMaskSrc, isCleaning, setParam]);

    // Color Enhancement handler
    const handleEnhance = useCallback(async () => {
        const src = params.backgroundMaskSrc || imageStudio.initialImageSrc;
        if (!src || isEnhancing) return;

        setIsEnhancing(true);
        setPreprocessError(null);

        try {
            const enhancedSrc = await colorEnhance(src);
            setParam('backgroundMaskSrc', enhancedSrc);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Color enhancement failed';
            setPreprocessError(message);
        } finally {
            setIsEnhancing(false);
        }
    }, [imageStudio.initialImageSrc, params.backgroundMaskSrc, isEnhancing, setParam]);

    // Subject Detection handler
    const handleDetectSubject = useCallback(async () => {
        const src = params.backgroundMaskSrc || imageStudio.initialImageSrc;
        if (!src || isDetecting) return;

        setIsDetecting(true);
        setPreprocessError(null);

        try {
            const bounds = await detectSubject(src);
            if (bounds) {
                // Determine crop shape and update params
                setParam('crop', {
                    x: bounds.x,
                    y: bounds.y,
                    width: bounds.width,
                    height: bounds.height
                });
                setActiveTab('crop'); // Switch to crop tab to show result
            } else {
                setPreprocessError('No dominant subject detected.');
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Subject detection failed';
            setPreprocessError(message);
        } finally {
            setIsDetecting(false);
        }
    }, [imageStudio.initialImageSrc, params.backgroundMaskSrc, isDetecting, setParam, setActiveTab]);

    // AI Upscale handler
    const handleUpscale = useCallback(async () => {
        const src = params.backgroundMaskSrc || imageStudio.initialImageSrc;
        if (!src || isUpscaling) return;

        setIsUpscaling(true);
        setPreprocessError(null);

        try {
            const upscaledSrc = await upscaleImage(src);
            setParam('backgroundMaskSrc', upscaledSrc);

            // Update dimensions to match new size
            const img = new Image();
            img.src = upscaledSrc;
            await img.decode();
            useImageStudioStore.getState().setDimensions(img.naturalWidth, img.naturalHeight);

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Upscale failed';
            setPreprocessError(message);
        } finally {
            setIsUpscaling(false);
        }
    }, [imageStudio.initialImageSrc, params.backgroundMaskSrc, isUpscaling, setParam]);

    // Document Cleanup handler
    const handleDocCleanup = useCallback(async () => {
        const src = params.backgroundMaskSrc || imageStudio.initialImageSrc;
        if (!src || isDocCleaning) return;

        setIsDocCleaning(true);
        setPreprocessError(null);

        try {
            const cleanedSrc = await autoCleanupDocument(src);
            setParam('backgroundMaskSrc', cleanedSrc);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Cleanup failed';
            setPreprocessError(message);
        } finally {
            setIsDocCleaning(false);
        }
    }, [imageStudio.initialImageSrc, params.backgroundMaskSrc, isDocCleaning, setParam]);

    // Layout Detection handler
    const handleLayoutDetection = useCallback(async () => {
        const src = params.backgroundMaskSrc || imageStudio.initialImageSrc;
        if (!src || isLayoutScanning) return;

        setIsLayoutScanning(true);
        setPreprocessError(null);
        setAnalysisRegions([]);

        try {
            const regions = await detectLayout(src);
            // Ensure result is StudioRegion[] - detectLayout returns LayoutRegion[] which is compatible
            // but let's be explicit if needed. The types align.
            setAnalysisRegions(regions as StudioRegion[]);
            if (regions.length === 0) {
                setPreprocessError('No layout regions detected.');
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Layout scan failed';
            setPreprocessError(message);
        } finally {
            setIsLayoutScanning(false);
        }
    }, [imageStudio.initialImageSrc, params.backgroundMaskSrc, isLayoutScanning]);

    // OCR Region Assist handler
    const handleOCRRegions = useCallback(async () => {
        const src = params.backgroundMaskSrc || imageStudio.initialImageSrc;
        if (!src || isOCRScanning) return;

        setIsOCRScanning(true);
        setPreprocessError(null);
        setAnalysisRegions([]); // Clear others

        try {
            const regions = await detectOCRRegions(src);
            setAnalysisRegions(regions as StudioRegion[]);
            if (regions.length === 0) setPreprocessError('No text regions detected.');
        } catch (err) {
            setPreprocessError(err instanceof Error ? err.message : 'OCR scan failed');
        } finally {
            setIsOCRScanning(false);
        }
    }, [imageStudio.initialImageSrc, params.backgroundMaskSrc, isOCRScanning]);

    // Page Segmentation handler
    const handlePageSegmentation = useCallback(async () => {
        const src = params.backgroundMaskSrc || imageStudio.initialImageSrc;
        if (!src || isPageSegmenting) return;

        setIsPageSegmenting(true);
        setPreprocessError(null);
        setAnalysisRegions([]);

        try {
            const regions = await segmentPage(src);
            setAnalysisRegions(regions as StudioRegion[]);
            if (regions.length === 0) setPreprocessError('No segments detected.');
        } catch (err) {
            setPreprocessError(err instanceof Error ? err.message : 'Segmentation failed');
        } finally {
            setIsPageSegmenting(false);
        }
    }, [imageStudio.initialImageSrc, params.backgroundMaskSrc, isPageSegmenting]);

    // Clear regions when tab changes or image changes
    useEffect(() => {
        setAnalysisRegions([]);
    }, [activeTab, imageStudio.initialImageSrc]);


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
        // Use masked src if background removal was applied, otherwise original
        const src = params.backgroundMaskSrc || imageStudio.initialImageSrc!;

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

        const newObjectData: Record<string, unknown> = {
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

    const tabs: { id: Tab; icon: React.ElementType; label: string }[] = [
        { id: 'adjust', icon: Sliders, label: 'Adjust' },
        { id: 'transform', icon: RefreshCw, label: 'Flip' },
        { id: 'crop', icon: Crop, label: 'Crop' },
        { id: 'effects', icon: Sparkles, label: 'FX' },
        { id: 'background', icon: Eraser, label: 'BG' },
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

                        {/* Divider */}
                        <div className="border-t border-white/5 pt-3">
                            <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">AI Tools</span>
                        </div>

                        {/* Smart Crop */}
                        <button
                            onClick={handleSmartCrop}
                            disabled={isSmartCropping || isDeskewing || isCleaning || isEnhancing}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                                isSmartCropping
                                    ? "bg-zinc-800 border-white/5 text-zinc-500 cursor-wait"
                                    : "bg-zinc-800/50 hover:bg-zinc-800 border-white/5 hover:border-white/10 text-zinc-400 hover:text-white"
                            )}
                        >
                            {isSmartCropping ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <Scan size={18} />
                            )}
                            <span className="text-xs font-semibold">
                                {isSmartCropping ? 'Analyzing...' : 'Smart Crop'}
                            </span>
                        </button>

                        {/* Auto Deskew */}
                        <button
                            onClick={handleDeskew}
                            disabled={isDeskewing || isSmartCropping || isCleaning || isEnhancing}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                                isDeskewing
                                    ? "bg-zinc-800 border-white/5 text-zinc-500 cursor-wait"
                                    : "bg-zinc-800/50 hover:bg-zinc-800 border-white/5 hover:border-white/10 text-zinc-400 hover:text-white"
                            )}
                        >
                            {isDeskewing ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <AlignVerticalSpaceAround size={18} />
                            )}
                            <span className="text-xs font-semibold">
                                {isDeskewing ? 'Correcting...' : 'Auto Deskew'}
                            </span>
                        </button>

                        {preprocessError && (
                            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                <Wand2 size={14} className="text-amber-400 mt-0.5 shrink-0" />
                                <span className="text-[11px] text-amber-300">{preprocessError}</span>
                            </div>
                        )}

                        {/* Divider */}
                        <div className="border-t border-white/5 pt-3">
                            <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Enhance</span>
                        </div>

                        {/* Cleanup Scan */}
                        <button
                            onClick={handleCleanup}
                            disabled={isCleaning || isEnhancing || isSmartCropping || isDeskewing}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                                isCleaning
                                    ? "bg-zinc-800 border-white/5 text-zinc-500 cursor-wait"
                                    : "bg-zinc-800/50 hover:bg-zinc-800 border-white/5 hover:border-white/10 text-zinc-400 hover:text-white"
                            )}
                        >
                            {isCleaning ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <Eraser size={18} />
                            )}
                            <span className="text-xs font-semibold">
                                {isCleaning ? 'Cleaning...' : 'Cleanup Scan'}
                            </span>
                        </button>

                        {/* Auto Enhance */}
                        <button
                            onClick={handleEnhance}
                            disabled={isEnhancing || isCleaning || isSmartCropping || isDeskewing || isDetecting || isUpscaling}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                                isEnhancing
                                    ? "bg-zinc-800 border-white/5 text-zinc-500 cursor-wait"
                                    : "bg-zinc-800/50 hover:bg-zinc-800 border-white/5 hover:border-white/10 text-zinc-400 hover:text-white"
                            )}
                        >
                            {isEnhancing ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <Sparkles size={18} />
                            )}
                            <span className="text-xs font-semibold">
                                {isEnhancing ? 'Enhancing...' : 'Auto Enhance'}
                            </span>
                        </button>

                        {/* Divider */}
                        <div className="border-t border-white/5 pt-3">
                            <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Advanced ML</span>
                        </div>

                        {/* Detect Subject */}
                        <button
                            onClick={handleDetectSubject}
                            disabled={isDetecting || isUpscaling || isCleaning || isEnhancing || isSmartCropping || isDeskewing}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                                isDetecting
                                    ? "bg-zinc-800 border-white/5 text-zinc-500 cursor-wait"
                                    : "bg-zinc-800/50 hover:bg-zinc-800 border-white/5 hover:border-white/10 text-zinc-400 hover:text-white"
                            )}
                        >
                            {isDetecting ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <Focus size={18} />
                            )}
                            <span className="text-xs font-semibold">
                                {isDetecting ? 'Detecting...' : 'Detect Subject'}
                            </span>
                        </button>

                        {/* AI Upscale */}
                        <button
                            onClick={handleUpscale}
                            disabled={isUpscaling || isDetecting || isCleaning || isEnhancing || isSmartCropping || isDeskewing || isDocCleaning || isLayoutScanning}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                                isUpscaling
                                    ? "bg-zinc-800 border-white/5 text-zinc-500 cursor-wait"
                                    : "bg-zinc-800/50 hover:bg-zinc-800 border-white/5 hover:border-white/10 text-zinc-400 hover:text-white"
                            )}
                        >
                            {isUpscaling ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <ArrowUpCircle size={18} />
                            )}
                            <span className="text-xs font-semibold">
                                {isUpscaling ? 'Upscaling...' : 'AI Upscale (2x)'}
                            </span>
                        </button>

                        {/* Divider */}
                        <div className="border-t border-white/5 pt-3">
                            <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Document Intelligence</span>
                        </div>

                        {/* Auto Cleanup */}
                        <button
                            onClick={handleDocCleanup}
                            disabled={isDocCleaning || isLayoutScanning || isUpscaling || isDetecting || isCleaning || isEnhancing}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                                isDocCleaning
                                    ? "bg-zinc-800 border-white/5 text-zinc-500 cursor-wait"
                                    : "bg-zinc-800/50 hover:bg-zinc-800 border-white/5 hover:border-white/10 text-zinc-400 hover:text-white"
                            )}
                        >
                            {isDocCleaning ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <FileText size={18} />
                            )}
                            <span className="text-xs font-semibold">
                                {isDocCleaning ? 'Cleaning...' : 'Auto Doc Cleanup'}
                            </span>
                        </button>

                        {/* Detect Layout */}
                        <button
                            onClick={handleLayoutDetection}
                            disabled={isLayoutScanning || isDocCleaning || isUpscaling || isDetecting || isCleaning || isOCRScanning || isPageSegmenting}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                                isLayoutScanning
                                    ? "bg-zinc-800 border-white/5 text-zinc-500 cursor-wait"
                                    : analysisRegions.length > 0 && analysisRegions[0].type !== 'ocr' && analysisRegions[0].type !== 'header'
                                        ? "bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20"
                                        : "bg-zinc-800/50 hover:bg-zinc-800 border-white/5 hover:border-white/10 text-zinc-400 hover:text-white"
                            )}
                        >
                            {isLayoutScanning ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <LayoutTemplate size={18} />
                            )}
                            <span className="text-xs font-semibold">
                                {isLayoutScanning ? 'Scanning...' : 'Detect Layout'}
                            </span>
                        </button>

                        {/* OCR Regions */}
                        <button
                            onClick={handleOCRRegions}
                            disabled={isOCRScanning || isLayoutScanning || isDocCleaning || isUpscaling}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                                isOCRScanning
                                    ? "bg-zinc-800 border-white/5 text-zinc-500 cursor-wait"
                                    : analysisRegions.length > 0 && analysisRegions[0].type === 'ocr'
                                        ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20"
                                        : "bg-zinc-800/50 hover:bg-zinc-800 border-white/5 hover:border-white/10 text-zinc-400 hover:text-white"
                            )}
                        >
                            {isOCRScanning ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <TextSelect size={18} />
                            )}
                            <span className="text-xs font-semibold">
                                {isOCRScanning ? 'Scanning...' : 'Detect OCR Regions'}
                            </span>
                        </button>

                        {/* Segment Page */}
                        <button
                            onClick={handlePageSegmentation}
                            disabled={isPageSegmenting || isLayoutScanning || isDocCleaning || isUpscaling}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                                isPageSegmenting
                                    ? "bg-zinc-800 border-white/5 text-zinc-500 cursor-wait"
                                    : analysisRegions.length > 0 && (analysisRegions[0].type === 'header' || analysisRegions[0].type === 'body')
                                        ? "bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20"
                                        : "bg-zinc-800/50 hover:bg-zinc-800 border-white/5 hover:border-white/10 text-zinc-400 hover:text-white"
                            )}
                        >
                            {isPageSegmenting ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <Rows size={18} />
                            )}
                            <span className="text-xs font-semibold">
                                {isPageSegmenting ? 'Segmenting...' : 'Segment Page'}
                            </span>
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
                                onClick={() => setParam(ef.key as keyof typeof params, params[ef.key as keyof typeof params] ? 0 : 1)}
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
            case 'background':
                return (
                    <div className="space-y-4">
                        {/* Remove Background Button */}
                        <button
                            onClick={handleRemoveBackground}
                            disabled={isBgProcessing}
                            className={clsx(
                                "w-full flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all",
                                isBgProcessing
                                    ? "bg-zinc-800 text-zinc-500 cursor-wait"
                                    : params.backgroundMaskSrc
                                        ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                                        : "bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 hover:from-violet-500 hover:to-blue-500"
                            )}
                        >
                            {isBgProcessing ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Processing...
                                </>
                            ) : params.backgroundMaskSrc ? (
                                <>
                                    <Check size={16} />
                                    Background Removed
                                </>
                            ) : (
                                <>
                                    <Eraser size={16} />
                                    Remove Background
                                </>
                            )}
                        </button>

                        {/* Progress Bar */}
                        {bgRemovalProgress && isBgProcessing && (
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-medium text-zinc-400">
                                        {bgRemovalProgress.stage}
                                    </span>
                                    <span className="text-[10px] font-mono text-blue-400">
                                        {bgRemovalProgress.percent}%
                                    </span>
                                </div>
                                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-violet-600 to-blue-500 transition-all duration-300 ease-out rounded-full"
                                        style={{ width: `${bgRemovalProgress.percent}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Error Message */}
                        {bgRemovalError && (
                            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                                <X size={14} className="text-red-400 mt-0.5 shrink-0" />
                                <span className="text-[11px] text-red-300">{bgRemovalError}</span>
                            </div>
                        )}

                        {/* Refinement Sliders (only after mask exists) */}
                        {params.rawMaskDataUrl && (
                            <div className="space-y-4 pt-2 border-t border-white/5">
                                <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Mask Refinement</span>

                                <FilterSlider
                                    label="Feather Edge"
                                    icon={<Ghost size={12} />}
                                    value={params.bgRemovalFeather}
                                    min={0} max={20} step={1}
                                    onChange={(v: number) => {
                                        setParam('bgRemovalFeather', v);
                                        handleMaskRefinement(v, params.bgRemovalThreshold);
                                    }}
                                />
                                <FilterSlider
                                    label="Edge Threshold"
                                    icon={<Contrast size={12} />}
                                    value={params.bgRemovalThreshold}
                                    min={0} max={255} step={1}
                                    onChange={(v: number) => {
                                        setParam('bgRemovalThreshold', v);
                                        handleMaskRefinement(params.bgRemovalFeather, v);
                                    }}
                                />
                            </div>
                        )}

                        {/* Reset Mask */}
                        {params.backgroundMaskSrc && (
                            <button
                                onClick={handleResetMask}
                                className="w-full flex items-center justify-center gap-2 text-zinc-500 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-wider py-2 hover:bg-white/5 rounded-lg border border-white/5"
                            >
                                <RotateCcw size={12} />
                                Reset Mask
                            </button>
                        )}

                        {/* Info */}
                        {!params.backgroundMaskSrc && !isBgProcessing && (
                            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-zinc-800/30 border border-white/5">
                                <Sparkles size={14} className="text-zinc-500 mt-0.5 shrink-0" />
                                <p className="text-[10px] text-zinc-500 leading-relaxed">
                                    AI-powered background removal runs entirely in your browser. No data is sent to any server.
                                </p>
                            </div>
                        )}
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
                                    src={params.backgroundMaskSrc || imageStudio.initialImageSrc}
                                    width={canvasDimensions.width}
                                    height={canvasDimensions.height}
                                    analysisRegions={analysisRegions}
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
                                    onClick={() => setActiveTab(tab.id as Tab)}
                                    className={clsx(
                                        "group relative w-[50px] flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg transition-all duration-200",
                                        activeTab === tab.id
                                            ? "bg-white/[0.08] text-white"
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
