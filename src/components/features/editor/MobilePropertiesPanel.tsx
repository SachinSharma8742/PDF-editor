import React, { useState } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { X, Sliders, Layers, Palette, Type, AlignLeft, AlignCenter, AlignRight, Bold, Italic } from 'lucide-react';
import clsx from 'clsx';
import { LayerPanel } from './LayerPanel';

interface MobilePropertiesPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

type MobileTab = 'tools' | 'properties' | 'layers' | 'text';

export const MobilePropertiesPanel: React.FC<MobilePropertiesPanelProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<MobileTab>('properties');
    const {
        toolPreferences,
        activeTool,
        updateToolSettings,
        recentColors,
        addColorToHistory
    } = useEditorStore();

    const currentSettings = toolPreferences[activeTool];
    const textSettings = toolPreferences['text'];
    const isTextTool = activeTool === 'text';

    // Dynamic tabs based on active tool
    const tabs = isTextTool
        ? [
            { id: 'text' as MobileTab, icon: Type, label: 'Text' },
            { id: 'layers' as MobileTab, icon: Layers, label: 'Layers' }
        ]
        : [
            { id: 'tools' as MobileTab, icon: Palette, label: 'Tools' },
            { id: 'properties' as MobileTab, icon: Sliders, label: 'Properties' },
            { id: 'layers' as MobileTab, icon: Layers, label: 'Layers' }
        ];

    const PRESET_COLORS = [
        '#3B82F6', // Blue
        '#EF4444', // Red
        '#22C55E', // Green
        '#000000', // Black
        '#FACC15', // Yellow
        '#F97316', // Orange
    ];

    const FONT_OPTIONS = ['Inter', 'Arial', 'Times New Roman', 'Georgia', 'Verdana'];

    // Auto-switch to text tab when text tool becomes active
    React.useEffect(() => {
        if (isTextTool && activeTab !== 'text' && activeTab !== 'layers') {
            setActiveTab('text');
        } else if (!isTextTool && activeTab === 'text') {
            setActiveTab('properties');
        }
    }, [isTextTool, activeTab]);

    if (!isOpen) return null;

    const handleTextUpdate = (updates: Partial<typeof textSettings>) => {
        // When text tool is active, update text tool preferences
        const currentTool = activeTool;
        const currentPrefs = toolPreferences[currentTool];
        Object.keys(updates).forEach(key => {
            updateToolSettings({ [key]: (updates as any)[key] });
        });
    };

    return (
        <div className="md:hidden fixed inset-x-0 bottom-[76px] z-40 px-3">
            <div className="bg-zinc-900/98 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                {/* Header with Tabs */}
                <div className="flex items-center border-b border-white/5">
                    <div className="flex-1 flex">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={clsx(
                                    "flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-wider transition-all",
                                    activeTab === tab.id
                                        ? "text-blue-400 border-b-2 border-blue-500 bg-blue-500/5"
                                        : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                <tab.icon size={14} />
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 text-zinc-500 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content Area */}
                <div className="p-4 max-h-[45vh] overflow-y-auto custom-scrollbar">
                    {/* Text Properties Tab */}
                    {activeTab === 'text' && (
                        <div className="space-y-4">
                            {/* Font Family */}
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">
                                    Font
                                </label>
                                <select
                                    value={textSettings?.fontFamily || 'Inter'}
                                    onChange={(e) => handleTextUpdate({ fontFamily: e.target.value })}
                                    className="w-full bg-zinc-800 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500"
                                >
                                    {FONT_OPTIONS.map(font => (
                                        <option key={font} value={font}>{font}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Font Size */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                        Size
                                    </label>
                                    <span className="text-xs font-mono text-blue-400">
                                        {textSettings?.fontSize || 16}px
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min={8}
                                    max={72}
                                    step={1}
                                    value={textSettings?.fontSize || 16}
                                    onChange={(e) => handleTextUpdate({ fontSize: Number(e.target.value) })}
                                    className="w-full h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-blue-500
                                        [&::-webkit-slider-thumb]:appearance-none
                                        [&::-webkit-slider-thumb]:w-5
                                        [&::-webkit-slider-thumb]:h-5
                                        [&::-webkit-slider-thumb]:rounded-full
                                        [&::-webkit-slider-thumb]:bg-blue-500
                                        [&::-webkit-slider-thumb]:shadow-lg
                                        [&::-webkit-slider-thumb]:cursor-pointer"
                                />
                            </div>

                            {/* Text Style Buttons */}
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">
                                    Style
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleTextUpdate({
                                            fontWeight: textSettings?.fontWeight === 'bold' ? 'normal' : 'bold'
                                        })}
                                        className={clsx(
                                            "flex-1 py-2 rounded-xl border transition-all flex items-center justify-center gap-2",
                                            textSettings?.fontWeight === 'bold'
                                                ? "bg-blue-600 border-blue-500 text-white"
                                                : "bg-zinc-800 border-white/10 text-zinc-400 hover:text-white"
                                        )}
                                    >
                                        <Bold size={16} />
                                        <span className="text-xs font-semibold">Bold</span>
                                    </button>
                                    <button
                                        onClick={() => handleTextUpdate({
                                            fontStyle: textSettings?.fontStyle === 'italic' ? 'normal' : 'italic'
                                        })}
                                        className={clsx(
                                            "flex-1 py-2 rounded-xl border transition-all flex items-center justify-center gap-2",
                                            textSettings?.fontStyle === 'italic'
                                                ? "bg-blue-600 border-blue-500 text-white"
                                                : "bg-zinc-800 border-white/10 text-zinc-400 hover:text-white"
                                        )}
                                    >
                                        <Italic size={16} />
                                        <span className="text-xs font-semibold">Italic</span>
                                    </button>
                                </div>
                            </div>

                            {/* Text Alignment */}
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">
                                    Align
                                </label>
                                <div className="flex gap-2">
                                    {[
                                        { align: 'left', icon: AlignLeft },
                                        { align: 'center', icon: AlignCenter },
                                        { align: 'right', icon: AlignRight }
                                    ].map(({ align, icon: Icon }) => (
                                        <button
                                            key={align}
                                            onClick={() => handleTextUpdate({ textAlign: align as 'left' | 'center' | 'right' })}
                                            className={clsx(
                                                "flex-1 py-2 rounded-xl border transition-all flex items-center justify-center",
                                                textSettings?.textAlign === align
                                                    ? "bg-blue-600 border-blue-500 text-white"
                                                    : "bg-zinc-800 border-white/10 text-zinc-400 hover:text-white"
                                            )}
                                        >
                                            <Icon size={18} />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Text Color */}
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">
                                    Color
                                </label>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {PRESET_COLORS.map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => {
                                                handleTextUpdate({ color });
                                                addColorToHistory(color);
                                            }}
                                            className={clsx(
                                                "w-9 h-9 rounded-full border-2 transition-all hover:scale-110 active:scale-95",
                                                textSettings?.color === color
                                                    ? "border-white shadow-lg"
                                                    : "border-transparent"
                                            )}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'tools' && (
                        <div className="space-y-4">
                            {/* Color Picker */}
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">
                                    Color
                                </label>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {PRESET_COLORS.map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => {
                                                updateToolSettings({ color });
                                                addColorToHistory(color);
                                            }}
                                            className={clsx(
                                                "w-9 h-9 rounded-full border-2 transition-all hover:scale-110 active:scale-95",
                                                currentSettings?.color === color
                                                    ? "border-white shadow-lg"
                                                    : "border-transparent"
                                            )}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                    <div className="w-px h-6 bg-white/10 mx-1" />
                                    {recentColors.slice(0, 3).map((color, idx) => (
                                        <button
                                            key={`recent-${idx}`}
                                            onClick={() => updateToolSettings({ color })}
                                            className="w-7 h-7 rounded-full border border-white/20 transition-all hover:scale-110"
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'properties' && (
                        <div className="space-y-5">
                            {/* Stroke Width */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                        Stroke
                                    </label>
                                    <span className="text-xs font-mono text-blue-400">
                                        {currentSettings?.size || 3}px
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min={1}
                                    max={20}
                                    step={1}
                                    value={currentSettings?.size || 3}
                                    onChange={(e) => updateToolSettings({ size: Number(e.target.value) })}
                                    className="w-full h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-blue-500
                                        [&::-webkit-slider-thumb]:appearance-none
                                        [&::-webkit-slider-thumb]:w-5
                                        [&::-webkit-slider-thumb]:h-5
                                        [&::-webkit-slider-thumb]:rounded-full
                                        [&::-webkit-slider-thumb]:bg-blue-500
                                        [&::-webkit-slider-thumb]:shadow-lg
                                        [&::-webkit-slider-thumb]:cursor-pointer"
                                />
                            </div>

                            {/* Opacity */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                        Opacity
                                    </label>
                                    <span className="text-xs font-mono text-blue-400">
                                        {Math.round((currentSettings?.opacity ?? 1) * 100)}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    value={currentSettings?.opacity ?? 1}
                                    onChange={(e) => updateToolSettings({ opacity: Number(e.target.value) })}
                                    className="w-full h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-blue-500
                                        [&::-webkit-slider-thumb]:appearance-none
                                        [&::-webkit-slider-thumb]:w-5
                                        [&::-webkit-slider-thumb]:h-5
                                        [&::-webkit-slider-thumb]:rounded-full
                                        [&::-webkit-slider-thumb]:bg-blue-500
                                        [&::-webkit-slider-thumb]:shadow-lg
                                        [&::-webkit-slider-thumb]:cursor-pointer"
                                />
                            </div>

                            {/* Color Row */}
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">
                                    Color
                                </label>
                                <div className="flex items-center gap-2">
                                    {PRESET_COLORS.slice(0, 6).map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => {
                                                updateToolSettings({ color });
                                                addColorToHistory(color);
                                            }}
                                            className={clsx(
                                                "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                                                currentSettings?.color === color
                                                    ? "border-white ring-2 ring-white/30"
                                                    : "border-white/10"
                                            )}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                    <button
                                        className="w-8 h-8 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center text-zinc-500 hover:text-white hover:border-white/40 transition-all"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'layers' && (
                        <div className="min-h-[200px]">
                            <LayerPanel />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

