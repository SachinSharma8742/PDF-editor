import React from 'react';
import { Copy, ArrowRight } from 'lucide-react';
import { useEditorStore } from '../../../store/editorStore';

interface BatchOperationsPanelProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export const BatchOperationsPanel: React.FC<BatchOperationsPanelProps> = ({ isOpen }) => {
    const { setActivePanelTab } = useEditorStore();

    if (typeof isOpen === 'boolean' && !isOpen) {
        return null;
    }

    return (
        <div className="flex flex-col h-full bg-zinc-50 dark:bg-[#1e1e20] text-zinc-900 dark:text-white transition-colors duration-300">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-white/5 bg-zinc-100 dark:bg-[#18181b] sticky top-0 z-10 backdrop-blur-xl transition-colors duration-300">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        <Copy size={14} />
                    </div>
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-tight text-zinc-800 dark:text-zinc-200">Batch Operations</h3>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest leading-none mt-1">All Pages</p>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar bg-zinc-50/30 dark:bg-transparent">
                <div className="bg-white/60 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 rounded-2xl p-4 space-y-3 shadow-inner dark:shadow-none">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600 dark:text-zinc-300">Moved to Page Architect</h4>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        Watermark and Rotate controls now live in the Page Architect section under the Properties tab.
                    </p>
                    <button
                        onClick={() => setActivePanelTab('properties')}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20"
                    >
                        Open Page Architect
                        <ArrowRight size={12} />
                    </button>
                </div>
            </div>
        </div>
    );
};
