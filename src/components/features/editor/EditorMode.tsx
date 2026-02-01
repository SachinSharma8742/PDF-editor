import React, { useEffect } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { EditorTopBar } from './EditorTopBar';
import { EditorToolbar } from './EditorToolbar';
import { EditorLeftPanel } from './EditorLeftPanel';
import { EditorRightPanel } from './EditorRightPanel';
import { EditorCanvas } from './EditorCanvas';

export const EditorMode: React.FC = () => {
    const {
        isActive,
        activeTool,
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

            const toolMap: Record<string, any> = {
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

            // Tool switching (only if no modifier keys are pressed)
            if (!isMeta && !e.altKey && toolMap[key]) {
                useEditorStore.getState().setActiveTool(toolMap[key]);
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

    return (
        <div className="h-screen w-screen flex flex-col bg-zinc-950 text-white overflow-hidden select-none">
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
