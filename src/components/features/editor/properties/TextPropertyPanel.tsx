import React from 'react';
import { useEditorStore } from '../../../../store/editorStore';
import type { PDFObject } from '../../../../store/pdfStore';
import { Type, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline, MoveHorizontal, Sparkles, Spline, History } from 'lucide-react';
import { TEXT_PRESETS } from '../../../../store/editorStore';
import { SimpleInput, Slider, ColorGrid, IconButton, ToggleButton } from './PropertyComponents';
import { CollapsibleSection } from './CollapsibleSection';

// Helper for mixed values
const getCommonValue = (objects: PDFObject[], key: keyof PDFObject, fallback: any): any => {
    if (objects.length === 0) return fallback;
    const val = objects[0][key];
    for (let i = 1; i < objects.length; i++) {
        if (objects[i][key] !== val) return 'mixed';
    }
    return val ?? fallback;
};

interface TextPropertyPanelProps {
    mode?: 'selection' | 'tool';
}

export const TextPropertyPanel: React.FC<TextPropertyPanelProps> = ({ mode = 'selection' }) => {
    const {
        selectedObjectIds,
        currentPage,
        updateObject,
        recentColors,
        addColorToHistory,
        toolPreferences,
        updateToolSettings,
        applyTextPreset,
        recentTextStyles,
        addRecentTextStyle,
        setPreviewStyle,
        previewStyle // Access global preview state
    } = useEditorStore();

    // SECTION: Resolve Values
    let values: any = {};

    // Check validity
    if (mode === 'selection') {
        if (!currentPage) return null;
        const selectedObjects = currentPage.objects.filter(o => selectedObjectIds.includes(o.id));
        if (selectedObjects.length === 0) return null;

        // Populate values from selection
        values = {
            fontSize: getCommonValue(selectedObjects, 'fontSize', 16),
            fontFamily: getCommonValue(selectedObjects, 'fontFamily', 'Inter'),
            align: getCommonValue(selectedObjects, 'align', 'left'),
            fill: getCommonValue(selectedObjects, 'fill', '#000000'),
            fontStyleStr: getCommonValue(selectedObjects, 'fontStyle', 'normal') as string,
            fontWeight: getCommonValue(selectedObjects, 'fontWeight', 'normal'),
            textDecoration: getCommonValue(selectedObjects, 'textDecoration', ''),
            letterSpacing: getCommonValue(selectedObjects, 'letterSpacing', 0),
            lineHeight: getCommonValue(selectedObjects, 'lineHeight', 1.2),
            stroke: getCommonValue(selectedObjects, 'stroke', 'transparent'),
            strokeWidth: getCommonValue(selectedObjects, 'strokeWidth', 0),
            opacity: getCommonValue(selectedObjects, 'opacity', 1),
            isCurved: getCommonValue(selectedObjects, 'isCurved', false),
            curveRadius: getCommonValue(selectedObjects, 'curveRadius', 100),
            isWrapped: getCommonValue(selectedObjects, 'isWrapped', true),
        };
    } else {
        // Mode === 'tool'
        const prefs = toolPreferences['text'] || {};
        values = {
            fontSize: prefs.fontSize ?? 16,
            fontFamily: prefs.fontFamily ?? 'Inter',
            align: prefs.textAlign ?? 'left',
            fill: prefs.color ?? '#000000',
            fontStyleStr: prefs.fontStyle ?? 'normal',
            fontWeight: prefs.fontWeight ?? 'normal',
            textDecoration: '', // Not in tool settings yet, assume empty
            letterSpacing: 0, // Not in tool settings yet
            lineHeight: 1.2, // Not in tool settings yet
            stroke: 'transparent',
            strokeWidth: 0,
            opacity: prefs.opacity ?? 1,
            isCurved: false,
            curveRadius: 100,
            isWrapped: true
        };
    }

    // SECTION: Handle Updates
    const handleUpdate = (updates: any) => {
        if (mode === 'selection') {
            const selectedObjects = currentPage!.objects.filter(o => selectedObjectIds.includes(o.id));
            selectedObjects.forEach(obj => updateObject(obj.id, updates));

            // Also add to Recent Styles history if it's a meaningful change (font/color/size)
            // We construct a "full style" based on current values + updates
            const currentStyle = {
                color: updates.fill || values.fill,
                fontSize: updates.fontSize || values.fontSize,
                fontFamily: updates.fontFamily || values.fontFamily,
                fontWeight: updates.fontWeight || values.fontWeight,
                fontStyle: updates.fontStyleStr || values.fontStyleStr, // Use the string version
                opacity: updates.opacity || values.opacity,
                size: 0,
                textAlign: 'left',
                eraserMode: 'standard'
            } as any; // Cast to avoid strict ToolSettings check for partial props

            addRecentTextStyle(currentStyle);

        } else {
            // Map PDFObject keys to ToolSettings keys
            const settingsUpdates: any = {};
            if (updates.fontSize !== undefined) settingsUpdates.fontSize = updates.fontSize;
            if (updates.fontFamily !== undefined) settingsUpdates.fontFamily = updates.fontFamily;
            if (updates.align !== undefined) settingsUpdates.textAlign = updates.align;
            if (updates.fill !== undefined) settingsUpdates.color = updates.fill;
            if (updates.fontStyle !== undefined) settingsUpdates.fontStyle = updates.fontStyle;
            if (updates.fontWeight !== undefined) settingsUpdates.fontWeight = updates.fontWeight;
            if (updates.opacity !== undefined) settingsUpdates.opacity = updates.opacity;

            // Pending: Add stroke, spacing, etc to ToolSettings interface if we want to persist them
            // For now, only update what's in ToolSettings
            updateToolSettings(settingsUpdates);
        }
    };


    // Derived booleans
    const isBold = values.fontStyleStr.includes('bold') || values.fontWeight === 'bold';
    const isItalic = values.fontStyleStr.includes('italic');
    const isUnderline = (values.textDecoration as string).includes('underline');

    const toggleStyle = (type: 'bold' | 'italic' | 'underline') => {
        let newStyle = values.fontStyleStr === 'mixed' ? '' : values.fontStyleStr;
        let newWeight = values.fontWeight === 'mixed' ? 'normal' : values.fontWeight;
        let newDecoration = values.textDecoration === 'mixed' ? '' : values.textDecoration;

        if (type === 'bold') {
            newWeight = isBold ? 'normal' : 'bold';
            if (newStyle.includes('bold')) newStyle = newStyle.replace('bold', '').trim();
            else newStyle = `${newStyle} bold`.trim();
        }
        if (type === 'italic') {
            if (newStyle.includes('italic')) newStyle = newStyle.replace('italic', '').trim();
            else newStyle = `${newStyle} italic`.trim();
        }
        if (type === 'underline') {
            if (newDecoration.includes('underline')) newDecoration = newDecoration.replace('underline', '').trim();
            else newDecoration = `${newDecoration} underline`.trim();
        }

        handleUpdate({
            fontStyle: newStyle,
            fontWeight: newWeight,
            textDecoration: newDecoration
        });
    };

    // COMPOSITE STYLE: Use Preview Style if active (hover), otherwise Current Values
    const activeStyle = previewStyle || {
        fontSize: values.fontSize,
        fontFamily: values.fontFamily,
        fontWeight: values.fontWeight,
        fontStyle: values.fontStyleStr,
        color: values.fill,
        opacity: values.opacity,
        align: values.align,
        textDecoration: values.textDecoration
    } as any;

    return (
        <div className="space-y-2">

            {/* --- SIDEBAR LIVE PREVIEW CARD --- */}
            <div className="bg-zinc-900 rounded-xl overflow-hidden border border-white/10 shadow-lg relative group mb-4">
                {/* Header label */}
                <div className="absolute top-2 left-3 z-20">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900/80 backdrop-blur px-1.5 py-0.5 rounded">
                        Preview
                    </span>
                </div>

                {/* Transparency Grid Config */}
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:8px_8px] pointer-events-none" />

                {/* The Preview Area */}
                <div className="h-40 flex items-center justify-center p-6 relative">
                    <span style={{
                        fontFamily: activeStyle.fontFamily,
                        fontSize: Math.min(activeStyle.fontSize * 1.5, 64), // Scale up for visibility, cap at 64
                        fontWeight: activeStyle.fontWeight,
                        fontStyle: activeStyle.fontStyle || 'normal',
                        color: activeStyle.color || activeStyle.fill,
                        opacity: activeStyle.opacity,
                        textDecoration: activeStyle.textDecoration,
                        textAlign: 'center',
                        lineHeight: 1
                    }} className="transition-all duration-200 ease-out z-10 break-words w-full text-center">
                        {values.text ? values.text : "Ag"}
                    </span>
                </div>

                {/* Footer Info */}
                <div className="bg-zinc-950/50 backdrop-blur border-t border-white/5 px-3 py-2 flex justify-between items-center z-20 relative">
                    <span className="text-[10px] text-zinc-400 font-medium truncate max-w-[70%]">
                        {activeStyle.fontFamily}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono bg-white/5 px-1.5 py-0.5 rounded">
                        {activeStyle.fontSize}px
                    </span>
                </div>
            </div>

            {/* Quick Styles (Presets) - Visible in Tool Mode mainly, or always? */}
            <CollapsibleSection
                title="Quick Styles"
                icon={<Sparkles size={12} />}
                storageKey="text_presets"
            >
                <div className="grid grid-cols-2 gap-2">
                    {TEXT_PRESETS.map(preset => (
                        <button
                            key={preset.id}
                            onClick={() => {
                                applyTextPreset(preset);
                                setPreviewStyle(null); // Clear preview on click

                                // Add to history with current color if preset doesn't enforce one
                                addRecentTextStyle({
                                    fontSize: preset.fontSize,
                                    fontFamily: preset.fontFamily,
                                    fontWeight: preset.fontWeight,
                                    fontStyle: preset.fontStyle,
                                    color: preset.color || toolPreferences.text.color,
                                    opacity: preset.opacity,
                                    size: 0,
                                    textAlign: 'left',
                                    eraserMode: 'standard'
                                });

                                // If in selection mode, also update selected object
                                if (mode === 'selection') {
                                    handleUpdate({
                                        fontSize: preset.fontSize,
                                        fontWeight: preset.fontWeight,
                                        fontFamily: preset.fontFamily,
                                        fontStyle: preset.fontStyle,
                                        // Opacity...
                                    });
                                }
                            }}
                            onMouseEnter={() => {
                                setPreviewStyle({
                                    fontSize: preset.fontSize,
                                    fontFamily: preset.fontFamily,
                                    fontWeight: preset.fontWeight,
                                    fontStyle: preset.fontStyle,
                                    color: preset.color || toolPreferences.text.color,
                                    opacity: preset.opacity,
                                    size: 0, textAlign: 'left', eraserMode: 'standard'
                                });
                            }}
                            onMouseLeave={() => setPreviewStyle(null)}
                            className="group relative flex flex-col items-start justify-center p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-blue-500/50 transition-all text-left overflow-hidden"
                        >
                            <span style={{
                                fontFamily: preset.fontFamily,
                                fontWeight: preset.fontWeight,
                                fontStyle: preset.fontStyle,
                                fontSize: Math.min(preset.fontSize, 28), // Cap visual size for presets
                                color: preset.color || '#e4e4e7' // Default to zinc-200 if no color
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

            {/* Recent Styles */}
            {recentTextStyles.length > 0 && (
                <CollapsibleSection
                    title="Last Used"
                    icon={<History size={12} />}
                    storageKey="text_recent_styles"
                >
                    <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 pt-1 px-1">
                        {recentTextStyles.map((style, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    // Apply all style props
                                    const updates = {
                                        fontSize: style.fontSize,
                                        fontFamily: style.fontFamily,
                                        fontWeight: style.fontWeight,
                                        fontStyle: style.fontStyle,
                                        fill: style.color, // Map color -> fill
                                        opacity: style.opacity
                                    };
                                    if (mode === 'selection') handleUpdate(updates);
                                    else updateToolSettings(style);
                                    setPreviewStyle(null);
                                }}
                                onMouseEnter={() => setPreviewStyle(style)}
                                onMouseLeave={() => setPreviewStyle(null)}
                                className="group relative flex-shrink-0 w-16 h-16 flex flex-col items-center justify-center rounded-xl bg-zinc-900/50 border border-white/10 hover:bg-white/[0.06] hover:border-blue-500/50 hover:scale-105 transition-all shadow-sm"
                                title={`${style.fontFamily}, ${style.fontSize}px`}
                            >
                                {/* Background pattern for weak contrast colors */}
                                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:4px_4px] rounded-xl pointer-events-none" />

                                <span style={{
                                    fontFamily: style.fontFamily,
                                    fontWeight: style.fontWeight,
                                    fontStyle: style.fontStyle,
                                    fontSize: Math.min(Math.max(style.fontSize * 0.7, 14), 32), // Smart scaling
                                    color: style.color
                                }} className="leading-none z-10">
                                    Ag
                                </span>

                                {/* Size Badge */}
                                <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-md text-[8px] text-white/90 px-1 rounded font-mono border border-white/10 opacity-60 group-hover:opacity-100 transition-opacity">
                                    {style.fontSize}
                                </div>
                            </button>
                        ))}
                    </div>
                </CollapsibleSection>
            )}

            {/* Typography Section */}
            <CollapsibleSection
                title="Typography"
                icon={<Type size={12} />}
                storageKey="text_typography"
            >
                <div className="space-y-3">
                    {/* Font Family (Simple select for now) */}
                    <select
                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-2 text-xs text-white outline-none focus:border-blue-500/50"
                        value={values.fontFamily === 'mixed' ? '' : values.fontFamily}
                        onChange={(e) => handleUpdate({ fontFamily: e.target.value })}
                    >
                        <option value="Inter">Inter</option>
                        <option value="Arial">Arial</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Courier New">Courier New</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Verdana">Verdana</option>
                    </select>

                    <div className="flex gap-2">
                        <SimpleInput
                            label="Size"
                            value={values.fontSize}
                            onChange={(v) => handleUpdate({ fontSize: v })}
                            className="flex-1"
                        />
                        <div className="flex bg-white/[0.03] rounded-xl border border-white/10 p-1">
                            <IconButton
                                icon={<Bold size={14} />}
                                active={isBold}
                                onClick={() => toggleStyle('bold')}
                                title="Bold"
                            />
                            <IconButton
                                icon={<Italic size={14} />}
                                active={isItalic}
                                onClick={() => toggleStyle('italic')}
                                title="Italic"
                            />
                            <IconButton
                                icon={<Underline size={14} />}
                                active={isUnderline}
                                onClick={() => toggleStyle('underline')}
                                title="Underline"
                            />
                        </div>
                    </div>

                    <div className="flex bg-white/[0.03] rounded-xl border border-white/10 p-1">
                        <IconButton
                            icon={<AlignLeft size={14} />}
                            active={values.align === 'left'}
                            onClick={() => handleUpdate({ align: 'left' })}
                            title="Align Left"
                        />
                        <IconButton
                            icon={<AlignCenter size={14} />}
                            active={values.align === 'center'}
                            onClick={() => handleUpdate({ align: 'center' })}
                            title="Align Center"
                        />
                        <IconButton
                            icon={<AlignRight size={14} />}
                            active={values.align === 'right'}
                            onClick={() => handleUpdate({ align: 'right' })}
                            title="Align Right"
                        />
                    </div>

                    {/* Color */}
                    <div>
                        <span className="text-[9px] text-zinc-500 mb-2 block">Text Color</span>
                        <ColorGrid
                            current={values.fill}
                            recentColors={recentColors}
                            onSelect={(c) => { addColorToHistory(c); handleUpdate({ fill: c }); }}
                        />
                    </div>
                </div>
            </CollapsibleSection>

            {/* Spacing & Layout - Only for Selection Mode (or implement full persistence later) */}
            {mode === 'selection' && (
                <>
                    <CollapsibleSection
                        title="Spacing"
                        icon={<MoveHorizontal size={12} />}
                        storageKey="text_spacing"
                    >
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-[10px] text-zinc-400">
                                    <span>Letter Spacing</span>
                                    <span>{values.letterSpacing}px</span>
                                </div>
                                <Slider
                                    value={values.letterSpacing === 'mixed' ? 0 : values.letterSpacing}
                                    min={-5} max={20} step={0.5}
                                    onChange={(v) => handleUpdate({ letterSpacing: v })}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-[10px] text-zinc-400">
                                    <span>Line Height</span>
                                    <span>{values.lineHeight}</span>
                                </div>
                                <Slider
                                    value={values.lineHeight === 'mixed' ? 1.2 : values.lineHeight}
                                    min={0.8} max={3} step={0.1}
                                    onChange={(v) => handleUpdate({ lineHeight: v })}
                                />
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <span className="text-[10px] text-zinc-400">Fixed Width (Wrap)</span>
                                <ToggleButton
                                    active={values.isWrapped}
                                    onClick={() => handleUpdate({ isWrapped: !values.isWrapped })}
                                />
                            </div>
                        </div>
                    </CollapsibleSection>

                    {/* Effects */}
                    <CollapsibleSection
                        title="Effects"
                        icon={<Sparkles size={12} />}
                        storageKey="text_effects"
                    >
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[9px] text-zinc-500">Outline Width</span>
                                    <span className="text-[9px] text-zinc-400">{values.strokeWidth}px</span>
                                </div>
                                <Slider
                                    value={values.strokeWidth === 'mixed' ? 0 : values.strokeWidth}
                                    min={0} max={10} step={0.5}
                                    onChange={(v) => handleUpdate({ strokeWidth: v })}
                                />
                            </div>

                            {values.strokeWidth > 0 && (
                                <div>
                                    <span className="text-[9px] text-zinc-500 mb-2 block">Outline Color</span>
                                    <ColorGrid
                                        current={values.stroke}
                                        recentColors={recentColors}
                                        onSelect={(c) => { addColorToHistory(c); handleUpdate({ stroke: c }); }}
                                    />
                                </div>
                            )}
                        </div>
                    </CollapsibleSection>

                    {/* Advanced / Curved */}
                    <CollapsibleSection
                        title="Curved Text"
                        icon={<Spline size={12} />}
                        storageKey="text_curved"
                        action={
                            <ToggleButton
                                active={values.isCurved}
                                onClick={() => handleUpdate({ isCurved: !values.isCurved })}
                            />
                        }
                    >
                        {values.isCurved && (
                            <div className="space-y-2 mt-2">
                                <div className="flex justify-between items-center text-[10px] text-zinc-400">
                                    <span>Radius</span>
                                    <span>{values.curveRadius}</span>
                                </div>
                                <Slider
                                    value={values.curveRadius === 'mixed' ? 100 : values.curveRadius}
                                    min={20} max={1000} step={10}
                                    onChange={(v) => handleUpdate({ curveRadius: v })}
                                />
                            </div>
                        )}
                    </CollapsibleSection>
                </>
            )}

        </div>
    );
};
