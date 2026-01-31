import React, { useEffect } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { EditorTopBar } from './EditorTopBar';
import { EditorToolbar } from './EditorToolbar';
import { EditorRightPanel } from './EditorRightPanel';
import { EditorCanvas } from './EditorCanvas';

export const EditorMode: React.FC = () => {
    const {
        isActive,
        activeTool,
        setActiveTool,
        undo,
        redo,
        deleteObjects,
        selectedObjectIds
    } = useEditorStore();

    // Prevent body scroll when editor is active
    useEffect(() => {
        if (isActive) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isActive]);

    // Keyboard Shortcuts
    useEffect(() => {
        if (!isActive) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input or textarea
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            const isMod = e.metaKey || e.ctrlKey;
            const key = e.key.toLowerCase();

            // Undo/Redo
            if (isMod && key === 'z') {
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
                e.preventDefault();
                return;
            }
            if (isMod && key === 'y') {
                redo();
                e.preventDefault();
                return;
            }

            // Delete
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedObjectIds.length > 0) {
                    deleteObjects(selectedObjectIds);
                    e.preventDefault();
                }
                return;
            }

            // Tools (only if no modifier is pressed)
            if (!isMod) {
                switch (key) {
                    case 'v': setActiveTool('select'); break;
                    case 'h': setActiveTool('pan'); break;
                    case 'p': setActiveTool('pen'); break;
                    case 'm': setActiveTool('highlighter'); break;
                    case 'e': setActiveTool('eraser'); break;
                    case 'r': setActiveTool('rectangle'); break;
                    case 'o': setActiveTool('circle'); break;
                    case 't': setActiveTool('text'); break;
                    case 'i':
                        // For Image, we need to trigger the file input. 
                        // We can use a custom event or just setActiveTool and let Toolbar handle it?
                        // Actually, Toolbar handles clicks. Let's just emulate a click or use a custom tool type 'image_request'
                        // Or just setActiveTool('image') and trust the toolbar (but toolbar only triggers on click).
                        // Let's add a centralized image upload trigger or just find the input and click it.
                        document.querySelector<HTMLInputElement>('input[type="file"][accept="image/*"]')?.click();
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isActive, selectedObjectIds, setActiveTool, undo, redo, deleteObjects]);

    if (!isActive) return null;

    return (
        <div className="fixed inset-0 z-[100] flex flex-col animate-in fade-in duration-200">
            <div className="flex flex-col flex-1 w-full h-full bg-gray-100 dark:bg-zinc-950 text-gray-900 dark:text-gray-200">
                {/* Top Bar */}
                <EditorTopBar />

                <div className="flex flex-1 overflow-hidden min-w-0">
                    {/* Left Toolbar */}
                    <EditorToolbar />

                    {/* Main Workspace (Centered Canvas) */}
                    <div className="flex-1 min-w-0 overflow-auto bg-gray-200/50 dark:bg-zinc-900/50 flex flex-col items-center justify-center p-8 relative" id="editor-workspace">
                        {/* 
                            We use a wrapper to ensure centering. 
                            EditorCanvas handles its own dimensions.
                        */}
                        <div className="shadow-2xl">
                            <EditorCanvas />
                        </div>
                    </div>

                    {/* Right Panel (Properties + Layers) */}
                    <EditorRightPanel />
                </div>
            </div>
        </div>
    );
};
