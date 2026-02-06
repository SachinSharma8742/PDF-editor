import React from 'react';
import { useEditorStore } from '../../../../store/editorStore';
import { X, Save, Undo2, Redo2, Type } from 'lucide-react';
import { SinglePageCanvas } from './SinglePageCanvas';
import { NativeTextProperties } from '../NativeTextProperties';

export const NativeTextStudio: React.FC = () => {
    const { nativeTextStudio, closeNativeTextStudio, pendingNativeTextEdits } = useEditorStore();

    if (!nativeTextStudio.isOpen || !nativeTextStudio.pageId) return null;

    const handleSave = () => {
        // Here we would trigger the actual save/apply logic
        // For now, checks "Walkthrough" verifying visual feedback
        // Just closing acts as "Keeping edits in memory"
        closeNativeTextStudio();
    };

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-[#18181b] animate-in slide-in-from-bottom-5 duration-300">
            {/* Top Bar */}
            <div className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-[#18181b] shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                        <Type size={20} />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider">PDF Text Studio</h2>
                        <p className="text-[10px] text-zinc-500">Edit native text content</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                        <Undo2 size={18} />
                    </button>
                    <button className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                        <Redo2 size={18} />
                    </button>
                    <div className="w-[1px] h-6 bg-white/10 mx-2" />
                    <button
                        onClick={handleSave}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Save size={14} />
                        Save & Close
                    </button>
                    <button
                        onClick={closeNativeTextStudio}
                        className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Main Workspace */}
            <div className="flex-1 flex overflow-hidden">

                {/* Left Properties Panel */}
                <div className="w-80 border-r border-white/10 bg-[#1e1e20] p-4 overflow-y-auto">
                    <NativeTextProperties />
                </div>

                {/* Canvas Area */}
                <div className="flex-1 overflow-hidden bg-[#09090b] relative">
                    {/* Dot Grid Background */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none"
                        style={{
                            backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
                            backgroundSize: '20px 20px'
                        }}
                    />

                    <SinglePageCanvas pageId={nativeTextStudio.pageId} />
                </div>

            </div>
        </div>
    );
};
