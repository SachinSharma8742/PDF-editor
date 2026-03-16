import React, { useRef, useState, useEffect } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import type { ToolType } from '../../../store/pdfStore';
import {
    MousePointerClick, Move, TypeOutline, ImagePlus,
    PenTool, Brush, EraserIcon,
    Pipette, PlusCircle, Ruler,
    Signature, Smile, Sparkles,
    Shapes, Magnet
} from 'lucide-react';
import clsx from 'clsx';
import { SignatureModal } from './SignatureModal';

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

// --- Configuration ---
type ToolGroupKey = 'essentials' | 'draw' | 'insert' | 'enhance';

interface ToolDef {
    id: ToolType;
    icon: React.ElementType;
    label: string;
    shortcut?: string;
}

const TOOL_GROUPS: Record<ToolGroupKey, { groupLabel: string; groupIcon?: React.ElementType; tools: ToolDef[] }> = {
    essentials: {
        groupLabel: 'Navigate',
        tools: [
            { id: 'select', icon: MousePointerClick, label: 'Select', shortcut: 'V' },
            { id: 'pan', icon: Move, label: 'Pan', shortcut: 'H' },
        ]
    },
    draw: {
        groupLabel: 'Draw',
        tools: [
            { id: 'pen', icon: PenTool, label: 'Pen', shortcut: 'P' },
            { id: 'highlighter', icon: Brush, label: 'Highlighter', shortcut: 'M' },
            { id: 'eraser', icon: EraserIcon, label: 'Eraser', shortcut: 'E' },
            { id: 'measure', icon: Ruler, label: 'Measure', shortcut: 'K' },
        ]
    },

    insert: {
        groupLabel: 'Insert / Secure',
        groupIcon: PlusCircle,
        tools: [
            { id: 'text', icon: TypeOutline, label: 'Text', shortcut: 'T' },
            { id: 'image', icon: ImagePlus, label: 'Image', shortcut: 'I' },
            { id: 'shapes' as ToolType, icon: Shapes, label: 'Shapes' },
            { id: 'signature', icon: Signature, label: 'Signature', shortcut: 'S' },
            { id: 'stamp', icon: Smile, label: 'Stamps', shortcut: 'X' },
        ]
    },
    enhance: {
        groupLabel: 'Enhance',
        tools: [
            { id: 'effects', icon: Sparkles, label: 'Effects' },
        ]
    }
};

// Helper to find which group a tool belongs to
const getGroupForTool = (tool: ToolType): ToolGroupKey | null => {
    for (const [key, group] of Object.entries(TOOL_GROUPS)) {
        if (group.tools.some(t => t.id === tool)) return key as ToolGroupKey;
    }
    return null;
};

// Helper to get the icon for a tool
const getToolIcon = (tool: ToolType): React.ElementType => {
    for (const group of Object.values(TOOL_GROUPS)) {
        const found = group.tools.find(t => t.id === tool);
        if (found) return found.icon;
    }
    // Default fallback
    return MousePointerClick;
};

export const EditorToolbar: React.FC = () => {
    const isMobile = useIsMobile();
    const {
        activeTool, setActiveTool, addObject, toolPreferences, updateToolSettings,
        addColorToHistory, openShapeEditor, openTextStudio,
        smartSnap, toggleSmartSnap
    } = useEditorStore();

    const imageInputRef = useRef<HTMLInputElement>(null);
    const fallbackColorInputRef = useRef<HTMLInputElement>(null);
    const [eyedropperActive, setEyedropperActive] = useState(false);
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

    // State to track the "current" tool for each group (to display as the main icon)
    const [groupDefaults, setGroupDefaults] = useState<Record<ToolGroupKey, ToolType>>({
        essentials: 'select',
        draw: 'pen',
        insert: 'text',
        enhance: 'effects'
    });

    // Update group default when active tool changes
    useEffect(() => {
        const group = getGroupForTool(activeTool);
        if (group && groupDefaults[group] !== activeTool) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setGroupDefaults(prev => ({ ...prev, [group]: activeTool }));
        }
    }, [activeTool, groupDefaults]);

    // Completely unmount on mobile - AFTER all hooks
    if (isMobile) return null;

    const ActiveIcon = eyedropperActive ? Pipette : getToolIcon(activeTool);

    const handleToolSelect = (toolId: ToolType) => {
        if (toolId === 'image') {
            imageInputRef.current?.click();
            setGroupDefaults(prev => ({ ...prev, insert: 'image' }));
        } else if (toolId === 'signature') {
            setIsSignatureModalOpen(true);
            setGroupDefaults(prev => ({ ...prev, insert: 'signature' }));
        } else if (toolId === ('shapes' as ToolType)) {
            openShapeEditor('add');
            setGroupDefaults(prev => ({ ...prev, insert: 'shapes' as ToolType }));
        } else if (toolId === 'text') {
            // Open Text Studio in CREATE mode (don't add object yet)
            openTextStudio('create');
            setGroupDefaults(prev => ({ ...prev, insert: 'text' }));
        } else {
            setActiveTool(toolId);
        }
    };

    const handleSignatureSave = (dataUrl: string) => {
        addObject({
            id: crypto.randomUUID(),
            type: 'image',
            x: 100,
            y: 100,
            width: 250,
            height: 125,
            src: dataUrl,
            rotation: 0,
            opacity: 1
        });
        setActiveTool('select');
    };


    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;

            // Direct Add (Restoring previous behavior as requested)
            const img = new Image();
            img.onload = () => {
                const aspect = img.width / img.height;
                const baseW = 300;
                addObject({
                    id: crypto.randomUUID(),
                    type: 'image',
                    x: 100,
                    y: 100,
                    width: baseW,
                    height: baseW / aspect,
                    src: dataUrl,
                    originalSrc: dataUrl,
                    rotation: 0,
                    opacity: 1
                });
                // Reset input
                if (imageInputRef.current) imageInputRef.current.value = '';
            };
            img.onerror = () => {
                // Fallback if image load fails
                addObject({
                    id: crypto.randomUUID(),
                    type: 'image',
                    x: 100,
                    y: 100,
                    width: 300,
                    height: 200,
                    src: dataUrl,
                    originalSrc: dataUrl,
                    rotation: 0,
                    opacity: 1
                });
                if (imageInputRef.current) imageInputRef.current.value = '';
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
    };

    // Color Helpers
    const isEyedropperSupported = 'EyeDropper' in window;
    const handleEyedropper = async () => {
        if (isEyedropperSupported) {
            try {
                // @ts-expect-error EyeDropper API is not yet in standard types
                const eyeDropper = new window.EyeDropper();
                setEyedropperActive(true);
                const result = await eyeDropper.open();
                updateToolSettings({ color: result.sRGBHex });
                addColorToHistory(result.sRGBHex);
                setEyedropperActive(false);
                return;
            } catch (e) {
                console.warn(e);
                setEyedropperActive(false);
            }
        }
        fallbackColorInputRef.current?.click();
    };

    const currentSettings = toolPreferences[activeTool];



    return (
        <div className="flex h-full relative z-50 font-sans select-none flex-shrink-0">
            {/* --- MAIN VERTICAL TOOLBAR --- */}
            <div className="hidden md:flex w-14 md:w-18 bg-white dark:bg-[#09090b] border-r border-zinc-200 dark:border-white/5 flex-col items-center py-3 md:py-4 gap-3 md:gap-4 shadow-2xl z-50 flex-shrink-0 transition-colors duration-300">
                {/* Active Tool Indicator */}
                <div className="w-9 h-9 md:w-11 md:h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-200">
                    {React.createElement(ActiveIcon, { size: 18 })}
                </div>

                {/* Groups */}
                <div className="flex flex-col gap-3 w-full px-2">
                    <ToolGroup
                        groupKey="essentials"
                        groupLabel={TOOL_GROUPS.essentials.groupLabel}
                        groupIcon={TOOL_GROUPS.essentials.groupIcon}
                        tools={TOOL_GROUPS.essentials.tools}
                        activeTool={activeTool}
                        currentDefault={groupDefaults.essentials}
                        onSelect={handleToolSelect}
                    />


                    {/* Color Picker Tool - 2nd Position */}
                    <button
                        onClick={handleEyedropper}
                        title="Color Picker"
                        className={clsx(
                            "w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center transition-all duration-200 group relative mx-auto",
                            eyedropperActive
                                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/40 ring-1 ring-amber-400/50'
                                : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white'
                        )}
                    >
                        <Pipette size={20} className={clsx("transition-transform", eyedropperActive && "scale-110")} />

                        {/* Current Color Indicator Dot - Floating Badge Style */}
                        <div
                            className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#09090b] ring-1 ring-inset ring-white/30 shadow-sm z-20"
                            style={{ backgroundColor: currentSettings?.color || '#000' }}
                        />

                    </button>

                    {/* Smart Snap Toggle */}
                    <button
                        onClick={toggleSmartSnap}
                        title={smartSnap ? 'Smart Snap (ON)' : 'Smart Snap (OFF)'}
                        className={clsx(
                            "w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center transition-all duration-200 group relative mx-auto",
                            smartSnap
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-1 ring-blue-400/50'
                                : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white'
                        )}
                    >
                        <Magnet size={20} className={clsx("transition-transform", smartSnap && "scale-110")} />
                    </button>

                    <div className="w-8 h-px bg-zinc-200 dark:bg-white/5 mx-auto rounded-full" />
                    <ToolGroup
                        groupKey="insert"
                        groupLabel={TOOL_GROUPS.insert.groupLabel}
                        groupIcon={TOOL_GROUPS.insert.groupIcon}
                        tools={TOOL_GROUPS.insert.tools}
                        activeTool={activeTool}
                        currentDefault={groupDefaults.insert}
                        onSelect={handleToolSelect}
                    />



                    <div className="w-8 h-px bg-zinc-200 dark:bg-white/5 mx-auto rounded-full" />
                    <ToolGroup
                        groupKey="draw"
                        groupLabel={TOOL_GROUPS.draw.groupLabel}
                        groupIcon={TOOL_GROUPS.draw.groupIcon}
                        tools={TOOL_GROUPS.draw.tools}
                        activeTool={activeTool}
                        currentDefault={groupDefaults.draw}
                        onSelect={handleToolSelect}
                    />

                    <div className="w-8 h-px bg-zinc-200 dark:bg-white/5 mx-auto rounded-full" />
                    <ToolGroup
                        groupKey="enhance"
                        groupLabel={TOOL_GROUPS.enhance.groupLabel}
                        groupIcon={TOOL_GROUPS.enhance.groupIcon}
                        tools={TOOL_GROUPS.enhance.tools}
                        activeTool={activeTool}
                        currentDefault={groupDefaults.enhance}
                        onSelect={handleToolSelect}
                    />




                </div>
            </div>

            <SignatureModal
                isOpen={isSignatureModalOpen}
                onClose={() => setIsSignatureModalOpen(false)}
                onSave={handleSignatureSave}
            />

            <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                style={{ position: 'absolute', width: 0, height: 0, opacity: 0, overflow: 'hidden', pointerEvents: 'none' }}
                onChange={handleImageUpload}
            />
            <input ref={fallbackColorInputRef} type="color" className="hidden" onChange={(e) => { updateToolSettings({ color: e.target.value }); addColorToHistory(e.target.value); }} />
        </div>
    );
};

// --- SUB-COMPONENTS ---

const ToolGroup: React.FC<{
    groupKey: ToolGroupKey;
    groupLabel: string;
    groupIcon?: React.ElementType;
    tools: ToolDef[];
    activeTool: ToolType;
    currentDefault: ToolType;
    onSelect: (id: ToolType) => void;
}> = ({ groupLabel, groupIcon, tools, activeTool, currentDefault, onSelect }) => {
    // Find the definition for the tool to show as the main icon
    const mainTool = tools.find(t => t.id === currentDefault) || tools[0];
    const isActive = tools.some(t => t.id === activeTool);

    // Use groupIcon if provided, otherwise use the mainTool's icon
    const MainIcon = groupIcon || mainTool.icon;

    return (
        <div className="relative group/main">
            {/* Main Button */}
            <button
                onClick={() => onSelect(mainTool.id)}
                className={clsx(
                    "w-9 h-9 md:w-11 md:h-11 mx-auto rounded-xl flex items-center justify-center transition-all duration-200 relative",
                    isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                        : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white'
                )}
            >
                <MainIcon size={20} className="relative z-10" />

                {/* Enhanced indicator that there are more tools - scale and opacity change on hover */}
                <div className="absolute bottom-1 right-1 opacity-30 group-hover/main:opacity-100 group-hover/main:scale-125 transition-all">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
                        <path d="M7 7H2L7 2V7Z" />
                    </svg>
                </div>
            </button>

            {/* Flyout Menu (Visible on Hover of the entire container) */}
            <div className="absolute left-full top-0 ml-4 bg-white/90 dark:bg-[#18181b]/95 backdrop-blur-2xl border border-zinc-200 dark:border-white/10 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-2xl p-2 flex flex-col gap-1 min-w-[160px] opacity-0 invisible translate-x-[-10px] group-hover/main:opacity-100 group-hover/main:visible group-hover/main:translate-x-0 transition-all duration-300 z-50">
                <div className="text-[9px] uppercase font-black text-zinc-400 dark:text-zinc-500 px-3 py-2 tracking-[0.2em] mb-1">{groupLabel}</div>
                {tools.map(tool => (
                    <button
                        key={tool.id}
                        onClick={(e) => { e.stopPropagation(); onSelect(tool.id); }}
                        className={clsx(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all text-left group/item",
                            activeTool === tool.id
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-zinc-200"
                        )}
                    >
                        <tool.icon size={16} strokeWidth={activeTool === tool.id ? 2.5 : 2} className="group-hover/item:scale-110 transition-transform" />
                        <span className="uppercase tracking-wider">{tool.label}</span>
                        {tool.shortcut && <span className={clsx("ml-auto text-[9px] px-1.5 py-0.5 rounded-md border", activeTool === tool.id ? "bg-white/20 border-white/20 text-white" : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-white/5 text-zinc-400 dark:text-zinc-600")}>{tool.shortcut}</span>}
                    </button>
                ))}
            </div>
        </div>
    );
};

