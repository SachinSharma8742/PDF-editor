import React from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { usePDFStore } from '../../../store/pdfStore';
import {
    Sun, Contrast, Ghost, Palette, Sliders, Droplet
} from 'lucide-react';
import clsx from 'clsx';

// Reusing FilterSlider from ImageEditorPanel or making a local one
const FilterSlider = ({ label, icon, value, min, max, step, onChange, formatValue }: any) => {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-zinc-400">
                <div className="flex items-center gap-2 text-[10px] font-medium uppercase">
                    {icon} <span>{label}</span>
                </div>
                <span className="text-[10px] font-mono">{formatValue ? formatValue(value) : value}</span>
            </div>
            <input
                type="range"
                min={min} max={max} step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
        </div>
    );
};

const SectionLabel = ({ label, icon }: { label: string, icon: React.ReactNode }) => (
    <div className="flex items-center gap-2 text-zinc-500 pb-2 border-b border-white/5">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </div>
);

export const PageEffectsPanel: React.FC = () => {
    const { currentPage } = useEditorStore();
    const { updatePage } = usePDFStore();

    if (!currentPage) return (
        <div className="p-4 text-center text-zinc-500 text-sm">No page selected</div>
    );

    const filters = currentPage.pageFilters || {
        brightness: 1,
        contrast: 1,
        grayscale: 0,
        sepia: 0,
        invert: 0,
        blur: 0,
        hueRotate: 0
    };

    const background = currentPage.pageBackground || {
        color: '#ffffff',
        opacity: 0
    };

    const handleFilterChange = (key: string, value: number) => {
        updatePage(currentPage.id, {
            pageFilters: {
                ...filters,
                [key]: value
            }
        });
    };

    const handleBgChange = (updates: any) => {
        updatePage(currentPage.id, {
            pageBackground: {
                ...background,
                ...updates
            }
        });
    };

    const PRESET_COLORS = [
        '#ffffff', // Default White
        '#f8fafc', // Slate 50
        '#fefce8', // Yellow 50 (Warm)
        '#f0fdf4', // Green 50 (Mint)
        '#eff6ff', // Blue 50 (Cool)
        '#fafafa', // Zinc 50
        '#18181b', // Dark
        '#000000', // Black
    ];

    return (
        <div className="px-4 py-6 space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">

            {/* Page Background */}
            <div className="space-y-6">
                <SectionLabel label="Background" icon={<Palette size={12} />} />

                <div className="space-y-3">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Color Overlay</span>
                    <div className="grid grid-cols-4 gap-2">
                        {PRESET_COLORS.map(color => (
                            <button
                                key={color}
                                onClick={() => handleBgChange({ color, opacity: background.opacity === 0 ? 1 : background.opacity })}
                                className={clsx(
                                    "w-full aspect-square rounded-md border transition-all hover:scale-105",
                                    background.color === color ? "border-blue-500 ring-2 ring-blue-500/20" : "border-white/10 hover:border-white/30"
                                )}
                                style={{ backgroundColor: color }}
                                title={color}
                            />
                        ))}
                    </div>
                </div>

                <FilterSlider
                    label="Overlay Opacity"
                    icon={<Droplet size={14} />}
                    value={background.opacity ?? 0}
                    min={0} max={1} step={0.05}
                    onChange={(v: number) => handleBgChange({ opacity: v })}
                    formatValue={(v: number) => Math.round(v * 100) + '%'}
                />
            </div>

            {/* Global Filters */}
            <div className="space-y-6">
                <SectionLabel label="Global Filters" icon={<Sliders size={12} />} />

                <FilterSlider
                    label="Brightness"
                    icon={<Sun size={14} />}
                    value={filters.brightness}
                    min={0} max={2} step={0.05}
                    onChange={(v: number) => handleFilterChange('brightness', v)}
                />

                <FilterSlider
                    label="Contrast"
                    icon={<Contrast size={14} />}
                    value={filters.contrast}
                    min={0} max={2} step={0.05}
                    onChange={(v: number) => handleFilterChange('contrast', v)}
                />

                <FilterSlider
                    label="Grayscale"
                    icon={<Ghost size={14} />}
                    value={filters.grayscale}
                    min={0} max={1} step={0.05}
                    onChange={(v: number) => handleFilterChange('grayscale', v)}
                    formatValue={(v: number) => Math.round(v * 100) + '%'}
                />

                <FilterSlider
                    label="Invert (Night Mode)"
                    icon={<Ghost size={14} />}
                    value={filters.invert}
                    min={0} max={1} step={0.05}
                    onChange={(v: number) => handleFilterChange('invert', v)}
                    formatValue={(v: number) => Math.round(v * 100) + '%'}
                />
            </div>

            {/* Reset Button */}
            <div className="pt-4 border-t border-white/5">
                <button
                    onClick={() => updatePage(currentPage.id, {
                        pageFilters: undefined,
                        pageBackground: undefined
                    })}
                    className="w-full py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-white hover:bg-white/5 rounded transition-colors"
                >
                    Reset Page Effects
                </button>
            </div>

        </div>
    );
};
