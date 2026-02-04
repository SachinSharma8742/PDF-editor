import React, { useEffect } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { EditorTopBar } from './EditorTopBar';
import { EditorToolbar } from './EditorToolbar';
import { EditorLeftPanel } from './EditorLeftPanel';
import { EditorRightPanel } from './EditorRightPanel';
import { EditorCanvas } from './EditorCanvas';
import { usePDFStore, type ToolType } from '../../../store/pdfStore';
import { loadPDF } from '../../../utils/pdfOps';

export const EditorMode: React.FC = () => {
    const {
        selectedObjectIds
    } = useEditorStore();

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if user is typing in an input or textarea
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

            const key = e.key.toLowerCase();
            const isMeta = e.metaKey || e.ctrlKey;

            // Undo: Ctrl/Cmd + Z
            if (isMeta && key === 'z' && !e.shiftKey) {
                e.preventDefault();
                useEditorStore.getState().undo();
                return;
            }

            // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
            if ((isMeta && key === 'z' && e.shiftKey) || (isMeta && key === 'y')) {
                e.preventDefault();
                useEditorStore.getState().redo();
                return;
            }

            const toolMap: Record<string, string> = {
                'v': 'select',
                'h': 'pan',
                'p': 'pen',
                'm': 'highlighter',
                'e': 'eraser',
                'k': 'measure',
                'r': 'rectangle',
                'o': 'circle',
                't': 'text',
                'x': 'stamp',
            };

            if (!isMeta && !e.altKey && toolMap[key]) {
                useEditorStore.getState().setActiveTool(toolMap[key] as ToolType);
                return;
            }

            // Deletion
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObjectIds.length > 0) {
                e.preventDefault();
                useEditorStore.getState().deleteObjects(selectedObjectIds);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedObjectIds]);

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
                    useEditorStore.getState().addObject({
                        id: crypto.randomUUID(),
                        type: 'image',
                        x: 100, // Default position
                        y: 100,
                        width: 200,
                        height: 200,
                        src: src
                    });
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
                <main className="flex-1 relative overflow-auto bg-[#09090b] shadow-inner flex items-center justify-center">
                    <EditorCanvas />
                </main>

                {/* Unified Inspector Sidebar (Properties + Layers) */}
                <EditorRightPanel />

            </div>
        </div>
    );
};
