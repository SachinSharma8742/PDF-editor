import React, { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../../../../store/editorStore';
import { usePDFStore } from '../../../../store/pdfStore';
import { StudioCanvas } from './StudioCanvas';
import { StudioToolbar } from './StudioToolbar';
import { useImageStudioStore } from './useImageStudioStore';
import { X } from 'lucide-react';

export const ImageStudio: React.FC = () => {
    const { imageStudio, closeImageStudio, updateObject, addObject, saveToHistory } = useEditorStore();
    const { setAllParams, resetParams, params } = useImageStudioStore();

    // Use a ref for the container to measure available space for the canvas
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });

    // Initialize store state
    useEffect(() => {
        if (imageStudio.isOpen) {
            if (imageStudio.initialEditParams) {
                setAllParams(imageStudio.initialEditParams);
            } else {
                resetParams();
            }
        }
    }, [imageStudio.isOpen, imageStudio.initialEditParams, setAllParams, resetParams]);

    // Resize Observer to handle dynamic container sizing
    useEffect(() => {
        if (!imageStudio.isOpen || !containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                // Use contentRect for precise inner dimensions
                const { width, height } = entry.contentRect;
                setCanvasDimensions({ width, height });
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [imageStudio.isOpen]);

    if (!imageStudio.isOpen || !imageStudio.initialImageSrc) return null;

    const handleApply = () => {
        saveToHistory();
        const src = imageStudio.initialImageSrc!;

        // Validate src
        if (!src) {
            console.error("No source image found for apply");
            closeImageStudio();
            return;
        }

        const { dimensions } = useImageStudioStore.getState();

        // Calculate new Aspect Ratio
        // Default to current dimensions found in store (or if missing, 1)
        const originalW = dimensions.width || 1;
        const originalH = dimensions.height || 1;

        // Effective Crop Dimensions (Source Image Space)
        const cropW = params.crop ? params.crop.width : originalW;
        const cropH = params.crop ? params.crop.height : originalH;

        const newObjectData: any = {
            src: src,
            originalSrc: src, // Ensure we keep track of original for re-editing

            brightness: params.brightness,
            contrast: params.contrast,
            saturation: params.saturation,
            blurRadius: params.blur,
            noise: params.noise,

            flipX: params.flipX,
            flipY: params.flipY,
            rotation: params.rotation, // Editor handles rotation property.

            crop: params.crop || undefined,

            editParams: {
                ...params,
                crop: params.crop || undefined
            }
        };

        if (imageStudio.mode === 'create') {
            console.log("ImageStudio: Creating new image object...");
            const img = new Image();
            img.onload = () => {
                // For new images, we prefer a default width like 300px.
                const baseW = 300;
                // Scale is derived from the new crop dimensions.
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
            // Find existing object
            // Priority: Check EditorStore (active editing session) first, then PDFStore.
            const editorState = useEditorStore.getState();
            const pdfState = usePDFStore.getState();

            let targetObject;

            // 1. Check EditorStore current page
            if (editorState.currentPage) {
                targetObject = editorState.currentPage.objects.find(o => o.id === imageStudio.targetObjectId);
            }

            // 2. Fallback to PDFStore if not found (e.g. editor not fully active or cross-page)
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
                // Logic to match "Basic Crop" behavior (preserve pixel scale/zoom):
                // 1. Calculate current Scale (Stage Pixels / Source Pixels)
                // Use fallback if width is missing (should verify exists above)
                const safeWidth = targetObject.width || 0;
                const currentSourceW = targetObject.crop ? targetObject.crop.width : originalW;

                // How many screen pixels per source pixel?
                const scaleX = currentSourceW !== 0 ? safeWidth / currentSourceW : 1;

                // 2. Apply this scale to the NEW crop dimensions.
                const newWidth = cropW * scaleX;
                const newHeight = cropH * scaleX;

                newObjectData.width = newWidth;
                newObjectData.height = newHeight;

                console.log("ImageStudio: Resizing object", {
                    oldW: targetObject.width,
                    newW: newWidth,
                    cropW,
                    scaleX
                });

            } else {
                console.warn("ImageStudio: Target object not found", imageStudio.targetObjectId);
            }

            updateObject(imageStudio.targetObjectId, newObjectData);
            closeImageStudio();
        } else {
            closeImageStudio();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 fade-in duration-200">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeImageStudio} />

            {/* Modal Content */}
            <div className="relative bg-[#18181b] w-full max-w-5xl h-[85vh] max-h-[900px] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-[#18181b] shrink-0">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        {imageStudio.mode === 'create' ? 'Add Image' : 'Edit Image'}
                    </h3>
                    <button
                        onClick={closeImageStudio}
                        className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Main Stage Area (Preview) */}
                <div className="flex-1 relative bg-[#09090b] overflow-hidden min-h-0">
                    {/* Background Grid Pattern */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none"
                        style={{
                            backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
                            backgroundSize: '16px 16px'
                        }}
                    />

                    {/* Canvas Container - The observer watches this div */}
                    <div ref={containerRef} className="absolute inset-0 flex items-center justify-center">
                        {canvasDimensions.width > 0 && canvasDimensions.height > 0 && (
                            <StudioCanvas
                                src={imageStudio.initialImageSrc}
                                width={canvasDimensions.width}
                                height={canvasDimensions.height}
                            />
                        )}
                    </div>
                </div>

                {/* Bottom Toolbar */}
                <StudioToolbar onApply={handleApply} onCancel={closeImageStudio} />
            </div>
        </div>
    );
};
