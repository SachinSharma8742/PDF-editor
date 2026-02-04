import React from 'react';
import { useEditorStore } from '../../../../store/editorStore';
import type { PDFObject } from '../../../../store/pdfStore';
import { FlipHorizontal, FlipVertical, Wand2, SlidersHorizontal, Square, Check, X, Palette, BoxSelect } from 'lucide-react';
import { PropertyLabel, Slider, IconButton, ColorGrid } from './PropertyComponents';

// Helper for mixed values
const getCommonValue = (objects: PDFObject[], key: keyof PDFObject, fallback: any): any => {
    if (objects.length === 0) return fallback;
    const val = objects[0][key];
    for (let i = 1; i < objects.length; i++) {
        if (objects[i][key] !== val) return 'mixed';
    }
    return val ?? fallback;
};

export const ImagePropertyPanel: React.FC = () => {
    const { selectedObjectIds, currentPage, updateObject, recentColors } = useEditorStore();

    if (!currentPage) return null;
    const selectedObjects = currentPage.objects.filter(o => selectedObjectIds.includes(o.id));
    if (selectedObjects.length === 0) return null;

    const updateAll = (updates: Partial<PDFObject>) => {
        selectedObjects.forEach(obj => updateObject(obj.id, updates));
    };

    // Transform Props
    const flipX = getCommonValue(selectedObjects, 'flipX', false);
    const flipY = getCommonValue(selectedObjects, 'flipY', false);
    const skewX = getCommonValue(selectedObjects, 'skewX', 0);
    const skewY = getCommonValue(selectedObjects, 'skewY', 0);

    // Filter Props
    const brightness = getCommonValue(selectedObjects, 'brightness', 0);
    const contrast = getCommonValue(selectedObjects, 'contrast', 0);
    const saturation = getCommonValue(selectedObjects, 'saturation', 0);
    const blurRadius = getCommonValue(selectedObjects, 'blurRadius', 0);
    const hue = getCommonValue(selectedObjects, 'hue', 0);
    const noise = getCommonValue(selectedObjects, 'noise', 0);

    // Style Props
    const stroke = getCommonValue(selectedObjects, 'stroke', null);
    const strokeWidth = getCommonValue(selectedObjects, 'strokeWidth', 0);
    const shadowColor = getCommonValue(selectedObjects, 'shadowColor', null);
    const shadowBlur = getCommonValue(selectedObjects, 'shadowBlur', 0);
    const shadowOpacity = getCommonValue(selectedObjects, 'shadowOpacity', 0);
    const shadowOffsetX = getCommonValue(selectedObjects, 'shadowOffsetX', 0);
    const shadowOffsetY = getCommonValue(selectedObjects, 'shadowOffsetY', 0);

    return (
        <div className="space-y-6">

            {/* Transform */}
            <div className="space-y-3 pt-2">
                <PropertyLabel label="Transform & Orientation" icon={<SlidersHorizontal size={12} />} />
                {/* Note: Scissors is not imported, let's use SlidersHorizontal or similar. Replaced with SlidersHorizontal below */}

                <div className="flex bg-white/[0.03] rounded-xl border border-white/10 p-1 mb-3">
                    <IconButton
                        icon={<FlipHorizontal size={14} />}
                        active={flipX}
                        onClick={() => updateAll({ flipX: !flipX })}
                        title="Flip Horizontal"
                    />
                    <IconButton
                        icon={<FlipVertical size={14} />}
                        active={flipY}
                        onClick={() => updateAll({ flipY: !flipY })}
                        title="Flip Vertical"
                    />
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] text-zinc-400">
                            <span>Skew X</span>
                            <span>{skewX !== 'mixed' ? Math.round(skewX * 100) / 100 : '-'}</span>
                        </div>
                        <Slider
                            value={skewX === 'mixed' ? 0 : skewX}
                            min={-2} max={2} step={0.1}
                            onChange={(v) => updateAll({ skewX: v })}
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] text-zinc-400">
                            <span>Skew Y</span>
                            <span>{skewY !== 'mixed' ? Math.round(skewY * 100) / 100 : '-'}</span>
                        </div>
                        <Slider
                            value={skewY === 'mixed' ? 0 : skewY}
                            min={-2} max={2} step={0.1}
                            onChange={(v) => updateAll({ skewY: v })}
                        />
                    </div>
                </div>
            </div>

            {/* Adjustments */}
            <div className="space-y-4 pt-4 border-t border-white/5">
                <PropertyLabel label="Color Adjustments" icon={<Wand2 size={12} />} />

                <div className="space-y-3">
                    {/* Brightness */}
                    <div>
                        <div className="flex justify-between text-[9px] text-zinc-500 mb-1">
                            <span>Brightness</span>
                            <span>{Math.round((brightness === 'mixed' ? 0 : brightness) * 100)}%</span>
                        </div>
                        <Slider
                            value={brightness === 'mixed' ? 0 : brightness}
                            min={-1} max={1} step={0.05}
                            onChange={(v) => updateAll({ brightness: v })}
                        />
                    </div>

                    {/* Contrast */}
                    <div>
                        <div className="flex justify-between text-[9px] text-zinc-500 mb-1">
                            <span>Contrast</span>
                            <span>{Math.round((contrast === 'mixed' ? 0 : contrast) * 100)}%</span>
                        </div>
                        <Slider
                            value={contrast === 'mixed' ? 0 : contrast}
                            min={-100} max={100} step={1}
                            // Konva contrast is usually -100 to 100? Or -1 to 1?
                            // Konva docs: value range is from -100 to 100.
                            onChange={(v) => updateAll({ contrast: v })}
                        />
                    </div>

                    {/* Saturation */}
                    <div>
                        <div className="flex justify-between text-[9px] text-zinc-500 mb-1">
                            <span>Saturation</span>
                            <span>{Math.round((saturation === 'mixed' ? 0 : saturation) * 100)}%</span>
                        </div>
                        <Slider
                            value={saturation === 'mixed' ? 0 : saturation}
                            min={-2} max={10} step={0.1}
                            // Konva HSL saturation: 0 is grayscale, 1 is normal, >1 is saturated.
                            onChange={(v) => updateAll({ saturation: v })}
                        />
                    </div>

                    {/* Hue */}
                    <div>
                        <div className="flex justify-between text-[9px] text-zinc-500 mb-1">
                            <span>Hue Rotate</span>
                            <span>{Math.round(hue === 'mixed' ? 0 : hue)}°</span>
                        </div>
                        <Slider
                            value={hue === 'mixed' ? 0 : hue}
                            min={0} max={360} step={1}
                            onChange={(v) => updateAll({ hue: v })}
                        />
                    </div>

                    {/* Blur */}
                    <div>
                        <div className="flex justify-between text-[9px] text-zinc-500 mb-1">
                            <span>Blur</span>
                            <span>{blurRadius === 'mixed' ? 0 : blurRadius}px</span>
                        </div>
                        <Slider
                            value={blurRadius === 'mixed' ? 0 : blurRadius}
                            min={0} max={40} step={0.5}
                            onChange={(v) => updateAll({ blurRadius: v })}
                        />
                    </div>

                    {/* Noise */}
                    <div>
                        <div className="flex justify-between text-[9px] text-zinc-500 mb-1">
                            <span>Noise</span>
                            <span>{Math.round((noise === 'mixed' ? 0 : noise) * 100)}%</span>
                        </div>
                        <Slider
                            value={noise === 'mixed' ? 0 : noise}
                            min={0} max={1} step={0.05}
                            onChange={(v) => updateAll({ noise: v })}
                        />
                    </div>
                </div>
            </div>

            {/* Border */}
            <div className="space-y-4 pt-4 border-t border-white/5">
                <PropertyLabel label="Border" icon={<BoxSelect size={12} />} />
                <div className="space-y-3">
                    <div>
                        <div className="text-[9px] text-zinc-500 mb-2">Color</div>
                        <ColorGrid
                            current={stroke || 'transparent'}
                            onSelect={(c: string) => updateAll({ stroke: c })}
                            recentColors={recentColors}
                        />
                    </div>
                    <div>
                        <div className="flex justify-between text-[9px] text-zinc-500 mb-1">
                            <span>Width</span>
                            <span>{strokeWidth}px</span>
                        </div>
                        <Slider
                            value={strokeWidth === 'mixed' ? 0 : strokeWidth}
                            min={0} max={20} step={1}
                            onChange={(v) => updateAll({ strokeWidth: v })}
                        />
                    </div>
                </div>
            </div>

            {/* Shadow */}
            <div className="space-y-4 pt-4 border-t border-white/5">
                <PropertyLabel label="Shadow" icon={<Palette size={12} />} />
                <div className="space-y-3">
                    <div>
                        <div className="text-[9px] text-zinc-500 mb-2">Color</div>
                        <ColorGrid
                            current={shadowColor || 'transparent'}
                            onSelect={(c: string) => updateAll({ shadowColor: c })}
                            recentColors={recentColors}
                        />
                    </div>
                    <div>
                        <div className="flex justify-between text-[9px] text-zinc-500 mb-1">
                            <span>Blur</span>
                            <span>{shadowBlur}px</span>
                        </div>
                        <Slider
                            value={shadowBlur === 'mixed' ? 0 : shadowBlur}
                            min={0} max={50} step={1}
                            onChange={(v) => updateAll({ shadowBlur: v })}
                        />
                    </div>
                    <div>
                        <div className="flex justify-between text-[9px] text-zinc-500 mb-1">
                            <span>Opacity</span>
                            <span>{Math.round((shadowOpacity === 'mixed' ? 0 : shadowOpacity) * 100)}%</span>
                        </div>
                        <Slider
                            value={shadowOpacity === 'mixed' ? 0 : shadowOpacity}
                            min={0} max={1} step={0.05}
                            onChange={(v) => updateAll({ shadowOpacity: v })}
                        />
                    </div>
                    <div>
                        <div className="flex justify-between text-[9px] text-zinc-500 mb-1">
                            <span>Offset X</span>
                            <span>{shadowOffsetX}px</span>
                        </div>
                        <Slider
                            value={shadowOffsetX === 'mixed' ? 0 : shadowOffsetX}
                            min={-50} max={50} step={1}
                            onChange={(v) => updateAll({ shadowOffsetX: v })}
                        />
                    </div>
                    <div>
                        <div className="flex justify-between text-[9px] text-zinc-500 mb-1">
                            <span>Offset Y</span>
                            <span>{shadowOffsetY}px</span>
                        </div>
                        <Slider
                            value={shadowOffsetY === 'mixed' ? 0 : shadowOffsetY}
                            min={-50} max={50} step={1}
                            onChange={(v) => updateAll({ shadowOffsetY: v })}
                        />
                    </div>
                </div>
            </div>

        </div>
    );
};
