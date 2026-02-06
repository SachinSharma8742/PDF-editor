import React, { useState, useEffect, useMemo } from 'react';
import { useEditorStore } from '../../../../store/editorStore';
import { X, Check, ChevronDown, ChevronRight, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, ArrowUp, ArrowDown, Type, Palette, Sparkles, Sliders } from 'lucide-react';
import clsx from 'clsx';
import { Slider, ColorGrid, ToggleButton } from '../properties/PropertyComponents';

// Collapsible Section Component
const Section: React.FC<{ title: string; icon: React.ElementType; defaultOpen?: boolean; children: React.ReactNode }> =
    ({ title, icon: Icon, defaultOpen = true, children }) => {
        const [isOpen, setIsOpen] = useState(defaultOpen);
        return (
            <div className="border-b border-white/5 last:border-b-0">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Icon size={14} className="text-zinc-500" />
                        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide">{title}</span>
                    </div>
                    {isOpen ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
                </button>
                {isOpen && <div className="px-4 pb-4 space-y-4">{children}</div>}
            </div>
        );
    };

export const TextStudio: React.FC = () => {
    const {
        textStudio,
        closeTextStudio,
        addObject,
        updateObject,
        currentPage,
        saveToHistory,
        reorderObject
    } = useEditorStore();

    const { isOpen, mode, elementId } = textStudio;

    // Local State for Creation Mode
    const [localCreationState, setLocalCreationState] = useState<any>({
        text: 'Your Text Here',
        fontSize: 40,
        fontFamily: 'Inter',
        align: 'center',
        fill: '#ffffff',
        opacity: 1,
        rotation: 0,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textDecoration: '',
        letterSpacing: 0,
        lineHeight: 1.2,
        strokeWidth: 0,
        stroke: 'transparent',
        backgroundColor: 'transparent',
        padding: 0,
        type: 'text'
    });

    // Resolve Current State (Edit vs Create)
    const editingObj = useMemo(() =>
        mode === 'edit' && elementId ? currentPage?.objects.find(o => o.id === elementId) : null,
        [currentPage, elementId, mode]);

    // Initialize local state on open
    useEffect(() => {
        if (isOpen && mode === 'create') {
            setLocalCreationState({
                text: 'Your Text Here',
                fontSize: 40,
                fontFamily: 'Inter',
                align: 'center',
                fill: '#ffffff',
                opacity: 1,
                rotation: 0,
                fontWeight: 'normal',
                fontStyle: 'normal',
                textDecoration: '',
                letterSpacing: 0,
                lineHeight: 1.2,
                strokeWidth: 0,
                stroke: 'transparent',
                backgroundColor: 'transparent',
                padding: 0,
                type: 'text'
            });
        }
    }, [isOpen, mode]);

    if (!isOpen) return null;

    const currentValues = mode === 'edit' && editingObj ? editingObj : localCreationState;

    const handleUpdate = (updates: any) => {
        if (mode === 'edit' && elementId) {
            updateObject(elementId, updates);
        } else {
            setLocalCreationState((prev: any) => ({ ...prev, ...updates }));
        }
    };

    const handleApply = () => {
        if (mode === 'create') {
            saveToHistory();
            addObject({
                id: crypto.randomUUID(),
                type: 'text',
                x: 100,
                y: 100,
                width: 300,
                height: 100,
                ...localCreationState
            });
        }
        closeTextStudio();
    };

    // Style helpers
    const isBold = currentValues.fontWeight === 'bold' || (currentValues.fontStyle as string)?.includes('bold');
    const isItalic = (currentValues.fontStyle as string)?.includes('italic');
    const isUnderline = (currentValues.textDecoration as string)?.includes('underline');

    const toggleStyle = (type: 'bold' | 'italic' | 'underline') => {
        let newStyle = (currentValues.fontStyle as string) || 'normal';
        let newWeight = currentValues.fontWeight || 'normal';
        let newDecoration = currentValues.textDecoration || '';

        if (type === 'bold') newWeight = isBold ? 'normal' : 'bold';
        if (type === 'italic') {
            newStyle = newStyle.includes('italic') ? newStyle.replace('italic', '').trim() : `${newStyle} italic`.trim();
        }
        if (type === 'underline') {
            newDecoration = newDecoration.includes('underline') ? newDecoration.replace('underline', '').trim() : `${newDecoration} underline`.trim();
        }
        if (!newStyle) newStyle = 'normal';
        handleUpdate({ fontStyle: newStyle, fontWeight: newWeight, textDecoration: newDecoration });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 pointer-events-auto">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={closeTextStudio} />

            {/* Modal Content - Side by Side */}
            <div className="relative bg-[#1a1a1d] w-full max-w-5xl h-[90vh] max-h-[700px] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex animate-in zoom-in-95 duration-200">

                {/* LEFT: Preview Area */}
                <div className="flex-[1.2] relative bg-[#0d0d0f] flex items-center justify-center overflow-hidden">
                    {/* Grid Pattern */}
                    <div className="absolute inset-0 opacity-30 pointer-events-none"
                        style={{
                            backgroundImage: 'radial-gradient(#333 1px, transparent 1px)',
                            backgroundSize: '20px 20px'
                        }}
                    />

                    {/* Live Preview */}
                    <div
                        className="relative z-10 p-8 max-w-full"
                        style={{ transform: `rotate(${currentValues.rotation || 0}deg)` }}
                    >
                        <span style={{
                            fontFamily: currentValues.fontFamily,
                            fontSize: `${Math.min(currentValues.fontSize, 80)}px`,
                            color: currentValues.fill,
                            fontWeight: currentValues.fontWeight,
                            fontStyle: isItalic ? 'italic' : 'normal',
                            textDecoration: currentValues.textDecoration,
                            textAlign: currentValues.align as any,
                            opacity: currentValues.opacity,
                            letterSpacing: `${currentValues.letterSpacing}px`,
                            lineHeight: currentValues.lineHeight,
                            textShadow: currentValues.strokeWidth > 0
                                ? `0 0 ${currentValues.strokeWidth}px ${currentValues.stroke}`
                                : 'none',
                            display: 'block',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                        }}>
                            {currentValues.text || 'Your Text Here'}
                        </span>
                    </div>

                    {/* Header Overlay */}
                    <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-4">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                            Text Studio
                        </h3>
                    </div>
                </div>

                {/* RIGHT: Controls Panel */}
                <div className="w-[340px] bg-[#18181b] border-l border-white/10 flex flex-col">
                    {/* Close Button */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                        <span className="text-xs text-zinc-500 uppercase tracking-wide">
                            {mode === 'create' ? 'New Text' : 'Edit Text'}
                        </span>
                        <button onClick={closeTextStudio} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
                            <X size={16} />
                        </button>
                    </div>

                    {/* Scrollable Controls */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">

                        {/* Text Input */}
                        <div className="p-4 border-b border-white/5">
                            <textarea
                                value={currentValues.text || ''}
                                onChange={(e) => handleUpdate({ text: e.target.value })}
                                placeholder="Enter your text..."
                                className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-blue-500/50 resize-none min-h-[80px]"
                            />
                        </div>

                        {/* Typography Section */}
                        <Section title="Typography" icon={Type} defaultOpen={true}>
                            {/* Font & Size */}
                            <div className="flex gap-2">
                                <select
                                    className="flex-1 bg-zinc-900 border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-blue-500/50 appearance-none"
                                    value={currentValues.fontFamily || 'Inter'}
                                    onChange={(e) => handleUpdate({ fontFamily: e.target.value })}
                                >
                                    <option value="Inter">Inter</option>
                                    <option value="Arial">Arial</option>
                                    <option value="Times New Roman">Times New Roman</option>
                                    <option value="Courier New">Courier New</option>
                                    <option value="Georgia">Georgia</option>
                                    <option value="Verdana">Verdana</option>
                                    <option value="Impact">Impact</option>
                                </select>
                                <div className="flex items-center bg-zinc-900 border border-white/10 rounded-lg">
                                    <button
                                        onClick={() => handleUpdate({ fontSize: Math.max(8, (currentValues.fontSize || 16) - 2) })}
                                        className="px-2 py-2 text-zinc-400 hover:text-white"
                                    >−</button>
                                    <span className="w-10 text-center text-xs text-white">{currentValues.fontSize}px</span>
                                    <button
                                        onClick={() => handleUpdate({ fontSize: Math.min(200, (currentValues.fontSize || 16) + 2) })}
                                        className="px-2 py-2 text-zinc-400 hover:text-white"
                                    >+</button>
                                </div>
                            </div>

                            {/* Style Buttons */}
                            <div className="flex gap-1">
                                <button onClick={() => toggleStyle('bold')} className={clsx("flex-1 py-2 rounded-lg flex items-center justify-center transition-all", isBold ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700")}>
                                    <Bold size={16} />
                                </button>
                                <button onClick={() => toggleStyle('italic')} className={clsx("flex-1 py-2 rounded-lg flex items-center justify-center transition-all", isItalic ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700")}>
                                    <Italic size={16} />
                                </button>
                                <button onClick={() => toggleStyle('underline')} className={clsx("flex-1 py-2 rounded-lg flex items-center justify-center transition-all", isUnderline ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700")}>
                                    <Underline size={16} />
                                </button>
                            </div>

                            {/* Alignment */}
                            <div className="flex gap-1">
                                {[
                                    { id: 'left', icon: AlignLeft },
                                    { id: 'center', icon: AlignCenter },
                                    { id: 'right', icon: AlignRight },
                                    { id: 'justify', icon: AlignJustify }
                                ].map(a => (
                                    <button
                                        key={a.id}
                                        onClick={() => handleUpdate({ align: a.id })}
                                        className={clsx("flex-1 py-2 rounded-lg flex items-center justify-center transition-all", currentValues.align === a.id ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700")}
                                    >
                                        <a.icon size={16} />
                                    </button>
                                ))}
                            </div>
                        </Section>

                        {/* Color Section */}
                        <Section title="Color" icon={Palette} defaultOpen={true}>
                            <ColorGrid
                                current={currentValues.fill || '#ffffff'}
                                onSelect={(c) => handleUpdate({ fill: c })}
                                recentColors={['#ffffff', '#000000', '#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']}
                            />
                        </Section>

                        {/* Properties Section */}
                        <Section title="Properties" icon={Sliders} defaultOpen={false}>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] text-zinc-500">
                                        <span>Opacity</span>
                                        <span>{Math.round((currentValues.opacity || 1) * 100)}%</span>
                                    </div>
                                    <Slider value={currentValues.opacity ?? 1} min={0} max={1} step={0.05} onChange={(v) => handleUpdate({ opacity: v })} />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] text-zinc-500">
                                        <span>Letter Spacing</span>
                                        <span>{currentValues.letterSpacing || 0}px</span>
                                    </div>
                                    <Slider value={currentValues.letterSpacing || 0} min={-5} max={20} step={0.5} onChange={(v) => handleUpdate({ letterSpacing: v })} />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] text-zinc-500">
                                        <span>Line Height</span>
                                        <span>{currentValues.lineHeight || 1.2}</span>
                                    </div>
                                    <Slider value={currentValues.lineHeight || 1.2} min={0.8} max={3} step={0.1} onChange={(v) => handleUpdate({ lineHeight: v })} />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] text-zinc-500">
                                        <span>Rotation</span>
                                        <span>{Math.round(currentValues.rotation || 0)}°</span>
                                    </div>
                                    <Slider value={currentValues.rotation || 0} min={0} max={360} step={1} onChange={(v) => handleUpdate({ rotation: v })} />
                                </div>
                            </div>
                        </Section>

                        {/* Effects Section */}
                        <Section title="Effects" icon={Sparkles} defaultOpen={false}>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] text-zinc-500">
                                        <span>Stroke / Outline</span>
                                        <span>{currentValues.strokeWidth || 0}px</span>
                                    </div>
                                    <Slider value={currentValues.strokeWidth || 0} min={0} max={10} step={0.5} onChange={(v) => handleUpdate({ strokeWidth: v })} />
                                </div>
                                {currentValues.strokeWidth > 0 && (
                                    <ColorGrid
                                        current={currentValues.stroke || '#000000'}
                                        onSelect={(c) => handleUpdate({ stroke: c })}
                                        recentColors={['#000000', '#ffffff', '#ef4444', '#3b82f6']}
                                    />
                                )}
                            </div>
                        </Section>

                        {/* Layer Order (Edit Mode Only) */}
                        {mode === 'edit' && elementId && (
                            <Section title="Layer" icon={ArrowUp} defaultOpen={false}>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => reorderObject(elementId, 'forward')}
                                        className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center justify-center gap-2 text-xs text-zinc-300 transition-colors"
                                    >
                                        <ArrowUp size={14} /> Bring Forward
                                    </button>
                                    <button
                                        onClick={() => reorderObject(elementId, 'backward')}
                                        className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center justify-center gap-2 text-xs text-zinc-300 transition-colors"
                                    >
                                        <ArrowDown size={14} /> Send Back
                                    </button>
                                </div>
                            </Section>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-white/5 flex gap-3 shrink-0">
                        <button
                            onClick={closeTextStudio}
                            className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 font-medium text-xs hover:bg-zinc-700 transition"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApply}
                            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition flex items-center justify-center gap-2"
                        >
                            {mode === 'create' ? <><Check size={14} /> Add Text</> : 'Done'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
