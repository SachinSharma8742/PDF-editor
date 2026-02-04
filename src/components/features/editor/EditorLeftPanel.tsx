import React, { useState } from 'react';
import {
    Smile, ScanText, Ruler, ChevronLeft, ChevronRight,
    Library, Sparkles
} from 'lucide-react';
import clsx from 'clsx';
import { useEditorStore } from '../../../store/editorStore';
import { StampsPanel } from './StampsPanel';
import { OCRPanel } from './OCRPanel';
import { CalibrationPanel } from './CalibrationPanel';
import { LeftColorPanel } from './LeftColorPanel';
import { PageEffectsPanel } from './PageEffectsPanel';
import { ImageEditorPanel } from './ImageEditorPanel';

type TabId = 'stamps' | 'ocr' | 'scale' | 'properties' | 'image-editor' | 'page-effects';

export const EditorLeftPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabId>('properties');
    const [isCollapsed, setIsCollapsed] = useState(true);
    const {
        activeTool, toolPreferences, updateToolSettings, selectedObjectIds,
        currentPage, updateObject, recentColors, addColorToHistory
    } = useEditorStore();

    const hasSelection = selectedObjectIds.length > 0;
    const selectedObj = currentPage?.objects.find(o => o.id === selectedObjectIds[0]);

    // Derived flags for specialized modes
    const isLibraryTool = ['stamp', 'ocr', 'measure'].includes(activeTool);

    // Track if user has manually selected a tab to prevent auto-switching overriding user intent
    const [userHasSelectedTab, setUserHasSelectedTab] = useState(false);

    React.useEffect(() => {
        if (userHasSelectedTab) return;

        if (activeTool === 'stamp') {
            setActiveTab('stamps');
            setIsCollapsed(false);
        } else if (activeTool === 'ocr') {
            setActiveTab('ocr');
            setIsCollapsed(false);
        } else if (activeTool === 'measure') {
            setActiveTab('scale');
            setIsCollapsed(false);
        } else if (hasSelection) {
            if (activeTab === 'page-effects') {
                // If we were on page effects, switch to properties for the selection
                setActiveTab('properties');
            }
            if (selectedObj?.type === 'image') {
                setActiveTab('image-editor');
            } else {
                setActiveTab('properties');
            }
            setIsCollapsed(false);
        } else if (activeTool === 'select' && !hasSelection) {
            // Default to Page Effects when standard selection mode is active but nothing selected
            setActiveTab('page-effects');
            setIsCollapsed(false);
        } else if (['pen', 'highlighter', 'rectangle', 'circle', 'text', 'line', 'arrow', 'eraser'].includes(activeTool)) {
            setActiveTab('properties');
            setIsCollapsed(false);
        }
    }, [activeTool, hasSelection, userHasSelectedTab, selectedObj?.type]);

    const handleTabChange = (tab: TabId) => {
        setActiveTab(tab);
        setUserHasSelectedTab(true);
        setIsCollapsed(false);
    };

    if (isCollapsed) {
        return (
            <div className="w-0 overflow-hidden transition-all duration-300 relative border-r border-white/5 bg-[#1e1e20]">
                <button
                    onClick={() => setIsCollapsed(false)}
                    className="absolute left-0 top-4 z-40 p-1.5 bg-blue-600 text-white rounded-r-md shadow-lg border border-white/10 hover:bg-blue-500 transition-colors"
                    title="Open Sidebar"
                >
                    <ChevronRight size={14} />
                </button>
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
                        {activeTab === 'stamps' ? 'Stamp Library' :
                            activeTab === 'ocr' ? 'AI OCR Engine' :
                                activeTab === 'scale' ? 'Measurement' :
                                    activeTab === 'image-editor' ? 'Image Studio' :
                                        activeTab === 'page-effects' ? 'Page Effects' : 'Properties'}
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
                ) : activeTab === 'image-editor' ? (
                    <ImageEditorPanel />
                ) : activeTab === 'page-effects' ? (
                    <PageEffectsPanel />
                ) : (
                    <div className="px-4 py-4">
                        <div className="flex items-center justify-between mb-4 px-1">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                {activeTab === 'stamps' ? 'Decorations' : activeTab === 'ocr' ? 'Analysis' : 'Calibration'}
                            </span>
                        </div>
                        {activeTab === 'stamps' && <StampsPanel />}
                        {activeTab === 'ocr' && <OCRPanel />}
                        {activeTab === 'scale' && <CalibrationPanel />}
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
