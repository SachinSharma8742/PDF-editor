import React, { useEffect } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { EditorTopBar } from './EditorTopBar';
import { EditorToolbar } from './EditorToolbar';
import { EditorLeftPanel } from './EditorLeftPanel';
import { EditorRightPanel } from './EditorRightPanel';
import { EditorCanvas } from './EditorCanvas';
import { usePDFStore, type ToolType } from '../../../store/pdfStore';
import { loadPDF } from '../../../utils/pdfOps';
import { ImageStudio } from './ImageStudio/ImageStudio';
import { ShapeEditorModal } from './ShapeEditorModal';
import { useKeyboardShortcuts } from '../../../hooks/useKeyboardShortcuts';

export const EditorMode: React.FC = () => {
    const {
        selectedObjectIds
    } = useEditorStore();

    // Use centralized hook for shortcuts
    useKeyboardShortcuts();

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

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden relative">

                {/* Slim Navigation Sidebar */}
                <EditorToolbar />

                {/* Left Resource Panel (Stamps, OCR, etc) */}
                <EditorLeftPanel />

                {/* Primary Canvas Container - Full remaining width */}
                <main id="editor-workspace" className="flex-1 relative overflow-auto bg-[#09090b] shadow-inner flex items-center justify-center">
                    <EditorCanvas />
                </main>

                {/* Unified Inspector Sidebar (Properties + Layers) */}
                <EditorRightPanel />

            </div>

            {/* Image Studio Overlay */}
            <ImageStudio />
            <ShapeEditorModal />
        </div>
    );
};
