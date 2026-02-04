import React, { useMemo } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import {
    ArrowLeftToLine, ArrowRightToLine, AlignHorizontalJustifyCenter,
    ArrowUpToLine, ArrowDownToLine, AlignVerticalJustifyCenter,
    Trash2, Layers, Copy, Group, Ungroup,
    Type, Image as ImageIcon, Box, PenTool, MousePointer2,
    Palette, Settings2, Sparkles, Hash, LayoutGrid, Move
} from 'lucide-react';
import type { PDFObject } from '../../../store/pdfStore';
import clsx from 'clsx';

// Helper for mixed values
const getCommonValue = (objects: PDFObject[], key: keyof PDFObject, fallback: any): any => {
    if (objects.length === 0) return fallback;
    const val = objects[0][key];
    for (let i = 1; i < objects.length; i++) {
        if (objects[i][key] !== val) return 'mixed';
    }
    return val ?? fallback;
};

export const EditorProperties: React.FC = () => {
    const {
        selectedObjectIds,
        currentPage,
        updateObject,
        deleteObjects,
        duplicateObject,
        groupObjects,
        ungroupObjects,
        activeTool,
        toolPreferences,
        updateToolSettings,
        recentColors,
        addColorToHistory
    } = useEditorStore();

    const colorInputRef = React.useRef<HTMLInputElement>(null);

    const selectedObjects = useMemo(() => {
        if (!currentPage) return [];
        return currentPage.objects.filter(o => selectedObjectIds.includes(o.id));
    }, [currentPage, selectedObjectIds]);

    const hasSelection = selectedObjects.length > 0;
    const currentToolSettings = toolPreferences[activeTool];

    // --- RENDER NO SELECTION (Minimal fallback) ---
    if (!hasSelection) {
        return (
            <div className="flex flex-col h-full bg-[#1e1e20] items-center justify-center py-20 opacity-20 space-y-4 grayscale select-none">
                <LayoutGrid size={48} />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Select an object to edit</span>
            </div>
        );
    }

    // --- RENDER SELECTION PROPERTIES ---
    const firstObj = selectedObjects[0];
    const isMulti = selectedObjects.length > 1;
    const canUngroup = selectedObjects.some(o => !!o.groupId);

    const rotation = getCommonValue(selectedObjects, 'rotation', 0);
    const opacity = getCommonValue(selectedObjects, 'opacity', 1);

    // Helper to get actual object dimensions (handles paths/lines with points)
    const getObjectDimensions = (obj: PDFObject) => {
        let w = obj.width || 0;
        let h = obj.height || 0;

        // For paths/lines/arrows, calculate from points if width/height not set
        if ((!w || !h) && obj.points && obj.points.length >= 4) {
            const xs = obj.points.filter((_, i) => i % 2 === 0);
            const ys = obj.points.filter((_, i) => i % 2 === 1);
            if (xs.length > 0 && ys.length > 0) {
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);
                if (!w) w = maxX - minX;
                if (!h) h = maxY - minY;
            }
        }

        return { w, h };
    };

    const handleAlign = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
        if (selectedObjects.length === 0 || !currentPage) return;

        // Use actual page dimensions from the current page
        const canvasWidth = currentPage.width;
        const canvasHeight = currentPage.height;


        if (selectedObjects.length === 1) {
            const obj = selectedObjects[0];
            const { w, h } = getObjectDimensions(obj);


            let newX = obj.x;
            let newY = obj.y;

            // Position object so its center/edge aligns with canvas
            switch (type) {
                case 'left': newX = 0; break;
                case 'center': newX = (canvasWidth - w) / 2; break;
                case 'right': newX = canvasWidth - w; break;
                case 'top': newY = 0; break;
                case 'middle': newY = (canvasHeight - h) / 2; break;
                case 'bottom': newY = canvasHeight - h; break;
            }


            updateObject(obj.id, { x: newX, y: newY });
            return;
        }

        // Multiple objects - align centers within bounding box
        const getCenter = (o: typeof selectedObjects[0]) => {
            const { w, h } = getObjectDimensions(o);
            return {
                cx: o.x + w / 2,
                cy: o.y + h / 2
            };
        };

        const centers = selectedObjects.map(getCenter);
        const minCx = Math.min(...centers.map(c => c.cx));
        const maxCx = Math.max(...centers.map(c => c.cx));
        const minCy = Math.min(...centers.map(c => c.cy));
        const maxCy = Math.max(...centers.map(c => c.cy));
        const midCx = (minCx + maxCx) / 2;
        const midCy = (minCy + maxCy) / 2;

        selectedObjects.forEach(obj => {
            const { w, h } = getObjectDimensions(obj);
            let newX = obj.x;
            let newY = obj.y;

            switch (type) {
                case 'left': newX = minCx - w / 2; break;
                case 'center': newX = midCx - w / 2; break;
                case 'right': newX = maxCx - w / 2; break;
                case 'top': newY = minCy - h / 2; break;
                case 'middle': newY = midCy - h / 2; break;
                case 'bottom': newY = maxCy - h / 2; break;
            }

            updateObject(obj.id, { x: newX, y: newY });
        });
    };

    const handleRotationChange = (newRotation: number) => {
        // Since objects now use center-based rendering (offsetX/offsetY),
        // we can simply update rotation without recalculating position
        selectedObjects.forEach(obj => {
            updateObject(obj.id, { rotation: newRotation });
        });
    };

    return (
        <div className="flex flex-col h-full bg-[#1e1e20] text-white">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5 bg-[#18181b] sticky top-0 z-10 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {isMulti ? <Layers size={14} /> :
                            firstObj.type === 'text' ? <Type size={14} /> :
                                firstObj.type === 'path' ? <PenTool size={14} /> :
                                    firstObj.type === 'image' ? <ImageIcon size={14} /> :
                                        <Box size={14} />
                        }
                    </div>
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-tight text-zinc-200">
                            {isMulti ? `${selectedObjects.length} Selected` : firstObj.type}
                        </h3>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest leading-none mt-1">Properties</p>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-10">
                {/* Actions Section */}
                <div className="space-y-4">
                    <PropertyLabel label="Quick Actions" />
                    <div className="grid grid-cols-2 gap-2">
                        <ActionButton
                            label="Clone"
                            icon={<Copy size={13} />}
                            onClick={() => duplicateObject(selectedObjectIds)}
                        />
                        <ActionButton
                            label="Delete"
                            icon={<Trash2 size={13} />}
                            variant="danger"
                            onClick={() => deleteObjects(selectedObjectIds)}
                        />
                    </div>
                    {isMulti && (
                        <ActionButton
                            label={canUngroup ? "Ungroup" : "Group Selection"}
                            icon={canUngroup ? <Ungroup size={13} /> : <Group size={13} />}
                            onClick={() => canUngroup ? ungroupObjects(selectedObjectIds) : groupObjects(selectedObjectIds)}
                            className="w-full"
                        />
                    )}
                </div>

                {/* Style & Content Controls */}
                <div className="space-y-4">
                    <PropertyLabel label="Style & Appearance" />

                    {/* Opacity - Common to all */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] text-zinc-400">
                            <span>Opacity</span>
                            <span>{Math.round(opacity * 100)}%</span>
                        </div>
                        <Slider
                            value={opacity} min={0} max={1} step={0.01}
                            onChange={(v) => {
                                selectedObjects.forEach(o => updateObject(o.id, { opacity: v }));
                            }}
                        />
                    </div>

                    {/* Text Specific */}
                    {firstObj.type === 'text' && (
                        <div className="space-y-3 pt-2 border-t border-white/5">
                            <PropertyLabel label="Typography" icon={<Type size={12} />} />
                            <SimpleInput
                                label="Font Size"
                                value={getCommonValue(selectedObjects, 'fontSize', 16)}
                                onChange={(v) => selectedObjects.forEach(o => updateObject(o.id, { fontSize: v }))}
                            />
                            {/* Color Picker for Text */}
                            <div>
                                <span className="text-[9px] text-zinc-500 mb-2 block">Color</span>
                                <ColorGrid
                                    current={getCommonValue(selectedObjects, 'fill', '#000000')}
                                    recentColors={recentColors}
                                    onSelect={(c) => {
                                        addColorToHistory(c);
                                        selectedObjects.forEach(o => updateObject(o.id, { fill: c }));
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Shape Specific (Fill/Stroke) */}
                    {(firstObj.type === 'rectangle' || firstObj.type === 'circle' || firstObj.type === 'triangle' || firstObj.type === 'star' || firstObj.type === 'polygon') && (
                        <div className="space-y-3 pt-2 border-t border-white/5">
                            <PropertyLabel label="Fill & Stroke" icon={<Palette size={12} />} />
                            <div>
                                <span className="text-[9px] text-zinc-500 mb-2 block">Fill Color</span>
                                <ColorGrid
                                    current={getCommonValue(selectedObjects, 'fill', 'transparent')}
                                    recentColors={recentColors}
                                    onSelect={(c) => {
                                        addColorToHistory(c);
                                        selectedObjects.forEach(o => updateObject(o.id, { fill: c }));
                                    }}
                                />
                            </div>
                            <div>
                                <span className="text-[9px] text-zinc-500 mb-2 block">Stroke Color</span>
                                <ColorGrid
                                    current={getCommonValue(selectedObjects, 'stroke', '#000000')}
                                    recentColors={recentColors}
                                    onSelect={(c) => {
                                        addColorToHistory(c);
                                        selectedObjects.forEach(o => updateObject(o.id, { stroke: c }));
                                    }}
                                />
                            </div>
                            <SimpleInput
                                label="Thickness"
                                value={getCommonValue(selectedObjects, 'strokeWidth', 2)}
                                onChange={(v) => selectedObjects.forEach(o => updateObject(o.id, { strokeWidth: v }))}
                            />
                        </div>
                    )}

                    {/* Image Specific (Crop) */}
                    {firstObj.type === 'image' && (
                        <div className="space-y-3 pt-2 border-t border-white/5">
                            <PropertyLabel label="Image Tools" icon={<ImageIcon size={12} />} />
                            <ActionButton
                                label={useEditorStore.getState().isCropping ? "Done Cropping" : "Crop Image"}
                                icon={<Box size={13} />}
                                onClick={() => useEditorStore.getState().setCropping(!useEditorStore.getState().isCropping)}
                                className={useEditorStore.getState().isCropping ? "bg-blue-600 text-white" : ""}
                            />
                        </div>
                    )}
                </div>

                {/* Layout & Alignment */}
                <div className="space-y-4">
                    <PropertyLabel label="Align to Canvas" />
                    <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5 space-y-3">
                        {/* Horizontal Alignment */}
                        <div>
                            <span className="text-[9px] text-zinc-500 uppercase tracking-wider mb-2 block">Horizontal</span>
                            <div className="grid grid-cols-3 gap-2">
                                <button onClick={() => handleAlign('left')} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-all">
                                    <ArrowLeftToLine size={16} className="text-zinc-400" />
                                    <span className="text-[9px] text-zinc-500">Left</span>
                                </button>
                                <button onClick={() => handleAlign('center')} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-all">
                                    <AlignHorizontalJustifyCenter size={16} className="text-zinc-400" />
                                    <span className="text-[9px] text-zinc-500">Center</span>
                                </button>
                                <button onClick={() => handleAlign('right')} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-all">
                                    <ArrowRightToLine size={16} className="text-zinc-400" />
                                    <span className="text-[9px] text-zinc-500">Right</span>
                                </button>
                            </div>
                        </div>
                        {/* Vertical Alignment */}
                        <div>
                            <span className="text-[9px] text-zinc-500 uppercase tracking-wider mb-2 block">Vertical</span>
                            <div className="grid grid-cols-3 gap-2">
                                <button onClick={() => handleAlign('top')} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-all">
                                    <ArrowUpToLine size={16} className="text-zinc-400" />
                                    <span className="text-[9px] text-zinc-500">Top</span>
                                </button>
                                <button onClick={() => handleAlign('middle')} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-all">
                                    <AlignVerticalJustifyCenter size={16} className="text-zinc-400" />
                                    <span className="text-[9px] text-zinc-500">Middle</span>
                                </button>
                                <button onClick={() => handleAlign('bottom')} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-all">
                                    <ArrowDownToLine size={16} className="text-zinc-400" />
                                    <span className="text-[9px] text-zinc-500">Bottom</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Transform Section */}
                <div className="space-y-4">
                    <PropertyLabel label="Transform" />
                    <div className="grid grid-cols-2 gap-3">
                        <SimpleInput label="X" value={Math.round(firstObj.x)} disabled={isMulti} onChange={(v: number) => updateObject(firstObj.id, { x: v })} />
                        <SimpleInput label="Y" value={Math.round(firstObj.y)} disabled={isMulti} onChange={(v: number) => updateObject(firstObj.id, { y: v })} />
                        <SimpleInput label="W" value={Math.round(firstObj.width || 0)} disabled={isMulti} onChange={(v: number) => updateObject(firstObj.id, { width: v })} />
                        <SimpleInput label="H" value={Math.round(firstObj.height || 0)} disabled={isMulti} onChange={(v: number) => updateObject(firstObj.id, { height: v })} />
                        <SimpleInput label="R" value={rotation === 'mixed' ? '-' : Math.round(rotation)} className="col-span-2" suffix="°" onChange={(v: number) => handleRotationChange(v)} />
                    </div>
                </div>



            </div>
        </div>
    );
};

// --- PURE UI COMPONENTS ---

const PropertyLabel = ({ label, icon }: { label: string, icon?: React.ReactNode }) => (
    <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-[0.15em]">
        {icon} <span>{label}</span>
    </div>
);

const ToggleButton = ({ active, onClick }: { active: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={clsx(
            "relative inline-flex h-5 w-10 items-center rounded-full transition-all duration-300",
            active ? 'bg-blue-600' : 'bg-zinc-800'
        )}
    >
        <div className={clsx("h-3 w-3 rounded-full bg-white transition-all", active ? 'translate-x-6' : 'translate-x-1')} />
    </button>
);

const ColorGrid = ({ current, onSelect, recentColors }: { current: string, onSelect: (c: string) => void, recentColors: string[] }) => (
    <div className="grid grid-cols-6 gap-2">
        {recentColors.slice(0, 5).map((color, i) => (
            <button
                key={i}
                onClick={() => onSelect(color)}
                className={clsx(
                    "aspect-square rounded-full border border-white/10 transition-transform active:scale-95",
                    current === color && "ring-2 ring-blue-500 ring-offset-2 ring-offset-[#121214]"
                )}
                style={{ backgroundColor: color }}
            />
        ))}
        <div className="relative aspect-square rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center overflow-hidden hover:bg-zinc-700">
            <input
                type="color"
                value={current}
                onChange={(e) => onSelect(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <Palette size={12} className="text-zinc-500" />
        </div>
    </div>
);

const Slider = ({ value, min, max, step = 1, onChange, isPercent = false }: { value: number, min: number, max: number, step?: number, onChange: (v: number) => void, isPercent?: boolean }) => (
    <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
    />
);

const SimpleInput = ({ label, value, onChange, disabled, className, suffix }: { label: string, value: string | number, onChange: (v: number) => void, disabled?: boolean, className?: string, suffix?: string }) => (
    <div className={clsx("relative group", className)}>
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-zinc-600 transition-colors group-hover:text-zinc-400">{label}</span>
        <input
            type="number"
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-2.5 pl-8 text-xs font-mono text-white outline-none focus:border-blue-500/50 transition-all text-right"
        />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600">{suffix}</span>}
    </div>
);

const ActionButton = ({ label, icon, onClick, variant, className }: { label: string, icon: React.ReactNode, onClick: () => void, variant?: 'danger', className?: string }) => (
    <button
        onClick={onClick}
        className={clsx(
            "flex items-center justify-center gap-2 p-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
            variant === 'danger'
                ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20'
                : 'bg-white/[0.03] text-zinc-300 border border-white/10 hover:bg-white/[0.08] hover:border-white/20',
            className
        )}
    >
        {icon} {label}
    </button>
);

const IconButton = ({ icon, onClick, title }: { icon: React.ReactNode, onClick: () => void, title: string }) => (
    <button
        onClick={onClick}
        title={title}
        className="flex-1 flex items-center justify-center p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
    >
        {icon}
    </button>
);
