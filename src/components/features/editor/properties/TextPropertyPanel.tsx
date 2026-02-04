import React from 'react';
import { useEditorStore } from '../../../../store/editorStore';
import type { PDFObject } from '../../../../store/pdfStore';
import { Type, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline, Baseline, Type as FontIcon, MoveHorizontal, Highlighter, Sparkles, Spline } from 'lucide-react';
import { PropertyLabel, SimpleInput, Slider, ColorGrid, IconButton, ToggleButton } from './PropertyComponents';

// Helper for mixed values
const getCommonValue = (objects: PDFObject[], key: keyof PDFObject, fallback: any): any => {
    if (objects.length === 0) return fallback;
    const val = objects[0][key];
    for (let i = 1; i < objects.length; i++) {
        if (objects[i][key] !== val) return 'mixed';
    }
    return val ?? fallback;
};

export const TextPropertyPanel: React.FC = () => {
    const { selectedObjectIds, currentPage, updateObject, recentColors, addColorToHistory } = useEditorStore();

    if (!currentPage) return null;
    const selectedObjects = currentPage.objects.filter(o => selectedObjectIds.includes(o.id));
    if (selectedObjects.length === 0) return null;

    const updateAll = (updates: Partial<PDFObject>) => {
        selectedObjects.forEach(obj => updateObject(obj.id, updates));
    };

    const fontSize = getCommonValue(selectedObjects, 'fontSize', 16);
    const fontFamily = getCommonValue(selectedObjects, 'fontFamily', 'Inter');
    const align = getCommonValue(selectedObjects, 'align', 'left');
    const color = getCommonValue(selectedObjects, 'fill', '#000000');

    // Font Styles
    const fontStyleStr = getCommonValue(selectedObjects, 'fontStyle', 'normal') as string;
    const isBold = fontStyleStr.includes('bold') || getCommonValue(selectedObjects, 'fontWeight', 'normal') === 'bold';
    const isItalic = fontStyleStr.includes('italic');
    const isUnderline = (getCommonValue(selectedObjects, 'textDecoration', '') as string).includes('underline');

    // Advanced Text Props (new)
    const letterSpacing = getCommonValue(selectedObjects, 'letterSpacing', 0);
    const lineHeight = getCommonValue(selectedObjects, 'lineHeight', 1.2);
    const stroke = getCommonValue(selectedObjects, 'stroke', 'transparent');
    const strokeWidth = getCommonValue(selectedObjects, 'strokeWidth', 0);
    const opacity = getCommonValue(selectedObjects, 'opacity', 1);

    // Curved Text
    const isCurved = getCommonValue(selectedObjects, 'isCurved', false);
    const curveRadius = getCommonValue(selectedObjects, 'curveRadius', 100);

    const toggleStyle = (type: 'bold' | 'italic' | 'underline') => {
        let newStyle = fontStyleStr === 'mixed' ? '' : fontStyleStr;
        let newWeight = getCommonValue(selectedObjects, 'fontWeight', 'normal');
        let newDecoration = getCommonValue(selectedObjects, 'textDecoration', '');

        if (type === 'bold') {
            newWeight = isBold ? 'normal' : 'bold';
            // Also update style string for Konva compatibility sometimes
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

        updateAll({
            fontStyle: newStyle,
            fontWeight: newWeight,
            textDecoration: newDecoration
        });
    };

    return (
        <div className="space-y-6">

            {/* Typography Section */}
            <div className="space-y-3 pt-2">
                <PropertyLabel label="Typography" icon={<Type size={12} />} />

                {/* Font Family (Simple select for now) */}
                <select
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-2 text-xs text-white outline-none focus:border-blue-500/50"
                    value={fontFamily === 'mixed' ? '' : fontFamily}
                    onChange={(e) => updateAll({ fontFamily: e.target.value })}
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
                        value={fontSize}
                        onChange={(v) => updateAll({ fontSize: v })}
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
                        active={align === 'left'}
                        onClick={() => updateAll({ align: 'left' })}
                        title="Align Left"
                    />
                    <IconButton
                        icon={<AlignCenter size={14} />}
                        active={align === 'center'}
                        onClick={() => updateAll({ align: 'center' })}
                        title="Align Center"
                    />
                    <IconButton
                        icon={<AlignRight size={14} />}
                        active={align === 'right'}
                        onClick={() => updateAll({ align: 'right' })}
                        title="Align Right"
                    />
                </div>

                {/* Color */}
                <div>
                    <span className="text-[9px] text-zinc-500 mb-2 block">Text Color</span>
                    <ColorGrid
                        current={color}
                        recentColors={recentColors}
                        onSelect={(c) => { addColorToHistory(c); updateAll({ fill: c }); }}
                    />
                </div>
            </div>

            {/* Spacing & Layout */}
            <div className="space-y-4 pt-4 border-t border-white/5">
                <PropertyLabel label="Spacing" icon={<MoveHorizontal size={12} />} />

                <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] text-zinc-400">
                        <span>Letter Spacing</span>
                        <span>{letterSpacing}px</span>
                    </div>
                    <Slider
                        value={letterSpacing === 'mixed' ? 0 : letterSpacing}
                        min={-5} max={20} step={0.5}
                        onChange={(v) => updateAll({ letterSpacing: v })}
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] text-zinc-400">
                        <span>Line Height</span>
                        <span>{lineHeight}</span>
                    </div>
                    <Slider
                        value={lineHeight === 'mixed' ? 1.2 : lineHeight}
                        min={0.8} max={3} step={0.1}
                        onChange={(v) => updateAll({ lineHeight: v })}
                    />
                </div>

                <div className="flex items-center justify-between pt-2">
                    <span className="text-[10px] text-zinc-400">Fixed Width (Wrap)</span>
                    <ToggleButton
                        active={getCommonValue(selectedObjects, 'isWrapped', true)}
                        onClick={() => updateAll({ isWrapped: !getCommonValue(selectedObjects, 'isWrapped', true) })}
                    />
                </div>
            </div>

            {/* Effects */}
            <div className="space-y-4 pt-4 border-t border-white/5">
                <PropertyLabel label="Effects" icon={<Sparkles size={12} />} />

                <div>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[9px] text-zinc-500">Outline Width</span>
                        <span className="text-[9px] text-zinc-400">{strokeWidth}px</span>
                    </div>
                    <Slider
                        value={strokeWidth === 'mixed' ? 0 : strokeWidth}
                        min={0} max={10} step={0.5}
                        onChange={(v) => updateAll({ strokeWidth: v })}
                    />
                </div>

                {strokeWidth > 0 && (
                    <div>
                        <span className="text-[9px] text-zinc-500 mb-2 block">Outline Color</span>
                        <ColorGrid
                            current={stroke}
                            recentColors={recentColors}
                            onSelect={(c) => { addColorToHistory(c); updateAll({ stroke: c }); }}
                        />
                    </div>
                )}
            </div>

            {/* Advanced / Curved */}
            <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between">
                    <PropertyLabel label="Curved Text" icon={<Spline size={12} />} />
                    <ToggleButton
                        active={isCurved}
                        onClick={() => updateAll({ isCurved: !isCurved })}
                    />
                </div>

                {isCurved && (
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] text-zinc-400">
                            <span>Radius</span>
                            <span>{curveRadius}</span>
                        </div>
                        <Slider
                            value={curveRadius === 'mixed' ? 100 : curveRadius}
                            min={20} max={1000} step={10}
                            onChange={(v) => updateAll({ curveRadius: v })}
                        />
                    </div>
                )}
            </div>

        </div>
    );
};
