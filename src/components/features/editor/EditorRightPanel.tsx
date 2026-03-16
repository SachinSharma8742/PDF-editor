import React, { useState, useEffect } from 'react';
import { Settings2, Layers } from 'lucide-react';
import { EditorProperties } from './EditorProperties';
import { LayerPanel } from './LayerPanel';

import { useEditorStore } from '../../../store/editorStore';
import clsx from 'clsx';

// Custom hook to detect mobile viewport
const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return isMobile;
};

type Tab = 'properties' | 'layers' | 'export';

export const EditorRightPanel: React.FC = () => {
    const isMobile = useIsMobile();
    const { activePanelTab, setActivePanelTab } = useEditorStore();

    // Completely unmount on mobile
    if (isMobile) return null;

    // Mapping for tabs
    const tabs = [
        { id: 'properties', icon: Settings2, label: 'Settings' },
        { id: 'layers', icon: Layers, label: 'Layers' },
    ];

    return (
        <div className="w-80 bg-zinc-50 dark:bg-[#1e1e20] border-l border-zinc-200 dark:border-white/5 flex flex-col h-full z-40 shadow-2xl flex-shrink-0 transition-colors duration-200 font-sans">
            {/* Contextual Tab Header */}
            <div className="flex bg-zinc-100 dark:bg-[#18181b] p-1 gap-1 border-b border-zinc-200 dark:border-white/5">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setActivePanelTab(t.id as Tab)}
                        className={clsx(
                            "flex-1 flex flex-row items-center justify-center gap-2 py-2 rounded-md transition-all duration-200",
                            activePanelTab === t.id
                                ? "bg-white dark:bg-[#27272a] text-zinc-900 dark:text-white shadow-sm border border-zinc-200 dark:border-white/10"
                                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-white/[0.03]"
                        )}
                    >
                        <t.icon size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{t.label}</span>
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative text-zinc-900 dark:text-white bg-zinc-50 dark:bg-[#1e1e20]">
                {activePanelTab === 'properties' && <EditorProperties />}
                {activePanelTab === 'layers' && <LayerPanel />}
            </div>

            {/* Footer Label */}
            <div className="h-10 px-4 border-t border-zinc-200 dark:border-white/5 bg-zinc-100 dark:bg-[#18181b] flex items-center justify-between text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                INSPECTOR v2.0
            </div>
        </div>
    );
};
