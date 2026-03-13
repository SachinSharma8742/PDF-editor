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

            {/* Sidebar Panel - Now part of flex flow on desktop */}
            <div 
                className={clsx(
                    "fixed md:relative top-0 right-0 z-[110] md:z-auto h-full flex shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.5)] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] will-change-transform",
                    "bg-[#1e1e20] overflow-hidden flex-shrink-0 min-w-0",
                    isOpen ? "translate-x-0 w-full md:w-[320px] opacity-100 pointer-events-auto border-l border-white/10" : "translate-x-full md:translate-x-0 w-0 opacity-0 pointer-events-none border-none"
                )}
            >
                {/* Inner container with locked width to prevent content squashing during animation */}
                <div className="w-screen md:w-[320px] h-full flex flex-col flex-shrink-0">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-5 bg-[#18181b] border-b border-white/5 shrink-0 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-sky-500/10 to-indigo-500/10 opacity-50 pointer-events-none" />
                    
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 p-0.5 shadow-lg shadow-sky-500/20">
                            <div className="w-full h-full bg-[#18181b] rounded-[10px] flex items-center justify-center">
                                <Bot className="w-4 h-4 text-sky-400" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white tracking-wide">AI Assistant</h2>
                            <p className="text-[10px] text-zinc-400 capitalize">Document Insights & Q&A</p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => setIsOpen(false)}
                        className="p-2 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white transition-colors relative z-10 group"
                    >
                        <X className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex p-2 gap-2 bg-[#18181b] border-b border-white/5 shrink-0">
                    <div className="flex bg-[#1e1e20] p-1 rounded-xl w-full border border-white/5 relative">
                        {/* Tab Switcher Background */}
                        <div 
                            className={clsx(
                                "absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#27272a] rounded-lg shadow-md border border-white/10 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
                                activeTab === 'ask' ? "translate-x-[calc(100%+8px)]" : "translate-x-0"
                            )} 
                        />
                        
                        <button
                            onClick={() => setActiveTab('summary')}
                            className={clsx(
                                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-colors duration-300 relative z-10",
                                activeTab === 'summary' ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            <FileText size={14} className={activeTab === 'summary' ? 'text-emerald-400' : ''} />
                            <span className="text-[11px] font-bold uppercase tracking-widest">Summary</span>
                        </button>
                        
                        <button
                            onClick={() => setActiveTab('ask')}
                            className={clsx(
                                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-colors duration-300 relative z-10",
                                activeTab === 'ask' ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            <MessageCircleQuestion size={14} className={activeTab === 'ask' ? 'text-sky-400' : ''} />
                            <span className="text-[11px] font-bold uppercase tracking-widest">Ask</span>
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-[#1e1e20] text-white">
                    <div className={clsx("absolute inset-0 transition-opacity duration-300", activeTab === 'summary' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none')}>
                        <SummarizerPanel />
                    </div>
                    <div className={clsx("absolute inset-0 transition-opacity duration-300", activeTab === 'ask' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none')}>
                        <DocumentQAPanel />
                    </div>
                </div>
                </div>
            </div>
        </>
    );
};
