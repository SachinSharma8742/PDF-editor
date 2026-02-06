import React, { useState } from 'react';
import {
    ChevronLeft, ChevronRight,
    Library, Sparkles
} from 'lucide-react';
import clsx from 'clsx';
import { useEditorStore } from '../../../store/editorStore';
import { StampsPanel } from './StampsPanel';
import { OCRPanel } from './OCRPanel';
import { CalibrationPanel } from './CalibrationPanel';
import { LeftColorPanel } from './LeftColorPanel';

import { ImageEditorPanel } from './ImageEditorPanel';
import { TextPropertyPanel } from './properties/TextPropertyPanel';

import { SearchReplacePanel } from './SearchReplacePanel';

type TabId = 'stamps' | 'ocr' | 'scale' | 'properties' | 'image-editor' | 'advanced';

export const EditorLeftPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabId>('properties');
    const [isCollapsed, setIsCollapsed] = useState(true);
    const {
        activeTool, toolPreferences, updateToolSettings, selectedObjectIds,
        currentPage, updateObject, recentColors, addColorToHistory, editingMode
    } = useEditorStore();

    const hasSelection = selectedObjectIds.length > 0;
    const selectedObj = currentPage?.objects.find(o => o.id === selectedObjectIds[0]);

    // Derived flags for specialized modes
    const isLibraryTool = ['stamp', 'ocr', 'measure', 'search'].includes(activeTool);
    const isNavigateMode = (activeTool === 'select' && !hasSelection) || activeTool === 'pan';

    // Track if user has manually selected a tab to prevent auto-switching overriding user intent
    // const [userHasSelectedTab, setUserHasSelectedTab] = useState(false);

    React.useEffect(() => {

        if (activeTool === 'stamp') {
            setActiveTab('stamps');
            setIsCollapsed(false);
        } else if (activeTool === 'ocr') {
            setActiveTab('ocr');
            setIsCollapsed(false);
        } else if (activeTool === 'measure') {
            setActiveTab('scale');
            setIsCollapsed(false);
        } else if (activeTool === 'search') {
            setActiveTab('advanced');
            setIsCollapsed(false);
        } else if (hasSelection) {
            if (selectedObj?.type === 'image') {
                setActiveTab('image-editor');
            } else {
                setActiveTab('properties');
            }
            setIsCollapsed(false);
        } else if (editingMode === 'native-text') {
            setActiveTab('properties');
            setIsCollapsed(false);
        } else if ((activeTool === 'select' && !hasSelection) || activeTool === 'pan') {
            setIsCollapsed(true);
        } else if (['pen', 'highlighter', 'rectangle', 'circle', 'text', 'line', 'arrow', 'eraser'].includes(activeTool)) {
            setActiveTab('properties');
            setIsCollapsed(false);
        }
    }, [activeTool, hasSelection, selectedObj?.type, activeTab, editingMode]);



    if (isCollapsed) {
        return (
            <div
                className={clsx(
                    "w-5 transition-all duration-300 relative border-r border-white/5 bg-[#1e1e20] flex flex-col items-center py-4 group",
                    isNavigateMode ? "cursor-default" : "hover:bg-white/5 cursor-pointer"
                )}
                onClick={() => !isNavigateMode && setIsCollapsed(false)}
            >
                {!isNavigateMode && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsCollapsed(false); }}
                        className="p-1 rounded-md text-zinc-500 hover:text-white transition-colors mt-1"
                        title="Open Sidebar"
                    >
                        <ChevronRight size={14} />
                    </button>
                )}
                {!isNavigateMode && <div className="h-full w-[1px] bg-white/5 my-2 group-hover:bg-blue-500/50 transition-colors" />}
            </div>
        );
    }

    return (
        <div className="w-72 bg-[#1e1e20] border-r border-white/5 flex flex-col h-full z-30 shadow-2xl flex-shrink-0 transition-all duration-300 relative font-sans">
            {/* Header */}
            <div className={clsx(
                "h-14 border-b border-white/5 flex items-center px-4 gap-3 justify-between transition-colors",
                isLibraryTool ? "bg-blue-500/5" : "bg-transparent"
            )}>
                <div className="flex items-center gap-2.5">
                    {isLibraryTool ? (
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                    ) : (
                        <Library size={16} className="text-zinc-400" />
                    )}
                    <h2 className={clsx(
                        "text-[11px] font-bold uppercase tracking-widest",
                        isLibraryTool ? "text-blue-400" : "text-zinc-300"
                    )}>
                        {activeTab === 'stamps' ? 'Decorations' :
                            activeTab === 'ocr' ? 'AI OCR Engine' :
                                activeTab === 'scale' ? 'Measurement' :
                                    activeTab === 'image-editor' ? 'Image Studio' :
                                        activeTab === 'advanced' ? 'Advanced Tools' :
                                            // Dynamic Properties Title
                                            (activeTool === 'text' || (hasSelection && selectedObj?.type === 'text')) ? 'Text Properties' :
                                                (activeTool === 'select' && hasSelection) ? (
                                                    selectedObj?.type === 'rectangle' ? 'Rectangle Properties' :
                                                        selectedObj?.type === 'circle' ? 'Circle Properties' :
                                                            selectedObj?.type === 'image' ? 'Image Properties' :
                                                                'Properties'
                                                ) : 'Colors & Stroke'}
                    </h2>
                </div>
                <button
                    onClick={() => setIsCollapsed(true)}
                    className="p-1.5 rounded-md hover:bg-white/5 text-zinc-500 hover:text-zinc-200 transition-all"
                >
                    <ChevronLeft size={16} />
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#1e1e20]">
                {activeTab === 'properties' ? (
                    (activeTool === 'text' || (hasSelection && selectedObj?.type === 'text')) ? (
                        <div className="p-4">
                            <TextPropertyPanel mode={hasSelection ? 'selection' : 'tool'} />
                        </div>
                    ) : (
                        <LeftColorPanel
                            activeTool={activeTool}
                            toolPreferences={toolPreferences}
                            updateToolSettings={updateToolSettings}
                            hasSelection={hasSelection}
                            selectedObj={selectedObj}
                            recentColors={recentColors}
                            onColorPick={addColorToHistory}
                            selectedObjectIds={selectedObjectIds}
                            updateObject={updateObject}
                        />
                    )
                ) : activeTab === 'image-editor' ? (
                    <ImageEditorPanel />
                ) : (
                    <div className="px-4 py-4">
                        <div className="flex items-center justify-between mb-4 px-1">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                {activeTab === 'stamps' ? 'Decorations' :
                                    activeTab === 'ocr' ? 'Analysis' :
                                        activeTab === 'scale' ? 'Calibration' : 'Smart Tools'}
                            </span>
                        </div>
                        {activeTab === 'stamps' && <StampsPanel />}
                        {activeTab === 'ocr' && <OCRPanel />}
                        {activeTab === 'scale' && <CalibrationPanel />}
                        {activeTab === 'advanced' && <SearchReplacePanel />}
                    </div>
                )}
            </div>

            {/* Status Footer */}
            <div className="h-10 px-4 border-t border-white/5 bg-[#18181b] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles size={12} className="text-amber-500" />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        {isLibraryTool ? 'Library Mode' : 'Editor Ready'}
                    </span>
                </div>
            </div>
        </div>
    );
};
