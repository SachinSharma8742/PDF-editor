import React, { useEffect } from 'react';
import { useEditorStore } from '../../../../store/editorStore';
import { StudioCanvas } from './StudioCanvas';
import { StudioToolbar } from './StudioToolbar';
import { useImageStudioStore } from './useImageStudioStore';
import { X } from 'lucide-react';
import { usePDFStore } from '../../../../store/pdfStore';

export const ImageStudio: React.FC = () => {
    const { imageStudio, closeImageStudio, updateObject } = useEditorStore();
    const { addObject, currentPage } = useEditorStore();
    // Wait, updateObject is in editorStore but addObject is also there. Good.

    // We also need access to `pdfStore` for creating IDs or other utils if not passed through editorStore.
    // editorStore wraps basic actions so we should be good.

    const { setAllParams, resetParams, params } = useImageStudioStore();
    const [dimensions, setDimensions] = React.useState({ width: window.innerWidth, height: window.innerHeight - 320 });

    useEffect(() => {
        const handleResize = () => {
            setDimensions({ width: window.innerWidth, height: window.innerHeight - 320 });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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

    if (!imageStudio.isOpen || !imageStudio.initialImageSrc) return null;

    const handleApply = () => {
        const src = imageStudio.initialImageSrc!;

        // Validate src
        if (!src) {
            console.error("No source image found for apply");
            closeImageStudio();
            return;
        }

        const newObjectData = {
            src: src,
            originalSrc: src,

            brightness: params.brightness,
            contrast: params.contrast,
            saturation: params.saturation,
            blurRadius: params.blur,
            noise: params.noise,

            flipX: params.flipX,
            flipY: params.flipY,
            rotation: params.rotation,
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
                console.log("ImageStudio: Image loaded, calculating aspect ratio...");
                const aspect = img.width / img.height;
                const baseW = 300;
                const newId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                try {
                    addObject({
                        id: newId,
                        type: 'image',
                        x: 100,
                        y: 100,
                        width: baseW,
                        height: baseW / aspect,
                        ...newObjectData
                    });
                    console.log("ImageStudio: Object added successfully");
                    closeImageStudio();
                } catch (err) {
                    console.error("ImageStudio: Error adding object:", err);
                }
            };
            img.onerror = (e) => {
                console.error("ImageStudio: Failed to load image for aspect ratio calculation", e);
                const newId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                addObject({
                    id: newId,
                    type: 'image',
                    x: 100,
                    y: 100,
                    width: 300,
                    height: 200,
                    ...newObjectData
                });
                closeImageStudio();
            };
            img.src = src;
        } else if (imageStudio.mode === 'edit' && imageStudio.targetObjectId) {
            console.log("ImageStudio: Updating existing object...");
            updateObject(imageStudio.targetObjectId, newObjectData);
            closeImageStudio();
        } else {
            console.log("ImageStudio: Unknown mode or missing ID, closing.");
            closeImageStudio();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center pointer-events-none">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={closeImageStudio} />

            {/* Modal Content */}
            <div className="bg-[#18181b] w-full sm:w-[90vw] md:w-[800px] sm:rounded-2xl border-t sm:border border-white/10 shadow-2xl overflow-hidden flex flex-col pointer-events-auto h-[85vh] sm:h-[600px] mb-0 sm:mb-4 animate-in slide-in-from-bottom-10 fade-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#18181b]">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                        {imageStudio.mode === 'create' ? 'Add Image' : 'Edit Image'}
                    </h3>
                    <button onClick={closeImageStudio} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Main Stage Area (Preview) */}
                <div className="flex-1 relative bg-[#09090b] flex items-center justify-center overflow-hidden">
                    {/* Background Grid Pattern */}
                    <div className="absolute inset-0 opacity-20"
                        style={{
                            backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
                            backgroundSize: '16px 16px'
                        }}
                    />

                    <StudioCanvas
                        src={imageStudio.initialImageSrc}
                        width={dimensions.width < 800 ? dimensions.width : 760} // Constrain width inside modal
                        height={400} // Fixed height for preview area in modal
                    />
                </div>

                {/* Bottom Toolbar */}
                <StudioToolbar onApply={handleApply} onCancel={closeImageStudio} />
            </div>
        </div>
    );
};
