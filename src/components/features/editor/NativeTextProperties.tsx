import React, { useEffect, useState } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { Type, ALargeSmall, Baseline, Palette, AlignLeft, AlignCenter, AlignRight, Check, X, FileText } from 'lucide-react';
import { CollapsibleSection } from './properties/CollapsibleSection';

export const NativeTextProperties: React.FC = () => {
    const { activeNativeTextItem, setActiveNativeTextItem, editingMode, updateNativeTextEdit } = useEditorStore();
    const [localText, setLocalText] = useState('');
    const [localFontSize, setLocalFontSize] = useState(16);
    const [localColor, setLocalColor] = useState('#000000');

    useEffect(() => {
        if (activeNativeTextItem) {
            setLocalText(activeNativeTextItem.text);
            setLocalFontSize(activeNativeTextItem.fontSize);
            setLocalColor(activeNativeTextItem.color || '#000000');
        }
    }, [activeNativeTextItem?.id]); // Only reset when ID changes, not on every store update

    if (!activeNativeTextItem || editingMode !== 'native-text') {
        return (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 p-6 text-center">
                <div className="p-3 bg-zinc-800 rounded-full mb-4">
                    <Type size={24} className="opacity-50" />
                </div>
                <h3 className="text-sm font-medium text-zinc-300 mb-1">No Text Selected</h3>
                <p className="text-xs opacity-60">
                    Click on any text block in the page to edit its content or style.
                </p>
            </div>
        );
    }

    const handleTextChange = (newText: string) => {
        setLocalText(newText);
        const updated = {
            ...activeNativeTextItem,
            text: newText
        };
        setActiveNativeTextItem(updated);
        updateNativeTextEdit(activeNativeTextItem.id, updated);
    };

    const handleFontSizeChange = (size: number) => {
        setLocalFontSize(size);
        const updated = {
            ...activeNativeTextItem,
            fontSize: size
        };
        setActiveNativeTextItem(updated);
        updateNativeTextEdit(activeNativeTextItem.id, updated);
    };

    const handleColorChange = (color: string) => {
        setLocalColor(color);
        const updated = {
            ...activeNativeTextItem,
            color: color
        };
        setActiveNativeTextItem(updated);
        updateNativeTextEdit(activeNativeTextItem.id, updated);
    };

    // Preset colors for quick selection (11 colors + custom picker = 12 = 2 rows)
    const presetColors = [
        '#000000', '#ffffff', '#374151', '#ef4444', '#f97316', '#eab308',
        '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center gap-2 pb-4 border-b border-gray-200 dark:border-white/10">
                <Type className="text-blue-500" size={20} />
                <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">PDF Text Edit</h2>
                <span className="ml-auto text-[10px] bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Beta</span>
            </div>

            {/* Content Edit */}
            <CollapsibleSection
                title="Content"
                icon={<FileText size={12} />}
                defaultOpen={true}
                storageKey="native_text_content"
            >
                <textarea
                    value={localText}
                    onChange={(e) => handleTextChange(e.target.value)}
                    className="w-full h-32 px-3 py-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm resize-none transition-all border border-gray-300 mt-2"
                    style={{ backgroundColor: '#ffffff', color: '#000000' }}
                    placeholder="Enter text content..."
                />
            </CollapsibleSection>

            {/* Typography */}
            <CollapsibleSection
                title="Typography"
                icon={<Type size={12} />}
                defaultOpen={true}
                storageKey="native_text_typography"
            >
                {/* Font Size */}
                <div className="flex items-center gap-3 mt-2">
                    <div className="p-2 bg-gray-100 dark:bg-white/5 rounded-lg text-gray-500">
                        <ALargeSmall size={16} />
                    </div>
                    <div className="flex-1">
                        <input
                            type="range"
                            min="8" max="72" step="1"
                            value={localFontSize}
                            onChange={(e) => handleFontSizeChange(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                    <span className="w-12 text-right text-xs font-mono dark:text-gray-300">
                        {typeof localFontSize === 'number'
                            ? Number(localFontSize).toFixed(2).replace(/\.00$/, '')
                            : localFontSize}px
                    </span>
                </div>

                {/* Text Color */}
                <div className="mt-4 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Palette size={14} className="text-gray-500" />
                            <span className="text-xs text-gray-500 dark:text-gray-400">Text Color</span>
                        </div>
                        {/* Current color preview */}
                        <div className="flex items-center gap-2">
                            <div
                                className="w-6 h-6 rounded-md shadow-inner border border-white/10"
                                style={{ backgroundColor: localColor }}
                            />
                            <span className="text-[10px] font-mono text-zinc-500 uppercase">
                                {localColor}
                            </span>
                        </div>
                    </div>

                    {/* Color Grid */}
                    <div className="grid grid-cols-6 gap-1.5 p-2 bg-black/20 rounded-xl">
                        {presetColors.map((color) => (
                            <button
                                key={color}
                                onClick={() => handleColorChange(color)}
                                className={`aspect-square rounded-lg transition-all duration-150 hover:scale-105 active:scale-95 ${localColor === color
                                    ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-zinc-900 shadow-lg'
                                    : 'hover:ring-1 hover:ring-white/30'
                                    }`}
                                style={{
                                    backgroundColor: color,
                                    boxShadow: localColor === color ? `0 4px 12px ${color}40` : undefined
                                }}
                                title={color}
                            />
                        ))}
                        {/* Custom color picker */}
                        <label
                            className="aspect-square rounded-lg bg-gradient-to-br from-red-500 via-green-500 to-blue-500 cursor-pointer hover:scale-105 active:scale-95 transition-all duration-150 relative overflow-hidden flex items-center justify-center"
                            title="Custom color"
                        >
                            <span className="text-white text-lg font-bold drop-shadow-md">+</span>
                            <input
                                type="color"
                                value={localColor}
                                onChange={(e) => handleColorChange(e.target.value)}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                        </label>
                    </div>
                </div>
            </CollapsibleSection>

            {/* Info Box */}
            <div className="p-3 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-xl">
                <div className="flex items-start gap-2">
                    <div className="mt-0.5 text-yellow-600 dark:text-yellow-500">
                        <Baseline size={14} />
                    </div>
                    <div>
                        <p className="text-xs text-yellow-800 dark:text-yellow-200/80 font-medium">Text Replacement</p>
                        <p className="text-[10px] text-yellow-700/80 dark:text-yellow-200/60 leading-relaxed mt-1">
                            Edits will be applied by redacting the original text and drawing new text over it. This preserves the document structure.
                        </p>
                    </div>
                </div>
            </div>

            <div className="pt-4 flex gap-2">
                <button
                    onClick={() => setActiveNativeTextItem(null)}
                    className="flex-1 py-1.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                >
                    <X size={14} /> Close
                </button>
            </div>
        </div>
    );
};
