import React, { useEffect, useState } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { EditorTopBar } from './EditorTopBar';
import { EditorToolbar } from './EditorToolbar';
import { EditorLeftPanel } from './EditorLeftPanel';
import { EditorRightPanel } from './EditorRightPanel';
import { EditorCanvas } from './EditorCanvas';
import { usePDFStore, type ToolType } from '../../../store/pdfStore';
import { loadPDF } from '../../../utils/pdfOps';
import { ImageStudio } from './ImageStudio/ImageStudio';
import { TextStudio } from './TextStudio/TextStudio';
import { ShapeEditorModal } from './ShapeEditorModal';
import { useKeyboardShortcuts } from '../../../hooks/useKeyboardShortcuts';
import { MobileToolbar } from './MobileToolbar';
import { MobilePropertiesPanel } from './MobilePropertiesPanel';

export const EditorMode: React.FC = () => {
    const {
        selectedObjectIds,
        setActiveTool,
        setScale,
        scale
    } = useEditorStore();

    const [isMobilePropertiesOpen, setIsMobilePropertiesOpen] = useState(false);

    // Use centralized hook for shortcuts
    useKeyboardShortcuts();

    // Set default tool to pan on mobile
    useEffect(() => {
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
            setActiveTool('pan');
        }
        // Ensure scale is positive (fix for negative scale display)
        if (scale < 0.1) {
            setScale(1);
        }
    }, []);

    // Legacy/Duplicate listeners removed in favor of useKeyboardShortcuts
    // The previous useEffect block is deleted.

    // Prevent body scroll when editor is active
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'auto'; };
    }, []);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;

        const file = files[0];

        if (file.type === 'application/pdf') {
            if (confirm('Open this PDF? Unsaved changes will be lost.')) {
                const buffer = await file.arrayBuffer();
                const doc = await loadPDF(buffer);
                usePDFStore.getState().setPdfDocument(doc, buffer, file.name);
            }
        } else if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const src = event.target?.result as string;
                if (src) {
                    useEditorStore.getState().openImageStudio(src);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div
            className="h-screen w-screen flex flex-col bg-zinc-950 text-white overflow-hidden select-none"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Unified Header */}
            <EditorTopBar />

            {/* Main Content Area - Desktop */}
            <div className="flex-1 flex overflow-hidden relative">

                {/* Slim Navigation Sidebar - Desktop Only */}
                <EditorToolbar />

                {/* Left Resource Panel (Stamps, OCR, etc) - Desktop Only */}
                <EditorLeftPanel />

                {/* Primary Canvas Container - Full remaining width */}
                <main id="editor-workspace" className="flex-1 relative overflow-auto bg-[#09090b] shadow-inner flex items-center justify-center touch-none">
                    <EditorCanvas />
                </main>

                {/* Unified Inspector Sidebar (Properties + Layers) - Desktop Only */}
                <EditorRightPanel />
            </div>

            {/* Mobile Bottom Toolbar - Mobile Only */}
            <MobileToolbar onPropertiesClick={() => setIsMobilePropertiesOpen(!isMobilePropertiesOpen)} />

            {/* Mobile Properties Panel - Mobile Only */}
            <MobilePropertiesPanel
                isOpen={isMobilePropertiesOpen}
                onClose={() => setIsMobilePropertiesOpen(false)}
            />

            {/* Image Studio Overlay */}
            <ImageStudio />
            <TextStudio />
            {/* NativeTextStudio moved to App.tsx level */}
            <ShapeEditorModal />
        </div>
    );
};
