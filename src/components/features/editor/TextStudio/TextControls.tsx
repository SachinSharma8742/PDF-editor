import React from 'react';
import { SimpleInput, Slider, ColorGrid, IconButton, ToggleButton } from '../properties/PropertyComponents';
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, ArrowUp, ArrowDown, Sparkles, History } from 'lucide-react';
import { useEditorStore, TEXT_PRESETS } from '../../../store/editorStore';
import { CollapsibleSection } from '../properties/CollapsibleSection';

interface TextControlsProps {
    activeTab: 'text' | 'properties' | 'effect' | 'etc';
    values: any;
    onChange: (updates: any) => void;
    // Optional: if we need reorder specific actions?
    onReorder?: (direction: 'forward' | 'backward') => void;
}

export const TextControls: React.FC<TextControlsProps> = ({ activeTab, values, onChange, onReorder }) => {
    const { recentTextStyles, addRecentTextStyle, applyTextPreset, toolPreferences } = useEditorStore();

    // Derived values
    const isBold = (values.fontWeight === 'bold') || (values.fontStyle as string)?.includes('bold');
    const isItalic = (values.fontStyle as string)?.includes('italic');
    const isUnderline = (values.textDecoration as string)?.includes('underline');

    const toggleStyle = (type: 'bold' | 'italic' | 'underline') => {
        let newStyle = (values.fontStyle as string) || 'normal';
        let newWeight = values.fontWeight || 'normal';
        let newDecoration = values.textDecoration || '';

        if (type === 'bold') {
            newWeight = isBold ? 'normal' : 'bold';
        }
        if (type === 'italic') {
            const hasItalic = newStyle.includes('italic');
            if (hasItalic) newStyle = newStyle.replace('italic', '').trim();
            else newStyle = `${newStyle} italic`.trim();
        }
        if (type === 'underline') {
            const hasUnderline = newDecoration.includes('underline');
            if (hasUnderline) newDecoration = newDecoration.replace('underline', '').trim();
            else newDecoration = `${newDecoration} underline`.trim();
        }
        if (!newStyle) newStyle = 'normal';

        onChange({
            fontStyle: newStyle,
            fontWeight: newWeight,
            textDecoration: newDecoration
        });
    };

    // Render Logic based on Tab
    if (activeTab === 'text') {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Visual Typography */}
                <div className="space-y-4">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1.5 block">Font</label>
                            <select
                                className="w-full bg-zinc-800 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all appearance-none"
                                value={values.fontFamily || 'Inter'}
                                onChange={(e) => onChange({ fontFamily: e.target.value })}
                            >
                                <option value="Inter">Inter</option>
                                <option value="Arial">Arial</option>
                                <option value="Times New Roman">Times New Roman</option>
                                <option value="Courier New">Courier New</option>
                                <option value="Georgia">Georgia</option>
                                <option value="Verdana">Verdana</option>
                                <option value="Impact">Impact</option>
                                <option value="Comic Sans MS">Comic Sans MS</option>
                            </select>
                        </div>
                        <div className="w-24">
                            <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1.5 block">Size</label>
                            <input
                                type="number"
                                value={values.fontSize}
                                onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
                                className="w-full bg-zinc-800 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-blue-500/50 text-center"
                            />
                        </div>
                    </div>

                    <div className="flex justify-between items-center bg-zinc-800/50 p-1.5 rounded-xl border border-white/5">
                        <div className="flex gap-1">
                            <IconButton icon={<Bold size={16} />} active={isBold} onClick={() => toggleStyle('bold')} title="Bold" />
                            <IconButton icon={<Italic size={16} />} active={isItalic} onClick={() => toggleStyle('italic')} title="Italic" />
                            <IconButton icon={<Underline size={16} />} active={isUnderline} onClick={() => toggleStyle('underline')} title="Underline" />
                        </div>
                        <div className="w-px h-6 bg-white/10 mx-2" />
                        <div className="flex gap-1">
                            <IconButton icon={<AlignLeft size={16} />} active={values.align === 'left'} onClick={() => onChange({ align: 'left' })} title="Left" />
                            <IconButton icon={<AlignCenter size={16} />} active={values.align === 'center'} onClick={() => onChange({ align: 'center' })} title="Center" />
                            <IconButton icon={<AlignRight size={16} />} active={values.align === 'right'} onClick={() => onChange({ align: 'right' })} title="Right" />
                            <IconButton icon={<AlignJustify size={16} />} active={values.align === 'justify'} onClick={() => onChange({ align: 'justify' })} title="Justify" />
                        </div>
                    </div>

                    {/* Text Input for Creation Mode - Optional/Handy */}
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-zinc-500 block">Content</label>
                        <textarea
                            value={values.text || ''}
                            onChange={(e) => onChange({ text: e.target.value })}
                            className="w-full bg-zinc-800 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-blue-500/50 min-h-[60px]"
                            placeholder="Type your text..."
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Quick Styles */}
                    <CollapsibleSection
                        title="Quick Styles"
                        icon={<Sparkles size={12} />}
                        storageKey="text_studio_presets"
                        defaultOpen={true}
                    >
                        <div className="grid grid-cols-2 gap-2">
                            {TEXT_PRESETS.map(preset => (
                                <button
                                    key={preset.id}
                                    onClick={() => {
                                        // Update local values
                                        onChange({
                                            fontSize: preset.fontSize,
                                            fontFamily: preset.fontFamily,
                                            fontWeight: preset.fontWeight,
                                            fontStyle: preset.fontStyle,
                                            // Keep current color if preset color is null, else use preset
                                            fill: preset.color || values.fill,
                                            opacity: preset.opacity
                                        });

                                        // Add to history
                                        addRecentTextStyle({
                                            fontSize: preset.fontSize,
                                            fontFamily: preset.fontFamily,
                                            fontWeight: preset.fontWeight,
                                            fontStyle: preset.fontStyle,
                                            color: preset.color || values.fill || '#000000',
                                            opacity: preset.opacity,
                                            size: 0, textAlign: 'left', eraserMode: 'standard'
                                        });
                                    }}
                                    className="group relative flex flex-col items-start justify-center p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-blue-500/50 transition-all text-left overflow-hidden"
                                >
                                    <span style={{
                                        fontFamily: preset.fontFamily,
                                        fontWeight: preset.fontWeight,
                                        fontStyle: preset.fontStyle,
                                        fontSize: Math.min(preset.fontSize, 28),
                                        color: preset.color || '#e4e4e7'
                                    }} className="mb-2 leading-none">
                                        Ag
                                    </span>
                                    <div className="flex items-center justify-between w-full">
                                        <span className="text-[10px] text-zinc-500 font-medium group-hover:text-zinc-300 transition-colors">
                                            {preset.name}
                                        </span>
                                        <span className="text-[9px] text-zinc-600 font-mono bg-white/5 px-1.5 py-0.5 rounded">
                                            {preset.fontSize}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </CollapsibleSection>

                    {/* Last Used */}
                    {recentTextStyles.length > 0 && (
                        <CollapsibleSection
                            title="Last Used"
                            icon={<History size={12} />}
                            storageKey="text_studio_recent"
                        >
                            <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 pt-1 px-1">
                                {recentTextStyles.map((style, i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            onChange({
                                                fontSize: style.fontSize,
                                                fontFamily: style.fontFamily,
                                                fontWeight: style.fontWeight,
                                                fontStyle: style.fontStyle,
                                                fill: style.color,
                                                opacity: style.opacity
                                            });
                                        }}
                                        className="group relative flex-shrink-0 w-16 h-16 flex flex-col items-center justify-center rounded-xl bg-zinc-900/50 border border-white/10 hover:bg-white/[0.06] hover:border-blue-500/50 hover:scale-105 transition-all shadow-sm"
                                        title={`${style.fontFamily}, ${style.fontSize}px`}
                                    >
                                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:4px_4px] rounded-xl pointer-events-none" />
                                        <span style={{
                                            fontFamily: style.fontFamily,
                                            fontWeight: style.fontWeight,
                                            fontStyle: style.fontStyle,
                                            fontSize: Math.min(Math.max(style.fontSize * 0.7, 14), 32),
                                            color: style.color
                                        }} className="leading-none z-10">
                                            Ag
                                        </span>
                                        <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-md text-[8px] text-white/90 px-1 rounded font-mono border border-white/10 opacity-60 group-hover:opacity-100 transition-opacity">
                                            {style.fontSize}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </CollapsibleSection>
                    )}

                    {/* Color */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <label className="text-[10px] uppercase font-bold text-zinc-500 block">Color</label>
                        <ColorGrid
                            current={values.fill || '#000000'}
                            onSelect={(c) => onChange({ fill: c })}
                            recentColors={['#000000', '#ffffff', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef']}
                        />
                    </div>
                </div>
            </div >
        );
    }

    if (activeTab === 'properties') {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] text-zinc-400">
                            <span>Opacity</span>
                            <span>{Math.round((values.opacity || 1) * 100)}%</span>
                        </div>
                        <Slider value={values.opacity ?? 1} min={0} max={1} step={0.05} onChange={(v) => onChange({ opacity: v })} />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] text-zinc-400">
                            <span>Letter Spacing</span>
                            <span>{values.letterSpacing || 0}px</span>
                        </div>
                        <Slider value={values.letterSpacing || 0} min={-5} max={20} step={0.5} onChange={(v) => onChange({ letterSpacing: v })} />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] text-zinc-400">
                            <span>Line Height</span>
                            <span>{values.lineHeight || 1.2}</span>
                        </div>
                        <Slider value={values.lineHeight || 1.2} min={0.8} max={3} step={0.1} onChange={(v) => onChange({ lineHeight: v })} />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-xl border border-white/5">
                        <span className="text-xs font-medium text-zinc-300">Auto Wrap</span>
                        <ToggleButton active={values.isWrapped ?? true} onClick={() => onChange({ isWrapped: !values.isWrapped })} />
                    </div>
                </div>
            </div>
        );
    }

    if (activeTab === 'effect') {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] uppercase font-bold text-zinc-500">Outline</span>
                        </div>
                        <div className="flex items-center gap-4 mb-3">
                            <div className="flex-1 space-y-2">
                                <span className="text-[9px] text-zinc-500">Thickness</span>
                                <Slider value={values.strokeWidth || 0} min={0} max={10} step={0.5} onChange={(v) => onChange({ strokeWidth: v })} />
                            </div>
                        </div>
                        <ColorGrid
                            current={values.stroke || 'transparent'}
                            onSelect={(c) => onChange({ stroke: c })}
                            recentColors={['transparent', '#000000', '#ffffff', '#ef4444', '#3b82f6']}
                        />
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] uppercase font-bold text-zinc-500">Background</span>
                        </div>
                        <ColorGrid
                            current={values.backgroundColor || 'transparent'}
                            onSelect={(c) => onChange({ backgroundColor: c })}
                            recentColors={['transparent', '#000000', '#ffffff', '#ef4444', '#3b82f6', '#facc15']}
                        />
                        <div className="mt-4 space-y-2">
                            <span className="text-[9px] text-zinc-500">Corner Radius</span>
                            <Slider value={values.padding || 0} min={0} max={20} step={1} onChange={(v) => onChange({ padding: v })} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (activeTab === 'etc') {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] text-zinc-400">
                            <span>Rotation</span>
                            <span>{Math.round(values.rotation || 0)}°</span>
                        </div>
                        <Slider value={values.rotation || 0} min={0} max={360} step={1} onChange={(v) => onChange({ rotation: v })} />
                    </div>
                </div>

                {onReorder && (
                    <div className="space-y-6">
                        <label className="text-[10px] uppercase font-bold text-zinc-500 block">Layer Order</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => onReorder('forward')}
                                className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors"
                            >
                                <ArrowUp size={16} className="text-zinc-400" />
                                <span className="text-[9px] font-bold text-zinc-500">Bring Forward</span>
                            </button>
                            <button
                                onClick={() => onReorder('backward')}
                                className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors"
                            >
                                <ArrowDown size={16} className="text-zinc-400" />
                                <span className="text-[9px] font-bold text-zinc-500">Send Backward</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return null;
};
