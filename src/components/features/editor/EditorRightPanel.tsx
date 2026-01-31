import React, { useState } from 'react';
import { Layers, Settings2 } from 'lucide-react';
import { EditorProperties } from './EditorProperties';
import { LayerPanel } from './LayerPanel';

type Tab = 'properties' | 'layers';

export const EditorRightPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('properties');

    return (
        <div className="w-64 bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-800 flex flex-col h-full z-30 shadow-sm transition-colors duration-200 flex-shrink-0">
            {/* Tab Header */}
            <div className="flex border-b border-gray-200 dark:border-zinc-800">
                <button
                    onClick={() => setActiveTab('properties')}
                    className={`flex-1 py-3 text-xs font-medium uppercase tracking-wide flex items-center justify-center gap-2 transition-colors
                        ${activeTab === 'properties'
                            ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-500/10'
                            : 'text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800'
                        }`}
                >
                    <Settings2 size={14} />
                    Properties
                </button>
                <button
                    onClick={() => setActiveTab('layers')}
                    className={`flex-1 py-3 text-xs font-medium uppercase tracking-wide flex items-center justify-center gap-2 transition-colors
                        ${activeTab === 'layers'
                            ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-500/10'
                            : 'text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800'
                        }`}
                >
                    <Layers size={14} />
                    Layers
                </button>
            </div>

            {/* Content Content - flex-1 for scrolling */}
            <div className="flex-1 overflow-hidden relative text-gray-900 dark:text-gray-300">
                <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'properties' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                    <div className="h-full overflow-y-auto custom-scrollbar">
                        <EditorProperties />
                    </div>
                </div>
                <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'layers' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                    <div className="h-full overflow-y-auto custom-scrollbar">
                        <LayerPanel />
                    </div>
                </div>
            </div>
        </div>
    );
};
