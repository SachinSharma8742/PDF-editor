import React from 'react';
import { Palette } from 'lucide-react';
import clsx from 'clsx';
import type { ToolType } from '../../../store/pdfStore';

interface LeftColorPanelProps {
    activeTool: ToolType;
    toolPreferences: any;
    updateToolSettings: (settings: any) => void;
    hasSelection: boolean;
    selectedObj: any;
    recentColors: string[];
    onColorPick: (color: string) => void;
    selectedObjectIds: string[];
    updateObject: (id: string, updates: any) => void;
}

export const LeftColorPanel: React.FC<LeftColorPanelProps> = ({
    activeTool, toolPreferences, updateToolSettings, hasSelection, selectedObj,
    recentColors, onColorPick, selectedObjectIds, updateObject
}) => {
    const currentSettings = toolPreferences[activeTool];

    return (
        <div className="flex-col flex h-full overflow-y-auto custom-scrollbar p-5 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
                <span className="text-xs font-black text-zinc-100 uppercase tracking-widest">
                    Colors
                </span>
            </div>

            {/* Shape Fill (Selection Only) */}
            {(hasSelection && selectedObj && ['rectangle', 'circle', 'triangle', 'star', 'polygon', 'ellipse'].includes(selectedObj.type)) && (
                <div className="space-y-4">
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
                                {/* 9 Color Slots for Fill */}
                                {[...Array(9)].map((_, i) => {
                                    const color = recentColors[i];
                                    return (
                                        <div key={i} className="aspect-square relative flex items-center justify-center">
                                            {color ? (
                                                <button
                                                    onClick={() => updateObject(selectedObj.id, { fill: color })}
                                                    className={clsx(
                                                        "w-full h-full rounded-md border border-white/10 hover:border-white/50 transition-all shadow-sm",
                                                        selectedObj.fill === color && "ring-2 ring-blue-500 ring-offset-1 ring-offset-[#121214]"
                                                    )}
                                                    style={{ backgroundColor: color }}
                                                />
                                            ) : (
                                                <div className="w-full h-full rounded-md border border-dashed border-white/5 bg-white/[0.02]" />
                                            )}
                                        </div>
                                    );
                                })}

                                {/* 10th Slot: Add Color Button for Fill */}
                                <div className="relative aspect-square rounded-md overflow-hidden border border-white/20 group cursor-pointer bg-zinc-800 hover:bg-zinc-700 transition-colors flex items-center justify-center shadow-lg">
                                    <input
                                        type="color"
                                        value={selectedObj.fill || '#000000'}
                                        onChange={(e) => updateObject(selectedObj.id, { fill: e.target.value })}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div className="text-zinc-400 group-hover:text-white transition-colors">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="12" y1="5" x2="12" y2="19"></line>
                                            <line x1="5" y1="12" x2="19" y2="12"></line>
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* General Color Palette (Text & Stroke) */}
            {activeTool !== 'eraser' && activeTool !== 'image' && activeTool !== 'pan' && (
                <div className="space-y-4">
                    <SectionLabel label={hasSelection && selectedObj?.type === 'text' ? "Text Color" : "Stroke Color"} icon={<Palette size={12} />} />

                    {/* Color Grid (2 Rows of 5 = 10 slots) */}
                    <div className="grid grid-cols-5 gap-2">
                        {/* 9 Color Slots */}
                        {[...Array(9)].map((_, i) => {
                            const color = recentColors[i];
                            return (
                                <div key={i} className="aspect-square relative flex items-center justify-center">
                                    {color ? (
                                        <button
                                            onClick={() => {
                                                updateToolSettings({ color });
                                                if (activeTool === 'select' && hasSelection && selectedObj) {
                                                    const key = selectedObj.type === 'text' ? 'fill' : 'stroke';
                                                    updateObject(selectedObj.id, { [key]: color });
                                                }
                                            }}
                                            className={clsx(
                                                "w-full h-full rounded-full border border-white/10 hover:border-white/50 transition-all shadow-sm",
                                                currentSettings.color === color && "ring-2 ring-blue-500 ring-offset-1 ring-offset-[#121214]"
                                            )}
                                            style={{ backgroundColor: color }}
                                            title={color}
                                        />
                                    ) : (
                                        // Empty Slot Placeholder
                                        <div className="w-full h-full rounded-full border border-dashed border-white/5 bg-white/[0.02]" />
                                    )}
                                </div>
                            );
                        })}

                        {/* 10th Slot: Add Color Button */}
                        <div className="relative aspect-square rounded-full overflow-hidden border border-white/20 group cursor-pointer bg-zinc-800 hover:bg-zinc-700 transition-colors flex items-center justify-center shadow-lg">
                            <input
                                type="color"
                                value={currentSettings.color || '#000000'}
                                onChange={(e) => {
                                    const c = e.target.value;
                                    updateToolSettings({ color: c });
                                    if (activeTool === 'select' && hasSelection && selectedObj) {
                                        const key = selectedObj.type === 'text' ? 'fill' : 'stroke';
                                        updateObject(selectedObj.id, { [key]: c });
                                    }
                                    onColorPick(c); // Update history
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                title="Add custom color"
                            />
                            <div className="text-zinc-400 group-hover:text-white transition-colors">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Smart Drawing Toggle (Pen Only) */}
            {activeTool === 'pen' && (
                <div className="space-y-3 pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between">
                        <SectionLabel label="Smart Drawing" icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>} />
                        <button
                            onClick={() => updateToolSettings({ smartShapeMode: !currentSettings.smartShapeMode })}
                            className={clsx(
                                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#121214]",
                                currentSettings.smartShapeMode ? 'bg-blue-600' : 'bg-zinc-700'
                            )}
                        >
                            <span
                                className={clsx(
                                    "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                                    currentSettings.smartShapeMode ? 'translate-x-4.5' : 'translate-x-1'
                                )}
                            />
                        </button>
                    </div>
                    {currentSettings.smartShapeMode && (
                        <p className="text-[10px] text-zinc-500 leading-tight">
                            Auto-detects shapes like circles, rectangles, and straight lines.
                        </p>
                    )}
                </div>
            )}

            {/* Stroke Width Slider */}
            {(
                (['pen', 'highlighter', 'eraser', 'rectangle', 'circle', 'triangle', 'star', 'polygon', 'ellipse', 'arrow', 'line'].includes(activeTool)) ||
                (hasSelection && selectedObj && ['path', 'rectangle', 'circle', 'triangle', 'star', 'polygon', 'ellipse', 'arrow', 'line'].includes(selectedObj.type))
            ) && (
                    <>
                        <div className="space-y-3 pt-2">
                            <SectionLabel label="Stroke Width" icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /></svg>} />
                            <div className="flex items-center gap-3">
                                <div className="flex-1 relative h-6 flex items-center">
                                    {/* Track */}
                                    <div className="absolute inset-x-0 h-1 bg-zinc-800 rounded-full"></div>
                                    {/* Input */}
                                    <input
                                        type="range"
                                        min="1"
                                        max={activeTool === 'highlighter' ? 40 : 20}
                                        step="1"
                                        value={hasSelection && selectedObj ? (selectedObj.strokeWidth ?? 1) : currentSettings.size}
                                        onChange={(e) => {
                                            const val = Number(e.target.value);
                                            if (hasSelection && selectedObj) {
                                                updateObject(selectedObj.id, { strokeWidth: val });
                                            } else {
                                                updateToolSettings({ size: val });
                                            }
                                        }}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    {/* Custom Thumb/Fill for Visuals */}
                                    <div
                                        className="absolute h-1 bg-blue-500 rounded-full pointer-events-none"
                                        style={{ width: `${((hasSelection && selectedObj ? (selectedObj.strokeWidth ?? 1) : currentSettings.size) / (activeTool === 'highlighter' ? 40 : 20)) * 100}%` }}
                                    />
                                    <div
                                        className="absolute w-4 h-4 bg-white rounded-full shadow-md pointer-events-none transition-transform active:scale-110"
                                        style={{
                                            left: `${((hasSelection && selectedObj ? (selectedObj.strokeWidth ?? 1) : currentSettings.size) / (activeTool === 'highlighter' ? 40 : 20)) * 100}%`,
                                            transform: 'translateX(-50%)'
                                        }}
                                    />
                                </div>
                                <div className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-md border border-white/5">
                                    <span className="text-xs font-mono text-zinc-300">
                                        {hasSelection && selectedObj ? (selectedObj.strokeWidth ?? 1) : currentSettings.size}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Opacity Slider */}
                        <div className="space-y-3 pt-4">
                            <SectionLabel label="Opacity" icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" opacity="0.3" /><circle cx="12" cy="12" r="6" /></svg>} />
                            <div className="flex items-center gap-3">
                                <div className="flex-1 relative h-6 flex items-center">
                                    <div className="absolute inset-x-0 h-1 bg-zinc-800 rounded-full"></div>
                                    <input
                                        type="range"
                                        min="0.1"
                                        max="1"
                                        step="0.01"
                                        value={hasSelection && selectedObj ? (selectedObj.opacity ?? 1) : (currentSettings.opacity ?? 1)}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            if (hasSelection && selectedObj) {
                                                updateObject(selectedObj.id, { opacity: val });
                                            } else {
                                                updateToolSettings({ opacity: val });
                                            }
                                        }}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div
                                        className="absolute h-1 bg-blue-500 rounded-full pointer-events-none"
                                        style={{ width: `${(hasSelection && selectedObj ? (selectedObj.opacity ?? 1) : (currentSettings.opacity ?? 1)) * 100}%` }}
                                    />
                                    <div
                                        className="absolute w-4 h-4 bg-white rounded-full shadow-md pointer-events-none transition-transform active:scale-110"
                                        style={{
                                            left: `${(hasSelection && selectedObj ? (selectedObj.opacity ?? 1) : (currentSettings.opacity ?? 1)) * 100}%`,
                                            transform: 'translateX(-50%)'
                                        }}
                                    />
                                </div>
                                <div className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-md border border-white/5">
                                    <span className="text-xs font-mono text-zinc-300">
                                        {Math.round((hasSelection && selectedObj ? (selectedObj.opacity ?? 1) : (currentSettings.opacity ?? 1)) * 100)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Dashed Toggle */}
                        {['rectangle', 'circle', 'triangle', 'star', 'polygon', 'ellipse', 'path', 'line', 'arrow'].includes(selectedObj?.type || activeTool) && (
                            <div className="space-y-3 pt-4 border-t border-white/5">
                                <div className="flex items-center justify-between">
                                    <SectionLabel label="Dashed" icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h2m4 0h2m4 0h2" /></svg>} />
                                    <button
                                        onClick={() => {
                                            if (hasSelection && selectedObj) {
                                                updateObject(selectedObj.id, { dash: selectedObj.dash ? undefined : [10, 5] });
                                            } else {
                                                updateToolSettings({ dash: currentSettings.dash ? undefined : [10, 5] });
                                            }
                                        }}
                                        className={clsx(
                                            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                                            (hasSelection && selectedObj ? (!!selectedObj.dash) : (!!currentSettings.dash)) ? 'bg-blue-600' : 'bg-zinc-700'
                                        )}
                                    >
                                        <span
                                            className={clsx(
                                                "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                                                (hasSelection && selectedObj ? (!!selectedObj.dash) : (!!currentSettings.dash)) ? 'translate-x-4.5' : 'translate-x-1'
                                            )}
                                        />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Shape Specific: Sides (Polygon/Star) */}
                        {(
                            (activeTool === 'polygon' || activeTool === 'star') ||
                            (hasSelection && selectedObj && (selectedObj.type === 'polygon' || selectedObj.type === 'star'))
                        ) && (
                                <div className="space-y-3 pt-4 border-t border-white/5">
                                    <SectionLabel label="Sides" icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>} />
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min="3"
                                            max="12"
                                            step="1"
                                            value={hasSelection && selectedObj ? (selectedObj.sides || 5) : (currentSettings.sides || 5)}
                                            onChange={(e) => {
                                                const val = Number(e.target.value);
                                                if (hasSelection && selectedObj) {
                                                    updateObject(selectedObj.id, { sides: val });
                                                } else {
                                                    updateToolSettings({ sides: val });
                                                }
                                            }}
                                            className="flex-1 accent-blue-500"
                                        />
                                        <span className="text-xs font-mono text-zinc-300 w-4">
                                            {hasSelection && selectedObj ? (selectedObj.sides || 5) : (currentSettings.sides || 5)}
                                        </span>
                                    </div>
                                </div>
                            )}

                        {/* Shape Specific: Inner Radius (Star Only) */}
                        {(
                            (activeTool === 'star') ||
                            (hasSelection && selectedObj && selectedObj.type === 'star')
                        ) && (
                                <div className="space-y-3 pt-4 border-t border-white/5">
                                    <SectionLabel label="Inner Radius" icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /></svg>} />
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min="0.1"
                                            max="1"
                                            step="0.05"
                                            value={hasSelection && selectedObj ? ((selectedObj.innerRadius / (selectedObj.width / 2)) || 0.5) : (currentSettings.innerRadiusRatio || 0.5)}
                                            onChange={(e) => {
                                                const ratio = parseFloat(e.target.value);
                                                if (hasSelection && selectedObj) {
                                                    const radius = (selectedObj.width / 2) * ratio;
                                                    updateObject(selectedObj.id, { innerRadius: radius });
                                                } else {
                                                    updateToolSettings({ innerRadiusRatio: ratio });
                                                }
                                            }}
                                            className="flex-1 accent-blue-500"
                                        />
                                    </div>
                                </div>
                            )}

                        {/* Typography Section */}
                        {(activeTool === 'text' || (hasSelection && selectedObj?.type === 'text')) && (
                            <div className="space-y-4 pt-4 border-t border-white/5">
                                <SectionLabel label="Typography" icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3M9 20h6M12 4v16" /></svg>} />
                                <div className="grid grid-cols-2 gap-2">
                                    <select
                                        value={hasSelection && selectedObj ? (selectedObj.fontFamily || 'Inter') : (currentSettings.fontFamily || 'Inter')}
                                        onChange={(e) => {
                                            if (hasSelection && selectedObj) updateObject(selectedObj.id, { fontFamily: e.target.value });
                                            else updateToolSettings({ fontFamily: e.target.value });
                                        }}
                                        className="col-span-2 bg-zinc-800 border border-white/10 rounded-lg p-2 text-[10px] text-zinc-300 outline-none focus:border-blue-500/50"
                                    >
                                        <option value="Inter">Inter</option>
                                        <option value="Arial">Arial</option>
                                        <option value="Times New Roman">Times</option>
                                        <option value="Courier New">Courier</option>
                                    </select>
                                    <div className="flex items-center gap-2 bg-zinc-800 border border-white/10 rounded-lg px-2 py-1">
                                        <span className="text-[9px] font-black text-zinc-500">PX</span>
                                        <input
                                            type="number"
                                            value={hasSelection && selectedObj ? (selectedObj.fontSize || 16) : (currentSettings.fontSize || 16)}
                                            onChange={(e) => {
                                                const val = Number(e.target.value);
                                                if (hasSelection && selectedObj) updateObject(selectedObj.id, { fontSize: val });
                                                else updateToolSettings({ fontSize: val });
                                            }}
                                            className="w-full bg-transparent text-[10px] text-zinc-300 outline-none text-right"
                                        />
                                    </div>
                                    <select
                                        value={hasSelection && selectedObj ? (selectedObj.fontWeight || 'normal') : (currentSettings.fontWeight || 'normal')}
                                        onChange={(e) => {
                                            if (hasSelection && selectedObj) updateObject(selectedObj.id, { fontWeight: e.target.value });
                                            else updateToolSettings({ fontWeight: e.target.value });
                                        }}
                                        className="bg-zinc-800 border border-white/10 rounded-lg p-2 text-[10px] text-zinc-300 outline-none focus:border-blue-500/50"
                                    >
                                        <option value="normal">Regular</option>
                                        <option value="500">Medium</option>
                                        <option value="bold">Bold</option>
                                    </select>

                                    {/* Text Align */}
                                    <div className="col-span-2 grid grid-cols-3 gap-1 bg-zinc-800 border border-white/10 rounded-lg p-1">
                                        <button
                                            onClick={() => {
                                                if (hasSelection && selectedObj) updateObject(selectedObj.id, { align: 'left' });
                                                else updateToolSettings({ align: 'left' }); // Need to add align to toolSettings defaults if not present
                                            }}
                                            className={clsx(
                                                "flex items-center justify-center p-1 rounded hover:bg-white/10 transition-all",
                                                (hasSelection && selectedObj ? selectedObj.align === 'left' : currentSettings.align === 'left') && "bg-white/20 text-white"
                                            )}
                                            title="Align Left"
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="17" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (hasSelection && selectedObj) updateObject(selectedObj.id, { align: 'center' });
                                                else updateToolSettings({ align: 'center' });
                                            }}
                                            className={clsx(
                                                "flex items-center justify-center p-1 rounded hover:bg-white/10 transition-all",
                                                (hasSelection && selectedObj ? selectedObj.align === 'center' : currentSettings.align === 'center') && "bg-white/20 text-white"
                                            )}
                                            title="Align Center"
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="10" x2="6" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="18" y1="18" x2="6" y2="18"></line></svg>
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (hasSelection && selectedObj) updateObject(selectedObj.id, { align: 'right' });
                                                else updateToolSettings({ align: 'right' });
                                            }}
                                            className={clsx(
                                                "flex items-center justify-center p-1 rounded hover:bg-white/10 transition-all",
                                                (hasSelection && selectedObj ? selectedObj.align === 'right' : currentSettings.align === 'right') && "bg-white/20 text-white"
                                            )}
                                            title="Align Right"
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="10" x2="7" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="21" y1="18" x2="7" y2="18"></line></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

            {/* Fallback for tools that have no color options (e.g. Eraser, Image, Pan) */}
            {(activeTool === 'image' || activeTool === 'pan') && (
                <div className="flex flex-col items-center justify-center py-10 opacity-30 text-center">
                    <Palette size={24} className="mb-2" />
                    <span className="text-[10px] uppercase font-bold">No Color Options</span>
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
