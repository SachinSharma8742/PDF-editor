import React, { useMemo } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import {
    AlignLeft, AlignCenter, AlignRight,
    AlignVerticalJustifyCenter, AlignHorizontalJustifyCenter, AlignHorizontalJustifyStart, AlignHorizontalJustifyEnd, AlignVerticalJustifyStart, AlignVerticalJustifyEnd,
    Trash2, Layers, Copy, Group, Ungroup,
    ChevronsUp, ChevronsDown, ChevronUp, ChevronDown,
    Type, Image as ImageIcon, Box, Circle as CircleIcon, PenTool, MousePointer2
} from 'lucide-react';
import type { PDFObject } from '../../../store/pdfStore';

// Helper to determine selection type
const getSelectionType = (objects: PDFObject[]) => {
    if (objects.length === 0) return 'None';
    if (objects.length > 1) return `${objects.length} Objects`;
    const type = objects[0].type;
    return type.charAt(0).toUpperCase() + type.slice(1);
};

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
        reorderObject,
        duplicateObject,
        groupObjects,
        ungroupObjects
    } = useEditorStore();

    const selectedObjects = useMemo(() => {
        if (!currentPage) return [];
        return currentPage.objects.filter(o => selectedObjectIds.includes(o.id));
    }, [currentPage, selectedObjectIds]);

    if (!currentPage || selectedObjectIds.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 p-8 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 flex items-center justify-center">
                    <MousePointer2 size={32} className="opacity-40" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-gray-500 dark:text-zinc-400">No Selection</p>
                    <p className="text-xs text-gray-400 mt-1">Select an object to edit</p>
                </div>
            </div>
        );
    }

    const firstObj = selectedObjects[0];
    const isMulti = selectedObjects.length > 1;
    // Check if we can group: >1 objects selected AND not already all in same group (or handled by store).
    // Store groupObjects just groups whatever logic.
    // Check if we can ungroup: any selected object has a groupId.
    const canGroup = isMulti;
    const canUngroup = selectedObjects.some(o => !!o.groupId);

    // Derived Values
    const fill = getCommonValue(selectedObjects, 'fill', '#000000');
    const stroke = getCommonValue(selectedObjects, 'stroke', '#000000');
    const strokeWidth = getCommonValue(selectedObjects, 'strokeWidth', 0);
    const opacity = getCommonValue(selectedObjects, 'opacity', 1);
    const rotation = getCommonValue(selectedObjects, 'rotation', 0);

    const handleBatchChange = (entries: Partial<PDFObject>) => {
        selectedObjectIds.forEach(id => updateObject(id, entries));
    };

    const handleAlign = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
        if (selectedObjects.length < 2) return;

        // Calculate bounds
        const bounds = selectedObjects.map(o => ({
            id: o.id,
            x: o.x,
            y: o.y,
            r: o.x + (o.width || 0),
            b: o.y + (o.height || 0),
            w: o.width || 0,
            h: o.height || 0,
            cx: o.x + (o.width || 0) / 2,
            cy: o.y + (o.height || 0) / 2
        }));

        const minX = Math.min(...bounds.map(b => b.x));
        const maxX = Math.max(...bounds.map(b => b.r));
        const avgX = (minX + maxX) / 2; // Center of selection box

        const minY = Math.min(...bounds.map(b => b.y));
        const maxY = Math.max(...bounds.map(b => b.b));
        const avgY = (minY + maxY) / 2;

        bounds.forEach(b => {
            let update: any = {};
            if (type === 'left') update.x = minX;
            if (type === 'right') update.x = maxX - b.w;
            if (type === 'center') update.x = avgX - b.w / 2;

            if (type === 'top') update.y = minY;
            if (type === 'bottom') update.y = maxY - b.h;
            if (type === 'middle') update.y = avgY - b.h / 2;

            updateObject(b.id, update);
        });
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 sticky top-0 z-10 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                        {isMulti ? <Layers size={14} /> :
                            firstObj.type === 'text' ? <Type size={14} /> :
                                firstObj.type === 'path' ? <PenTool size={14} /> :
                                    firstObj.type === 'image' ? <ImageIcon size={14} /> :
                                        <Box size={14} />
                        }
                    </span>
                    <h3 className="text-xs font-bold uppercase text-gray-600 dark:text-zinc-300 tracking-wider">
                        {getSelectionType(selectedObjects)}
                    </h3>
                </div>
            </div>

            <div className="p-4 space-y-6">

                {/* Primary Actions Grid */}
                <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase text-gray-400 dark:text-zinc-600 tracking-wider mb-2">Actions</h4>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => duplicateObject(selectedObjectIds)}
                            className="flex items-center justify-center gap-2 p-2 rounded-md bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors text-xs font-medium border border-transparent dark:border-white/5"
                        >
                            <Copy size={14} className="opacity-70" /> Clone
                        </button>
                        <button
                            onClick={() => deleteObjects(selectedObjectIds)}
                            className="flex items-center justify-center gap-2 p-2 rounded-md bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors text-xs font-medium border border-transparent dark:border-red-500/10"
                        >
                            <Trash2 size={14} className="opacity-70" /> Delete
                        </button>
                    </div>

                    {/* Group / Ungroup */}
                    <div className="grid grid-cols-1 pt-1">
                        {canUngroup ? (
                            <button
                                onClick={() => ungroupObjects(selectedObjectIds)}
                                className="flex items-center justify-center gap-2 p-2 rounded-md bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors text-xs font-medium"
                            >
                                <Ungroup size={14} className="opacity-70" /> Ungroup
                            </button>
                        ) : canGroup ? (
                            <button
                                onClick={() => groupObjects(selectedObjectIds)}
                                className="flex items-center justify-center gap-2 p-2 rounded-md bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors text-xs font-medium"
                            >
                                <Group size={14} className="opacity-70" /> Group Selection
                            </button>
                        ) : null}
                    </div>
                </div>

                {/* Arrangement (Z-Index) */}
                <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase text-gray-400 dark:text-zinc-600 tracking-wider mb-2">Arrangement</h4>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => selectedObjectIds.forEach(id => reorderObject(id, 'front'))}
                            className="flex items-center justify-center gap-2 p-2 px-3 rounded-md bg-gray-50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-700 border border-gray-200 dark:border-zinc-700 text-xs transition-colors"
                            title="Bring to Front"
                        >
                            <ChevronsUp size={14} /> <span className="truncate">To Front</span>
                        </button>
                        <button
                            onClick={() => selectedObjectIds.forEach(id => reorderObject(id, 'back'))}
                            className="flex items-center justify-center gap-2 p-2 px-3 rounded-md bg-gray-50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-700 border border-gray-200 dark:border-zinc-700 text-xs transition-colors"
                            title="Send to Back"
                        >
                            <ChevronsDown size={14} /> <span className="truncate">To Back</span>
                        </button>
                    </div>
                </div>

                <hr className="border-gray-100 dark:border-zinc-800" />

                {/* Alignment (Multi-select only) */}
                {isMulti && (
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-bold uppercase text-gray-400 dark:text-zinc-600 tracking-wider mb-2">Align</h4>
                        <div className="flex justify-between bg-gray-50 dark:bg-zinc-800 p-1 rounded-lg border border-gray-100 dark:border-zinc-700">
                            <button onClick={() => handleAlign('left')} className="p-1.5 hover:bg-white dark:hover:bg-zinc-600 rounded" title="Align Left"><AlignHorizontalJustifyStart size={16} /></button>
                            <button onClick={() => handleAlign('center')} className="p-1.5 hover:bg-white dark:hover:bg-zinc-600 rounded" title="Align Center"><AlignHorizontalJustifyCenter size={16} /></button>
                            <button onClick={() => handleAlign('right')} className="p-1.5 hover:bg-white dark:hover:bg-zinc-600 rounded" title="Align Right"><AlignHorizontalJustifyEnd size={16} /></button>
                            <div className="w-px bg-gray-200 dark:bg-zinc-700 mx-1"></div>
                            <button onClick={() => handleAlign('top')} className="p-1.5 hover:bg-white dark:hover:bg-zinc-600 rounded" title="Align Top"><AlignVerticalJustifyStart size={16} /></button>
                            <button onClick={() => handleAlign('middle')} className="p-1.5 hover:bg-white dark:hover:bg-zinc-600 rounded" title="Align Middle"><AlignVerticalJustifyCenter size={16} /></button>
                            <button onClick={() => handleAlign('bottom')} className="p-1.5 hover:bg-white dark:hover:bg-zinc-600 rounded" title="Align Bottom"><AlignVerticalJustifyEnd size={16} /></button>
                        </div>
                    </div>
                )}

                {/* Transform */}
                <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase text-gray-400 dark:text-zinc-600 tracking-wider mb-2">Transform</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-2 border border-gray-100 dark:border-white/5 flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase w-3">X</span>
                            <input
                                type="number"
                                disabled={isMulti}
                                value={isMulti ? '' : Math.round(firstObj.x)}
                                placeholder={isMulti ? '-' : ''}
                                onChange={(e) => !isMulti && updateObject(firstObj.id, { x: Number(e.target.value) })}
                                className="w-full text-xs bg-transparent focus:outline-none font-medium tabular-nums text-right"
                            />
                        </div>
                        <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-2 border border-gray-100 dark:border-white/5 flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase w-3">Y</span>
                            <input
                                type="number"
                                disabled={isMulti}
                                value={isMulti ? '' : Math.round(firstObj.y)}
                                placeholder={isMulti ? '-' : ''}
                                onChange={(e) => !isMulti && updateObject(firstObj.id, { y: Number(e.target.value) })}
                                className="w-full text-xs bg-transparent focus:outline-none font-medium tabular-nums text-right"
                            />
                        </div>
                        <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-2 border border-gray-100 dark:border-white/5 flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase w-3">W</span>
                            <input
                                type="number"
                                disabled={isMulti}
                                value={isMulti ? '' : Math.round(firstObj.width || 0)}
                                placeholder={isMulti ? '-' : ''}
                                onChange={(e) => !isMulti && updateObject(firstObj.id, { width: Number(e.target.value) })}
                                className="w-full text-xs bg-transparent focus:outline-none font-medium tabular-nums text-right"
                            />
                        </div>
                        <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-2 border border-gray-100 dark:border-white/5 flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase w-3">H</span>
                            <input
                                type="number"
                                disabled={isMulti}
                                value={isMulti ? '' : Math.round(firstObj.height || 0)}
                                placeholder={isMulti ? '-' : ''}
                                onChange={(e) => !isMulti && updateObject(firstObj.id, { height: Number(e.target.value) })}
                                className="w-full text-xs bg-transparent focus:outline-none font-medium tabular-nums text-right"
                            />
                        </div>
                        <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-2 border border-gray-100 dark:border-white/5 flex items-center gap-2 col-span-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase w-3">R</span>
                            <input
                                type="number"
                                value={rotation === 'mixed' ? '' : Math.round(rotation)}
                                placeholder={rotation === 'mixed' ? 'Mixed' : '0'}
                                onChange={(e) => handleBatchChange({ rotation: Number(e.target.value) })}
                                className="w-full text-xs bg-transparent focus:outline-none font-medium tabular-nums text-right"
                            />
                            <span className="text-[10px] text-gray-400">°</span>
                        </div>
                    </div>
                </div>

                <hr className="border-gray-100 dark:border-zinc-800" />

                {/* Properties */}
                <div className="space-y-4">
                    <h4 className="text-[10px] font-bold uppercase text-gray-400 dark:text-zinc-600 tracking-wider mb-2">Appearance</h4>

                    {/* Opacity */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400">
                            <span>Opacity</span>
                            <span>{opacity === 'mixed' ? '-' : Math.round(opacity * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0" max="1" step="0.01"
                            value={opacity === 'mixed' ? 1 : opacity}
                            onChange={(e) => handleBatchChange({ opacity: parseFloat(e.target.value) })}
                            className="w-full h-1.5 bg-gray-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>

                    {/* Fill */}
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium dark:text-zinc-400">Fill</span>
                        <div className="flex items-center gap-2">
                            <div className="w-20 h-8 rounded-md border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 flex items-center px-1">
                                <input
                                    type="color"
                                    value={fill === 'mixed' || fill === 'transparent' ? '#ffffff' : fill}
                                    onChange={(e) => handleBatchChange({ fill: e.target.value })}
                                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0"
                                />
                                <span className="text-[10px] font-mono ml-2 uppercase text-gray-500">
                                    {fill === 'mixed' ? 'MIXED' : fill === 'transparent' ? 'NONE' : fill}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Stroke */}
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium dark:text-zinc-400">Stroke</span>
                        <div className="flex items-center gap-2">
                            <div className="w-20 h-8 rounded-md border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 flex items-center px-1">
                                <input
                                    type="color"
                                    value={stroke === 'mixed' || stroke === 'transparent' ? '#000000' : stroke}
                                    onChange={(e) => handleBatchChange({ stroke: e.target.value })}
                                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0"
                                />
                            </div>
                            <input
                                type="number"
                                min="0" max="20"
                                value={strokeWidth === 'mixed' ? '' : strokeWidth}
                                placeholder="-"
                                onChange={(e) => handleBatchChange({ strokeWidth: Number(e.target.value) })}
                                className="w-12 h-8 rounded-md border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-center text-xs"
                            />
                        </div>
                    </div>
                </div>

                {/* Typography - Show if ANY Text object is selected */}
                {selectedObjects.some(o => o.type === 'text') && (
                    <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-zinc-800">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-[10px] font-bold uppercase text-gray-400 dark:text-zinc-600 tracking-wider">Typography</h4>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {/* Font Family */}
                            <select
                                value={getCommonValue(selectedObjects, 'fontFamily', 'Inter')}
                                className="col-span-2 w-full p-2 rounded-md bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs font-medium focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                onChange={(e) => handleBatchChange({ fontFamily: e.target.value })}
                            >
                                <option value="Inter">Inter (Default)</option>
                                <option value="Arial">Arial</option>
                                <option value="Times New Roman">Times New Roman</option>
                                <option value="Courier New">Courier New</option>
                                <option value="Georgia">Georgia</option>
                                <option value="Verdana">Verdana</option>
                            </select>

                            {/* Font Size */}
                            <div className="relative group">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold">PX</span>
                                <input
                                    type="number"
                                    value={getCommonValue(selectedObjects, 'fontSize', 16)}
                                    onChange={(e) => handleBatchChange({ fontSize: Number(e.target.value) })}
                                    className="w-full p-2 pl-7 rounded-md bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                                />
                            </div>

                            {/* Font Weight */}
                            <select
                                value={getCommonValue(selectedObjects, 'fontWeight', 'normal')}
                                className="w-full p-2 rounded-md bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                                onChange={(e) => handleBatchChange({ fontWeight: e.target.value })}
                            >
                                <option value="normal">Normal</option>
                                <option value="500">Medium</option>
                                <option value="bold">Bold</option>
                                <option value="900">Black</option>
                            </select>
                        </div>

                        {/* Alignment & Style Row */}
                        <div className="flex flex-col gap-3">
                            <div className="flex gap-1 bg-gray-50 dark:bg-zinc-800 p-1 rounded-lg border border-gray-100 dark:border-zinc-700">
                                <button
                                    onClick={() => handleBatchChange({ align: 'left' })}
                                    className={`flex-1 p-1.5 rounded transition-colors flex items-center justify-center ${getCommonValue(selectedObjects, 'align', 'left') === 'left' ? 'bg-white dark:bg-zinc-700 shadow-sm text-blue-500' : 'hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-500'}`}
                                    title="Left Align"
                                >
                                    <AlignLeft size={16} />
                                </button>
                                <button
                                    onClick={() => handleBatchChange({ align: 'center' })}
                                    className={`flex-1 p-1.5 rounded transition-colors flex items-center justify-center ${getCommonValue(selectedObjects, 'align', 'left') === 'center' ? 'bg-white dark:bg-zinc-700 shadow-sm text-blue-500' : 'hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-500'}`}
                                    title="Center Align"
                                >
                                    <AlignCenter size={16} />
                                </button>
                                <button
                                    onClick={() => handleBatchChange({ align: 'right' })}
                                    className={`flex-1 p-1.5 rounded transition-colors flex items-center justify-center ${getCommonValue(selectedObjects, 'align', 'left') === 'right' ? 'bg-white dark:bg-zinc-700 shadow-sm text-blue-500' : 'hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-500'}`}
                                    title="Right Align"
                                >
                                    <AlignRight size={16} />
                                </button>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        const current = getCommonValue(selectedObjects, 'fontStyle', 'normal');
                                        const next = current === 'italic' ? 'normal' : 'italic';
                                        handleBatchChange({ fontStyle: next });
                                    }}
                                    className={`flex-1 p-2 rounded-md border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${getCommonValue(selectedObjects, 'fontStyle', 'normal').includes('italic') ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400' : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400'}`}
                                >
                                    <span className="italic font-serif text-sm">I</span> Italic
                                </button>
                                <button
                                    onClick={() => {
                                        const current = getCommonValue(selectedObjects, 'fontStyle', 'normal');
                                        const next = current.includes('underline') ? current.replace('underline', '').trim() || 'normal' : `${current} underline`.trim();
                                        handleBatchChange({ fontStyle: next });
                                    }}
                                    className={`flex-1 p-2 rounded-md border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${getCommonValue(selectedObjects, 'fontStyle', 'normal').includes('underline') ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400' : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400'}`}
                                >
                                    <span className="underline text-sm font-serif">U</span> Underline
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
