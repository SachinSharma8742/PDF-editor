import React, { useRef, useState, useEffect } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import type { ToolType } from '../../../store/pdfStore';
import {
    MousePointerClick, Move, RectangleHorizontal, CircleDot, TypeOutline, ImagePlus,
    PenTool, Brush, EraserIcon, Trash2, Copy, BringToFront, SendToBack,
    Bold, Italic, AlignLeft, AlignCenter, AlignRight,
    Palette, ChevronRight, Pipette, Hash, PlusCircle, Shapes, Ruler,
    Triangle, Star, Pentagon, Signature, ShieldAlert, FileText, Type, CheckSquare, Smile, ScanText, MoveUpRight, Minus,
    Download, StickyNote, MessageSquare, Search
} from 'lucide-react';
import clsx from 'clsx';
import { Tooltip } from '../../ui/Tooltip';
import { SignatureModal } from './SignatureModal';

// --- Configuration ---
type ToolGroupKey = 'essentials' | 'draw' | 'shapes' | 'insert';

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
    shapes: {
        groupLabel: 'Shapes',
        groupIcon: Shapes,
        tools: [
            { id: 'rectangle', icon: RectangleHorizontal, label: 'Rectangle', shortcut: 'R' },
            { id: 'circle', icon: CircleDot, label: 'Circle', shortcut: 'O' },
            { id: 'triangle', icon: Triangle, label: 'Triangle' },
            { id: 'star', icon: Star, label: 'Star' },
            { id: 'polygon', icon: Pentagon, label: 'Polygon' },
            { id: 'ellipse', icon: CircleDot, label: 'Ellipse' },
            { id: 'line', icon: Minus, label: 'Line', shortcut: 'L' },
            { id: 'arrow', icon: MoveUpRight, label: 'Arrow', shortcut: 'A' },
        ]
    },
    insert: {
        groupLabel: 'Insert / Secure',
        groupIcon: PlusCircle,
        tools: [
            { id: 'text', icon: TypeOutline, label: 'Text', shortcut: 'T' },
            { id: 'callout', icon: MessageSquare, label: 'Callout' },
            { id: 'sticky-note', icon: StickyNote, label: 'Sticky Note' },
            { id: 'image', icon: ImagePlus, label: 'Image', shortcut: 'I' },
            { id: 'signature', icon: Signature, label: 'Signature', shortcut: 'S' },
            { id: 'stamp', icon: Smile, label: 'Stamps', shortcut: 'X' },
        ]
    },
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
    const {
        activeTool, setActiveTool, addObject, toolPreferences, updateToolSettings,
        selectedObjectIds, deleteObjects, currentPage, updateObject,
        recentColors, addColorToHistory, setActivePanelTab
    } = useEditorStore();

    const imageInputRef = useRef<HTMLInputElement>(null);
    const fallbackColorInputRef = useRef<HTMLInputElement>(null);
    const [eyedropperActive, setEyedropperActive] = useState(false);
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

    // State to track the "current" tool for each group (to display as the main icon)
    const [groupDefaults, setGroupDefaults] = useState<Record<ToolGroupKey, ToolType>>({
        essentials: 'select',
        draw: 'pen',
        shapes: 'rectangle',
        insert: 'text'
    });

    // Update group default when active tool changes
    useEffect(() => {
        const group = getGroupForTool(activeTool);
        if (group) {
            setGroupDefaults(prev => ({ ...prev, [group]: activeTool }));
        }
    }, [activeTool]);

    const handleToolSelect = (toolId: ToolType) => {
        if (toolId === 'image') {
            imageInputRef.current?.click();
        } else if (toolId === 'signature') {
            setIsSignatureModalOpen(true);
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
            const img = new Image();
            img.onload = () => {
                const targetWidth = 200;
                const targetHeight = (img.height / img.width) * targetWidth;
                addObject({
                    id: crypto.randomUUID(), type: 'image', x: 100, y: 100,
                    width: targetWidth, height: targetHeight, src: dataUrl,
                    rotation: 0, opacity: 1
                });
                setActiveTool('select');
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    // Color Helpers
    const isEyedropperSupported = 'EyeDropper' in window;
    const handleEyedropper = async () => {
        if (isEyedropperSupported) {
            try {
                // @ts-ignore
                const eyeDropper = new window.EyeDropper();
                setEyedropperActive(true);
                const result = await eyeDropper.open();
                updateToolSettings({ color: result.sRGBHex });
                addColorToHistory(result.sRGBHex);
                setEyedropperActive(false);
                return;
            } catch (e: any) {
                console.warn(e);
                setEyedropperActive(false);
            }
        }
        fallbackColorInputRef.current?.click();
    };

    const currentSettings = toolPreferences[activeTool];
    const hasSelection = selectedObjectIds.length > 0;
    const selectedObj = currentPage?.objects.find(o => o.id === selectedObjectIds[0]);


    return (
        <div className="flex h-full relative z-50 font-sans select-none flex-shrink-0">
            {/* --- MAIN VERTICAL TOOLBAR --- */}
            <div className="w-18 bg-[#09090b] border-r border-white/5 flex flex-col items-center py-4 gap-4 shadow-2xl z-50 flex-shrink-0">
                {/* Active Tool Indicator */}
                {(() => {
                    // Get the icon for the current active tool
                    const ActiveIcon = eyedropperActive ? Pipette : getToolIcon(activeTool);
                    return (
                        <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-200">
                            <ActiveIcon size={20} />
                        </div>
                    );
                })()}

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
                            "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 group relative mx-auto",
                            eyedropperActive
                                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/40 ring-1 ring-amber-400/50'
                                : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                        )}
                    >
                        <Pipette size={20} className={clsx("transition-transform", eyedropperActive && "scale-110")} />

                        {/* Current Color Indicator Dot - Floating Badge Style */}
                        <div
                            className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#09090b] shadow-sm z-20"
                            style={{ backgroundColor: currentSettings?.color || '#000' }}
                        />
                    </button>

                    {/* AI OCR Tool - Standalone */}
                    <button
                        onClick={() => handleToolSelect('ocr')}
                        title="AI OCR"
                        className={clsx(
                            "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 group relative mx-auto",
                            activeTool === 'ocr'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                        )}
                    >
                        <ScanText size={20} className={clsx("transition-transform", activeTool === 'ocr' && "scale-110")} />
                    </button>

                    <button
                        onClick={() => handleToolSelect('search')}
                        title="Search & Replace"
                        className={clsx(
                            "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 group relative mx-auto",
                            activeTool === 'search'
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                                : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                        )}
                    >
                        <Search size={20} className={clsx("transition-transform", activeTool === 'search' && "scale-110")} />
                    </button>

                    <div className="w-8 h-px bg-white/5 mx-auto rounded-full" />
                    <ToolGroup
                        groupKey="draw"
                        groupLabel={TOOL_GROUPS.draw.groupLabel}
                        groupIcon={TOOL_GROUPS.draw.groupIcon}
                        tools={TOOL_GROUPS.draw.tools}
                        activeTool={activeTool}
                        currentDefault={groupDefaults.draw}
                        onSelect={handleToolSelect}
                    />
                    <ToolGroup
                        groupKey="shapes"
                        groupLabel={TOOL_GROUPS.shapes.groupLabel}
                        groupIcon={TOOL_GROUPS.shapes.groupIcon}
                        tools={TOOL_GROUPS.shapes.tools}
                        activeTool={activeTool}
                        currentDefault={groupDefaults.shapes}
                        onSelect={handleToolSelect}
                    />
                    <div className="w-8 h-px bg-white/5 mx-auto rounded-full" />
                    <ToolGroup
                        groupKey="insert"
                        groupLabel={TOOL_GROUPS.insert.groupLabel}
                        groupIcon={TOOL_GROUPS.insert.groupIcon}
                        tools={TOOL_GROUPS.insert.tools}
                        activeTool={activeTool}
                        currentDefault={groupDefaults.insert}
                        onSelect={handleToolSelect}
                    />


                </div>
            </div>

            <SignatureModal
                isOpen={isSignatureModalOpen}
                onClose={() => setIsSignatureModalOpen(false)}
                onSave={handleSignatureSave}
            />
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
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
    const tooltipLabel = groupIcon ? groupLabel : mainTool.label;

    return (
        <div className="relative group/main">
            {/* Main Button - No tooltip needed since flyout provides context */}
            <button
                onClick={() => onSelect(mainTool.id)}
                className={clsx(
                    "w-11 h-11 mx-auto rounded-xl flex items-center justify-center transition-all duration-200 relative",
                    isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                        : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                )}
            >
                <MainIcon size={20} className="relative z-10" />

                {/* Small indicator that there are more tools */}
                <div className="absolute bottom-0.5 right-0.5 opacity-50">
                    <svg width="6" height="6" viewBox="0 0 6 6" fill="currentColor">
                        <path d="M6 6H0L6 0V6Z" />
                    </svg>
                </div>
            </button>

            {/* Flyout Menu (Visible on Hover of the entire container) */}
            <div className="absolute left-full top-0 ml-3 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl p-1.5 flex flex-col gap-1 min-w-[140px] opacity-0 invisible translate-x-[-10px] group-hover/main:opacity-100 group-hover/main:visible group-hover/main:translate-x-0 transition-all duration-200 z-50">
                <div className="text-[10px] uppercase font-bold text-zinc-500 px-2 py-1 tracking-wider mb-0.5">{groupLabel}</div>
                {tools.map(tool => (
                    <button
                        key={tool.id}
                        onClick={(e) => { e.stopPropagation(); onSelect(tool.id); }}
                        className={clsx(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left",
                            activeTool === tool.id
                                ? "bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/30"
                                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                        )}
                    >
                        <tool.icon size={16} />
                        <span>{tool.label}</span>
                        {tool.shortcut && <span className="ml-auto text-[10px] text-zinc-600">{tool.shortcut}</span>}
                        {activeTool === tool.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />}
                    </button>
                ))}
            </div>
        </div>
    );
};

