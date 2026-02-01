import React, { useRef, useState, useEffect } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import type { ToolType } from '../../../store/pdfStore';
import {
    MousePointerClick, Move, RectangleHorizontal, CircleDot, TypeOutline, ImagePlus,
    PenTool, Brush, EraserIcon, Trash2, Copy, BringToFront, SendToBack,
    Bold, Italic, AlignLeft, AlignCenter, AlignRight,
    Palette, ChevronRight, Pipette, Hash, PlusCircle, Shapes
} from 'lucide-react';
import clsx from 'clsx';
import { Tooltip } from '../../ui/Tooltip';

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
        ]
    },
    shapes: {
        groupLabel: 'Shapes',
        groupIcon: Shapes,
        tools: [
            { id: 'rectangle', icon: RectangleHorizontal, label: 'Rectangle', shortcut: 'R' },
            { id: 'circle', icon: CircleDot, label: 'Circle', shortcut: 'O' },
        ]
    },
    insert: {
        groupLabel: 'Insert',
        groupIcon: PlusCircle,
        tools: [
            { id: 'text', icon: TypeOutline, label: 'Text', shortcut: 'T' },
            { id: 'image', icon: ImagePlus, label: 'Image', shortcut: 'I' },
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
    const {
        activeTool, setActiveTool, addObject, toolPreferences, updateToolSettings,
        selectedObjectIds, deleteObjects, currentPage, updateObject,
        recentColors, addColorToHistory
    } = useEditorStore();

    const imageInputRef = useRef<HTMLInputElement>(null);
    const fallbackColorInputRef = useRef<HTMLInputElement>(null);
    const [eyedropperActive, setEyedropperActive] = useState(false);

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
        } else {
            setActiveTool(toolId);
        }
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

    // Properties Panel Logic
    const showProperties = ['pen', 'highlighter', 'eraser', 'text', 'rectangle', 'circle'].includes(activeTool) || (activeTool === 'select' && hasSelection);

    return (
        <div className="flex h-full relative z-30 font-sans select-none flex-shrink-0">
            {/* --- MAIN VERTICAL TOOLBAR --- */}
            <div className="w-18 bg-[#09090b] border-r border-white/5 flex flex-col items-center py-4 gap-4 shadow-2xl z-20 flex-shrink-0">
                {/* Active Tool Indicator */}
                {(() => {
                    // Get the icon for the current active tool
                    const ActiveIcon = eyedropperActive ? Pipette : getToolIcon(activeTool);
                    return (
                        <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-500 flex items-center justify-center mb-2 ring-1 ring-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all duration-200">
                            <ActiveIcon size={18} />
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
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group relative mx-auto",
                            eyedropperActive ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
                        )}
                    >
                        <Pipette size={20} />
                        {/* Current Color Indicator Dot */}
                        <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full ring-1 ring-[#09090b]" style={{ backgroundColor: currentSettings?.color || '#000' }} />
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

            {/* --- PROPERTIES DRAWER (Absolute Overlay - doesn't push layout) --- */}
            {showProperties && (
                <div className="absolute left-[72px] top-0 bottom-0 w-64 bg-[#121214]/98 backdrop-blur-xl border-r border-white/5 flex flex-col animate-in slide-in-from-left-2 duration-300 z-10 shadow-2xl">
                    <PropertiesPanel
                        activeTool={activeTool}
                        toolPreferences={toolPreferences}
                        updateToolSettings={updateToolSettings}
                        hasSelection={hasSelection}
                        selectedObj={selectedObj}
                        recentColors={recentColors}
                        onColorPick={(c) => {
                            updateToolSettings({ color: c });
                            addColorToHistory(c);
                        }}
                        selectedObjectIds={selectedObjectIds}
                        updateObject={updateObject}
                        deleteObjects={deleteObjects}
                    />
                </div>
            )}

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

// Cleaned up Properties Panel (Extracted for readability)
interface PropertiesPanelProps {
    activeTool: ToolType;
    toolPreferences: any;
    updateToolSettings: (settings: any) => void;
    hasSelection: boolean;
    selectedObj: any;
    recentColors: string[];
    onColorPick: (color: string) => void;
    selectedObjectIds: string[];
    updateObject: (id: string, updates: any) => void;
    deleteObjects: (ids: string[]) => void;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
    activeTool, toolPreferences, updateToolSettings, hasSelection, selectedObj,
    recentColors, onColorPick, selectedObjectIds, updateObject, deleteObjects
}) => {
    const currentSettings = toolPreferences[activeTool];

    return (
        <div className="flex-col flex h-full overflow-y-auto custom-scrollbar p-5 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
                <span className="text-xs font-black text-zinc-100 uppercase tracking-widest">
                    {activeTool === 'select' && hasSelection ? selectedObj?.type || 'Selection' : activeTool}
                </span>
            </div>

            {/* Opacity Slider */}
            {/* Show for Image tool, or if we have a selection (Image/Shape/Text) */}
            {(activeTool === 'image' || (hasSelection && selectedObj)) && (
                <div className="space-y-3">
                    <SectionLabel label="Opacity" icon={<Hash size={12} />} />
                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={Math.round((hasSelection && selectedObj ? (selectedObj.opacity ?? 1) : (currentSettings.opacity ?? 1)) * 100)}
                            onChange={(e) => {
                                const val = Number(e.target.value) / 100;
                                if (hasSelection && selectedObj) {
                                    updateObject(selectedObj.id, { opacity: val });
                                } else {
                                    updateToolSettings({ opacity: val });
                                }
                            }}
                            className="flex-1 h-1 bg-zinc-700 rounded-full appearance-none accent-blue-500"
                        />
                        <span className="text-xs font-mono text-zinc-500 w-8 text-right">
                            {Math.round((hasSelection && selectedObj ? (selectedObj.opacity ?? 1) : (currentSettings.opacity ?? 1)) * 100)}%
                        </span>
                    </div>
                </div>
            )}

            {/* Shape Fill (Selection Only) */}
            {/* We only allow editing Fill for existing shapes, as ToolSettings doesn't support fill preference yet */}
            {(hasSelection && selectedObj && ['rectangle', 'circle'].includes(selectedObj.type)) && (
                <div className="space-y-4 pt-4 border-t border-white/5">
                    {/* Fill Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <SectionLabel label="Fill" icon={<Palette size={12} />} />
                            <button
                                onClick={() => updateObject(selectedObj.id, { fill: selectedObj.fill === 'transparent' ? '#000000' : 'transparent' })}
                                className={clsx(
                                    "text-[10px] font-bold px-2 py-1 rounded border transition-all flex items-center gap-1.5",
                                    selectedObj.fill === 'transparent'
                                        ? "bg-blue-600/20 text-blue-400 border-blue-500/30"
                                        : "bg-zinc-800 text-zinc-400 border-white/5 hover:bg-zinc-700"
                                )}
                            >
                                <div className={clsx("w-3 h-3 rounded-sm border", selectedObj.fill === 'transparent' ? "border-blue-400 bg-transparent" : "border-zinc-500 bg-white")} />
                                NO FILL
                            </button>
                        </div>

                        {selectedObj.fill !== 'transparent' && (
                            <div className="grid grid-cols-5 gap-2">
                                {recentColors.slice(0, 5).map((color: string, i: number) => (
                                    <button
                                        key={i}
                                        onClick={() => updateObject(selectedObj.id, { fill: color })}
                                        className={clsx(
                                            "aspect-square rounded-md border border-white/10 hover:border-white/50 transition-all",
                                            selectedObj.fill === color && "ring-2 ring-blue-500 ring-offset-2 ring-offset-[#121214]"
                                        )}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                                <div className="relative aspect-square rounded-md overflow-hidden border border-white/10 group">
                                    <input
                                        type="color"
                                        value={selectedObj.fill || '#000000'}
                                        onChange={(e) => updateObject(selectedObj.id, { fill: e.target.value })}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Color Palette (Text & Stroke) */}
            {activeTool !== 'eraser' && activeTool !== 'image' && activeTool !== 'pan' && (
                <div className="space-y-3">
                    <SectionLabel label="Colors" icon={<Palette size={12} />} />
                    <div className="grid grid-cols-5 gap-2">
                        {recentColors.slice(0, 10).map((color: string, i: number) => (
                            <button
                                key={i}
                                onClick={() => {
                                    updateToolSettings({ color });
                                    if (activeTool === 'select' && hasSelection && selectedObj) {
                                        const key = selectedObj.type === 'text' ? 'fill' : 'stroke';
                                        updateObject(selectedObj.id, { [key]: color });
                                    }
                                }}
                                className={clsx(
                                    "aspect-square rounded-full border border-white/10 hover:border-white/50 transition-all",
                                    currentSettings.color === color && "ring-2 ring-blue-500 ring-offset-2 ring-offset-[#121214]"
                                )}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Typography */}
            {activeTool === 'text' && (
                <div className="space-y-4">
                    <SectionLabel label="Typography" icon={<TypeOutline size={12} />} />
                    <div className="space-y-3">
                        <select
                            className="w-full bg-[#18181b] border border-white/10 rounded-lg h-9 text-xs text-zinc-300 px-2 outline-none focus:border-blue-500"
                            value={currentSettings.fontFamily}
                            onChange={(e) => updateToolSettings({ fontFamily: e.target.value })}
                        >
                            {['Inter', 'Arial', 'Times New Roman', 'Courier New'].map(f => <option key={f} value={f}>{f}</option>)}
                        </select>

                        <div className="flex gap-2">
                            <input
                                type="number"
                                className="flex-1 bg-[#18181b] border border-white/10 rounded-lg h-9 text-xs text-zinc-300 px-2 text-center outline-none focus:border-blue-500"
                                value={currentSettings.fontSize}
                                onChange={(e) => updateToolSettings({ fontSize: Number(e.target.value) })}
                            />
                            <div className="flex bg-[#18181b] border border-white/10 rounded-lg p-1">
                                <button
                                    onClick={() => updateToolSettings({ fontWeight: currentSettings.fontWeight === 'bold' ? 'normal' : 'bold' })}
                                    className={clsx("p-1.5 rounded hover:bg-white/10", currentSettings.fontWeight === 'bold' && "text-blue-400")}
                                >
                                    <Bold size={14} />
                                </button>
                                <button
                                    onClick={() => updateToolSettings({ fontStyle: currentSettings.fontStyle === 'italic' ? 'normal' : 'italic' })}
                                    className={clsx("p-1.5 rounded hover:bg-white/10", currentSettings.fontStyle === 'italic' && "text-blue-400")}
                                >
                                    <Italic size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Stroke / Size */}
            {['pen', 'highlighter', 'eraser'].includes(activeTool) && (
                <div className="space-y-3">
                    <SectionLabel label="Stroke" icon={<Hash size={12} />} />
                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min="1"
                            max={activeTool === 'highlighter' ? 40 : 20}
                            value={currentSettings.size}
                            onChange={(e) => updateToolSettings({ size: Number(e.target.value) })}
                            className="flex-1 h-1 bg-zinc-700 rounded-full appearance-none accent-blue-500"
                        />
                        <span className="text-xs font-mono text-zinc-500 w-6">{currentSettings.size}</span>
                    </div>
                </div>
            )}

            {/* Actions for Selection */}
            {activeTool === 'select' && hasSelection && (
                <div className="space-y-3 pt-4 border-t border-white/5">
                    <SectionLabel label="Actions" />
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => updateObject(selectedObjectIds[0], { id: crypto.randomUUID(), x: selectedObj.x + 20, y: selectedObj.y + 20 })} className="flex items-center justify-center gap-2 p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300">
                            <Copy size={14} /> Clone
                        </button>
                        <button onClick={() => deleteObjects(selectedObjectIds)} className="flex items-center justify-center gap-2 p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs text-red-400">
                            <Trash2 size={14} /> Delete
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const SectionLabel = ({ label, icon }: { label: string, icon?: React.ReactNode }) => (
    <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
        {icon} <span>{label}</span>
    </div>
);
