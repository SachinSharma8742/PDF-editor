import React, { useMemo } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import {
    ArrowLeftToLine, ArrowRightToLine, AlignHorizontalJustifyCenter,
    ArrowUpToLine, ArrowDownToLine, AlignVerticalJustifyCenter,
    Trash2, Layers, Copy, Group, Ungroup,
    Type, Image as ImageIcon, Box, PenTool,
    Zap, PaintBucket, LayoutTemplate, Scaling, Wand2, Sparkles
} from 'lucide-react';
import type { PDFObject } from '../../../store/pdfStore';
import { ActionButton, SimpleInput, Slider, ColorGrid } from './properties/PropertyComponents';
import { CollapsibleSection } from './properties/CollapsibleSection';

import { PagePropertyPanel } from './properties/PagePropertyPanel';
import { EffectInspector } from './properties/EffectInspector';

// Helper for mixed values
const getCommonValue = <K extends keyof PDFObject>(objects: PDFObject[], key: K, fallback: PDFObject[K]): PDFObject[K] | 'mixed' | undefined => {
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
        recentColors,
        addColorToHistory
    } = useEditorStore();

    const selectedObjects = useMemo(() => {
        if (!currentPage) return [];
        return currentPage.objects.filter(o => selectedObjectIds.includes(o.id));
    }, [currentPage, selectedObjectIds]);

    const hasSelection = selectedObjects.length > 0;

    // --- RENDER NO SELECTION (Simple Page Properties) ---
    if (!hasSelection) {
        return <PagePropertyPanel />;
    }

    // --- RENDER SELECTION PROPERTIES ---
    const firstObj = selectedObjects[0];
    const isMulti = selectedObjects.length > 1;
    const canUngroup = selectedObjects.some(o => !!o.groupId);
    const isShape = ['rectangle', 'circle', 'triangle', 'star', 'polygon', 'ellipse', 'heart', 'cloud', 'lightning', 'drop', 'callout-bubble'].includes(firstObj.type);

    const rotation = getCommonValue(selectedObjects, 'rotation', 0) as number | 'mixed';
    const opacity = getCommonValue(selectedObjects, 'opacity', 1) as number;

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
        const canvasWidth = currentPage.width;
        const canvasHeight = currentPage.height;

        if (selectedObjects.length === 1) {
            const obj = selectedObjects[0];
            const { w, h } = getObjectDimensions(obj);
            let newX = obj.x;
            let newY = obj.y;

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

        // Multiple objects
        const getCenter = (o: typeof selectedObjects[0]) => {
            const { w, h } = getObjectDimensions(o);
            return { cx: o.x + w / 2, cy: o.y + h / 2 };
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
                                        firstObj.type === 'effect' ? <Sparkles size={14} /> :
                                            <Box size={14} />
                        }
                    </div>
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-tight text-zinc-200">
                            {isMulti ? `${selectedObjects.length} Selected` : (firstObj.type === 'effect' ? `Effect: ${firstObj.name || 'Adjustment Layer'}` : firstObj.type)}
                        </h3>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest leading-none mt-1">Properties</p>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-2">
                {/* Effect Inspector (If applicable) */}
                {!isMulti && firstObj.type === 'effect' && (
                    <EffectInspector object={firstObj} />
                )}

                {/* Actions Section */}
                <CollapsibleSection
                    title="Quick Actions"
                    icon={<Zap size={12} />}
                    storageKey="quick_actions"
                >
                    <div className="space-y-2">
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
                </CollapsibleSection>

                {/* Style & Content Controls */}
                {!isShape && firstObj.type !== 'effect' && (
                    <CollapsibleSection
                        title="Style & Appearance"
                        icon={<PaintBucket size={12} />}
                        storageKey="style_appearance"
                    >
                        <div className="space-y-4">
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

                            {/* Shape Specific (Fill/Stroke) - Maintained for non-text */}
                            {(firstObj.type === 'rectangle' || firstObj.type === 'circle' || firstObj.type === 'triangle' || firstObj.type === 'star' || firstObj.type === 'polygon') && (
                                <div className="space-y-3 pt-2 border-t border-white/5">
                                    <div>
                                        <span className="text-[9px] text-zinc-500 mb-2 block">Fill Color</span>
                                        <ColorGrid
                                            current={getCommonValue(selectedObjects, 'fill', 'transparent') as string}
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
                                            current={getCommonValue(selectedObjects, 'stroke', '#000000') as string}
                                            recentColors={recentColors}
                                            onSelect={(c) => {
                                                addColorToHistory(c);
                                                selectedObjects.forEach(o => updateObject(o.id, { stroke: c }));
                                            }}
                                        />
                                    </div>
                                    <SimpleInput
                                        label="Thickness"
                                        value={getCommonValue(selectedObjects, 'strokeWidth', 2) as number}
                                        onChange={(v) => selectedObjects.forEach(o => updateObject(o.id, { strokeWidth: v }))}
                                    />
                                </div>
                            )}

                            {/* Image Specific (Crop) */}
                            {firstObj.type === 'image' && (
                                <div className="space-y-3 pt-2 border-t border-white/5">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
                                        <ImageIcon size={10} /> <span>Image Tools</span>
                                    </div>
                                    <ActionButton
                                        label="Image Studio"
                                        icon={<Wand2 size={13} />}
                                        onClick={() => {
                                            if (firstObj.src) {
                                                useEditorStore.getState().openImageStudio(
                                                    firstObj.originalSrc || firstObj.src,
                                                    firstObj.id,
                                                    firstObj.editParams
                                                );
                                            }
                                        }}
                                        className="bg-blue-600 text-white"
                                    />
                                </div>
                            )}
                        </div>
                    </CollapsibleSection>
                )}

                {/* Layout & Alignment */}
                <CollapsibleSection
                    title="Align to Canvas"
                    icon={<LayoutTemplate size={12} />}
                    storageKey="alignment"
                >
                    <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5 space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                            <button onClick={() => handleAlign('left')} className="p-2 rounded bg-white/[0.03] hover:bg-white/10 flex justify-center"><ArrowLeftToLine size={14} /></button>
                            <button onClick={() => handleAlign('center')} className="p-2 rounded bg-white/[0.03] hover:bg-white/10 flex justify-center"><AlignHorizontalJustifyCenter size={14} /></button>
                            <button onClick={() => handleAlign('right')} className="p-2 rounded bg-white/[0.03] hover:bg-white/10 flex justify-center"><ArrowRightToLine size={14} /></button>

                            <button onClick={() => handleAlign('top')} className="p-2 rounded bg-white/[0.03] hover:bg-white/10 flex justify-center"><ArrowUpToLine size={14} /></button>
                            <button onClick={() => handleAlign('middle')} className="p-2 rounded bg-white/[0.03] hover:bg-white/10 flex justify-center"><AlignVerticalJustifyCenter size={14} /></button>
                            <button onClick={() => handleAlign('bottom')} className="p-2 rounded bg-white/[0.03] hover:bg-white/10 flex justify-center"><ArrowDownToLine size={14} /></button>
                        </div>
                    </div>
                </CollapsibleSection>

                {/* Transform Section */}
                <CollapsibleSection
                    title="Transform"
                    icon={<Scaling size={12} />}
                    storageKey="transform"
                >
                    <div className="grid grid-cols-2 gap-3">
                        <SimpleInput label="X" value={Math.round(firstObj.x)} disabled={isMulti} onChange={(v: number) => updateObject(firstObj.id, { x: v })} />
                        <SimpleInput label="Y" value={Math.round(firstObj.y)} disabled={isMulti} onChange={(v: number) => updateObject(firstObj.id, { y: v })} />
                        <SimpleInput label="W" value={Math.round(firstObj.width || 0)} disabled={isMulti} onChange={(v: number) => updateObject(firstObj.id, { width: v })} />
                        <SimpleInput label="H" value={Math.round(firstObj.height || 0)} disabled={isMulti} onChange={(v: number) => updateObject(firstObj.id, { height: v })} />
                        <SimpleInput label="R" value={rotation === 'mixed' ? 0 : Math.round(rotation as number)} className="col-span-2" suffix="°" onChange={(v: number) => selectedObjects.forEach(o => updateObject(o.id, { rotation: v }))} />
                    </div>
                </CollapsibleSection>

            </div>
        </div>
    );
};
