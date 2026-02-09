import React, { useState, useEffect } from 'react';
import {
    ChevronLeft, ChevronRight,
    Library, Sparkles
} from 'lucide-react';
import clsx from 'clsx';
import { useEditorStore } from '../../../store/editorStore';
import { StampsPanel } from './StampsPanel';

import { CalibrationPanel } from './CalibrationPanel';
import { LeftColorPanel } from './LeftColorPanel';

import { ImageEditorPanel } from './ImageEditorPanel';
import { EffectsPanel } from './EffectsPanel';
import { TextPropertyPanel } from './properties/TextPropertyPanel';

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


type TabId = 'stamps' | 'scale' | 'properties' | 'image-editor' | 'effects';

export const EditorLeftPanel: React.FC = () => {
    const isMobile = useIsMobile();
    const [activeTab, setActiveTab] = useState<TabId>('properties');
    const [isCollapsed, setIsCollapsed] = useState(true);
    const {
        activeTool, toolPreferences, updateToolSettings, selectedObjectIds,
        currentPage, updateObject, recentColors, addColorToHistory, editingMode
    } = useEditorStore();

    // Ref to track last tool and selection that triggered an auto-expansion
    const lastAutoOpenedTool = React.useRef<string | null>(null);
    const lastAutoOpenedSelection = React.useRef<string | null>(null);

    const hasSelection = selectedObjectIds.length > 0;
    const selectedObj = currentPage?.objects.find(o => o.id === selectedObjectIds[0]);

    // Derived flags for specialized modes
    const isLibraryTool = ['stamp', 'measure'].includes(activeTool);
    const isNavigateMode = (activeTool === 'select' && !hasSelection) || activeTool === 'pan';

    // Track if user has manually selected a tab to prevent auto-switching overriding user intent
    // const [userHasSelectedTab, setUserHasSelectedTab] = useState(false);

    React.useEffect(() => {
        const selectedId = selectedObjectIds[0] || null;

        // Auto-collapse logic (strict)
        if (isNavigateMode) {
            setIsCollapsed(true);
            lastAutoOpenedTool.current = null;
            lastAutoOpenedSelection.current = null;
            return;
        }

        // Auto-expand logic (Smart & Respectful)
        let targetTab: TabId | null = null;
        let shouldAutoOpen = false;

        const isDrawingTool = ['pen', 'highlighter', 'rectangle', 'circle', 'text', 'line', 'arrow', 'eraser'].includes(activeTool);

        if (activeTool === 'stamp') {
            targetTab = 'stamps';
            if (lastAutoOpenedTool.current !== 'stamp') shouldAutoOpen = true;
            lastAutoOpenedTool.current = 'stamp';
        } else if (activeTool === 'measure') {
            targetTab = 'scale';
            if (lastAutoOpenedTool.current !== 'measure') shouldAutoOpen = true;
            lastAutoOpenedTool.current = 'measure';
        } else if (activeTool === 'effects') {
            targetTab = 'effects';
            if (lastAutoOpenedTool.current !== 'effects') shouldAutoOpen = true;
            lastAutoOpenedTool.current = 'effects';
        } else if (hasSelection) {
            if (selectedObj?.type === 'group') {
                setIsCollapsed(true);
                return;
            } else if (selectedObj?.type === 'image') {
                targetTab = 'image-editor';
                // Only auto-open if this specific object hasn't triggered an open yet
                if (lastAutoOpenedSelection.current !== selectedId) shouldAutoOpen = true;
                lastAutoOpenedSelection.current = selectedId;
            } else {
                targetTab = 'properties';
                if (lastAutoOpenedSelection.current !== selectedId) shouldAutoOpen = true;
                lastAutoOpenedSelection.current = selectedId;
            }
        } else if (editingMode === 'native-text') {
            targetTab = 'properties';
            if (lastAutoOpenedTool.current !== 'native-text') shouldAutoOpen = true;
            lastAutoOpenedTool.current = 'native-text';
        } else if (isDrawingTool) {
            targetTab = 'properties';
            if (lastAutoOpenedTool.current !== activeTool) shouldAutoOpen = true;
            lastAutoOpenedTool.current = activeTool;
        }

        if (targetTab) {
            setActiveTab(targetTab);
            // We ONLY set isCollapsed(false) if the user hasn't already dismissed the panel for this specific context
            if (shouldAutoOpen) {
                setIsCollapsed(false);
            }
        }

    }, [activeTool, hasSelection, selectedObj?.type, selectedObjectIds, editingMode, isNavigateMode]);

    // Completely unmount on mobile - AFTER all hooks
    if (isMobile) return null;

    if (isCollapsed) {
        return (
            <div
                className={clsx(
                    "w-1 md:w-2 transition-all duration-500 relative bg-[#1e1e20] border-r border-white/5 flex flex-col items-center group hidden md:flex h-full",
                    isNavigateMode ? "cursor-default" : "hover:w-6 hover:bg-white/5 cursor-pointer"
                )}
                onClick={() => !isNavigateMode && setIsCollapsed(false)}
            >
                {!isNavigateMode && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsCollapsed(false); }}
                        className="p-1 rounded-md text-zinc-500 opacity-0 group-hover:opacity-100 transition-all mt-4"
                        title="Open Sidebar"
                    >
                        <ChevronRight size={14} />
                    </button>
                )}
                <div className="flex-1" />
            </div>
        );
    }

    return (
        <div className="w-64 md:w-72 bg-[#1e1e20] border-r border-white/5 flex flex-col h-full z-30 shadow-2xl flex-shrink-0 transition-all duration-300 relative font-sans fixed md:relative inset-y-0 left-0">
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
                            activeTab === 'scale' ? 'Measurement' :
                                activeTab === 'image-editor' ? 'Image Studio' :
                                    // Dynamic Properties Title
                                    (activeTool === 'text' || (hasSelection && selectedObj?.type === 'text')) ? 'Text Properties' :
                                        (activeTool === 'select' && hasSelection) ? (
                                            selectedObj?.type === 'rectangle' ? 'Rectangle Properties' :
                                                selectedObj?.type === 'circle' ? 'Circle Properties' :
                                                    selectedObj?.type === 'image' ? 'Image Properties' :
                                                        'Properties'
                                        ) : activeTab === 'effects' ? 'Page Effects' : 'Colors & Stroke'}
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
                ) : activeTab === 'effects' ? (
                    <EffectsPanel />
                ) : (
                    <div className="px-4 py-4">
                        <div className="flex items-center justify-between mb-4 px-1">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                {activeTab === 'stamps' ? 'Decorations' :
                                    activeTab === 'scale' ? 'Calibration' : 'Smart Tools'}
                            </span>
                        </div>
                        {activeTab === 'stamps' && <StampsPanel />}
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
