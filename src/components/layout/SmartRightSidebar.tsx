import React, { useState } from 'react';
import { Bot, FileText, MessageCircleQuestion, X, Sparkles } from 'lucide-react';
import { SummarizerPanel } from '../features/editor/SummarizerPanel';
import { DocumentQAPanel } from '../features/editor/DocumentQAPanel';
import clsx from 'clsx';
import { usePDFStore } from '../../store/pdfStore';

type Tab = 'summary' | 'ask';

export const SmartRightSidebar: React.FC = () => {
    const [isOpen, setIsOpen] = useState(() => {
        const saved = localStorage.getItem('smartSidebarOpen');
        return saved ? JSON.parse(saved) : false;
    });
    const [activeTab, setActiveTab] = useState<Tab>(() => {
        const saved = localStorage.getItem('smartSidebarTab');
        return (saved as Tab) || 'summary';
    });
    const { pdfDocument } = usePDFStore();

    // Persist state changes
    React.useEffect(() => {
        localStorage.setItem('smartSidebarOpen', JSON.stringify(isOpen));
    }, [isOpen]);

    React.useEffect(() => {
        localStorage.setItem('smartSidebarTab', activeTab);
    }, [activeTab]);

    // Don't render the FAB if no document is loaded
    if (!pdfDocument) return null;

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className={clsx(
                    "fixed bottom-8 right-8 z-[100] p-4 rounded-full shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group hover:scale-105 active:scale-95",
                    "bg-gradient-to-tr from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 border border-white/20",
                    isOpen ? "opacity-0 translate-x-12 pointer-events-none scale-50" : "opacity-100 translate-x-0 scale-100"
                )}
                aria-label="Open AI Assistant"
            >
                <div className="absolute inset-0 bg-white/20 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Sparkles className="w-6 h-6 text-white relative z-10 drop-shadow-md animate-pulse" />
                
                {/* Tooltip */}
                <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-zinc-900 border border-white/10 text-white text-[11px] font-bold uppercase tracking-wider rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none shadow-xl">
                    AI Assistant
                </span>
            </button>

            {/* Backdrop for mobile */}
            <div 
                className={clsx(
                    "fixed inset-0 z-[100] shrink-0 bg-black/40 backdrop-blur-sm md:hidden transition-opacity duration-500",
                    isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
                onClick={() => setIsOpen(false)}
            />

            {/* Sidebar Panel - Redesigned as Elevated Glass Sheet */}
            <div 
                className={clsx(
                    "fixed md:relative top-0 right-0 z-[110] md:z-auto h-full flex transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] will-change-transform",
                    "bg-white/90 dark:bg-[#1e1e20]/95 backdrop-blur-2xl overflow-hidden flex-shrink-0 min-w-0",
                    isOpen 
                        ? "translate-x-0 w-full md:w-[340px] opacity-100 pointer-events-auto border-l border-zinc-200/60 dark:border-white/10 shadow-[-20px_0_50px_rgba(0,0,0,0.05)]" 
                        : "translate-x-full md:translate-x-0 w-0 opacity-0 pointer-events-none border-none"
                )}
            >
                {/* Inner container */}
                <div className="w-screen md:w-[340px] h-full flex flex-col flex-shrink-0">
                    {/* Header */}
                    <div className="flex items-center justify-between px-8 py-6 bg-white/50 dark:bg-[#18181b] border-b border-zinc-100 dark:border-white/5 shrink-0 relative overflow-hidden transition-colors">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-50 pointer-events-none" />
                    
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 shadow-lg shadow-blue-500/20">
                            <div className="w-full h-full bg-white dark:bg-[#18181b] rounded-[14px] flex items-center justify-center">
                                <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-[13px] font-black text-zinc-900 dark:text-white uppercase tracking-wider leading-tight">AI Assistant</h2>
                            <p className="text-[9px] text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-widest mt-0.5">Intellectual Analysis</p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => setIsOpen(false)}
                        className="p-2.5 rounded-2xl hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all relative z-10 group"
                    >
                        <X className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
                    </button>
                </div>

                {/* Tabs - Redesigned as Track & Pill */}
                <div className="flex p-4 bg-white/30 dark:bg-[#18181b] border-b border-zinc-100 dark:border-white/5 shrink-0 transition-colors">
                    <div className="flex bg-zinc-100/80 dark:bg-[#1e1e20] p-1.5 rounded-2xl w-full border border-zinc-200/50 dark:border-white/5 relative shadow-inner">
                        {/* Tab Switcher Background - The Pill */}
                        <div 
                            className={clsx(
                                "absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white dark:bg-[#27272a] rounded-[12px] shadow-sm border border-zinc-200 dark:border-white/10 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]",
                                activeTab === 'ask' ? "translate-x-[calc(100%+6px)]" : "translate-x-0"
                            )} 
                        />
                        
                        <button
                            onClick={() => setActiveTab('summary')}
                            className={clsx(
                                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all duration-500 relative z-10",
                                activeTab === 'summary' ? "text-zinc-900 dark:text-white" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                            )}
                        >
                            <FileText size={14} strokeWidth={2.5} className={activeTab === 'summary' ? 'text-blue-600 dark:text-emerald-400' : ''} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Summary</span>
                        </button>
                        
                        <button
                            onClick={() => setActiveTab('ask')}
                            className={clsx(
                                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all duration-500 relative z-10",
                                activeTab === 'ask' ? "text-zinc-900 dark:text-white" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                            )}
                        >
                            <MessageCircleQuestion size={14} strokeWidth={2.5} className={activeTab === 'ask' ? 'text-blue-600 dark:text-sky-400' : ''} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Chat</span>
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-white/20 dark:bg-[#1e1e20] transition-colors">
                    <div className={clsx("absolute inset-0 transition-all duration-500", activeTab === 'summary' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none')}>
                        <SummarizerPanel />
                    </div>
                    <div className={clsx("absolute inset-0 transition-all duration-500", activeTab === 'ask' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none')}>
                        <DocumentQAPanel />
                    </div>
                </div>
                </div>
            </div>
        </>
    );
};
