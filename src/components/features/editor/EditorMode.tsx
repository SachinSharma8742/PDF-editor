import React, { useEffect } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { EditorTopBar } from './EditorTopBar';
import { EditorToolbar } from './EditorToolbar';
import { EditorRightPanel } from './EditorRightPanel';
import { EditorCanvas } from './EditorCanvas';

export const EditorMode: React.FC = () => {
    const { isActive } = useEditorStore();

    // Prevent body scroll when editor is active
    useEffect(() => {
        if (isActive) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isActive]);

    if (!isActive) return null;

    return (
        <div className="fixed inset-0 z-[100] flex flex-col animate-in fade-in duration-200">
            <div className="flex flex-col flex-1 w-full h-full bg-gray-100 dark:bg-zinc-950 text-gray-900 dark:text-gray-200">
                {/* Top Bar */}
                <EditorTopBar />

                <div className="flex flex-1 overflow-hidden">
                    {/* Left Toolbar */}
                    <EditorToolbar />

                    {/* Main Workspace (Centered Canvas) */}
                    <div className="flex-1 overflow-auto bg-gray-200/50 dark:bg-zinc-900/50 flex flex-col items-center justify-center p-8 relative" id="editor-workspace">
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
