import React from 'react';
import { usePDFStore } from '../../../store/pdfStore';
import { Trash2 } from 'lucide-react';

export const ContextToolbar: React.FC = () => {
    const {
        selectedObjectIds,
        pages,
        updateObject,
        deleteObjects,
        groupObjects,
        ungroupObjects,
        activeTool,
        toolPreferences, // Updated to toolPreferences
        updateToolSettings
    } = usePDFStore();

    const toolSettings = toolPreferences[activeTool];

    if (!toolSettings) return null; // Safety check

    // Derived state for selection
    const isMulti = selectedObjectIds.length > 1;
    const objectId = selectedObjectIds[0];

    // Check if Drawing Tool is active
    const isDrawingTool = ['pen', 'highlighter', 'eraser'].includes(activeTool);

    // Find the object details (for single select or first of multi)
    const findContext = () => {
        if (!objectId) return null;
        for (const page of pages) {
            const obj = page.objects.find(o => o.id === objectId);
            if (obj) return { obj, page };
        }
        return null;
    };

    const ctx = findContext();

    // Grouping Logic
    const handleGroup = () => {
        if (!ctx) return;
        groupObjects(ctx.page.id, selectedObjectIds);
    };

    const handleUngroup = () => {
        if (!ctx) return;
        ungroupObjects(ctx.page.id, selectedObjectIds);
    };

    const isGrouped = ctx?.obj?.groupId;

    // RENDER LOGIC:
    // 1. If Drawing Tool Active -> Show Tool Settings
    // 2. If Object Selected -> Show Object Settings
    // 3. Else -> Null

    if (isDrawingTool) {
        return (
            <div className="w-full h-12 bg-white border-b border-gray-200 px-4 flex items-center gap-4 shadow-sm z-20 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2 border-r pr-4 border-gray-200">
                    <span className="text-xs font-bold text-gray-400 uppercase">{activeTool}</span>
                </div>

                {/* Color (Pen Only) */}
                {activeTool === 'pen' && (
                    <input
                        type="color"
                        value={toolSettings.color}
                        onChange={(e) => updateToolSettings({ color: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0 overflow-hidden"
                        title="Color"
                    />
                )}
                {/* Color (Highlighter - fixed colors usually better, but allow custom for now) */}
                {activeTool === 'highlighter' && (
                    <input
                        type="color"
                        value={toolSettings.color}
                        onChange={(e) => updateToolSettings({ color: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0 overflow-hidden"
                        title="Color"
                    />
                )}

                {/* Size */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Size: {toolSettings.size}px</span>
                    <input
                        type="range"
                        min="1" max="50"
                        value={toolSettings.size}
                        onChange={(e) => updateToolSettings({ size: Number(e.target.value) })}
                        className="w-24"
                    />
                </div>

                {/* Opacity (Highlighter defaults to lower, but allow override?) 
                    Actually store 'opacity' in settings is separate.
                */}
                <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600">Opacity:</label>
                    <input
                        type="range"
                        min="0.1" max="1" step="0.1"
                        value={toolSettings.opacity ?? 1}
                        onChange={(e) => updateToolSettings({ opacity: Number(e.target.value) })}
                        className="w-20"
                    />
                </div>
            </div>
        )
    }

    // If no object selected, return null
    if (!ctx) return null;

    const { obj, page } = ctx;

    const handleChange = (key: string, value: string | number) => {
        // Apply to ALL selected objects if multi
        selectedObjectIds.forEach(id => {
            updateObject(page.id, id, { [key]: value });
        });
    };

    return (
        <div className="w-full h-12 bg-white border-b border-gray-200 px-4 flex items-center gap-4 shadow-sm z-20 animate-in fade-in slide-in-from-top-2">

            {/* Selection Info */}
            <div className="flex items-center gap-2 border-r pr-4 border-gray-200">
                <span className="text-xs font-bold text-gray-400 uppercase">
                    {isMulti ? `${selectedObjectIds.length} Itr` : obj.type}
                </span>
            </div>

            {/* Group Actions */}
            {(isMulti || isGrouped) && (
                <div className="flex items-center gap-2 border-r pr-4 border-gray-200">
                    {isMulti && !isGrouped && (
                        <button onClick={handleGroup} className="text-xs font-medium px-2 py-1 hover:bg-gray-100 rounded">
                            Group
                        </button>
                    )}
                    {isGrouped && (
                        <button onClick={handleUngroup} className="text-xs font-medium px-2 py-1 hover:bg-gray-100 rounded">
                            Ungroup
                        </button>
                    )}
                </div>
            )}

            {/* If Multi-Select, show common props if possible, or just Group/Delete? 
                For now, let's allow changing fill/stroke if they share type (e.g. all shapes) 
            */}

            {/* Text Specific (Single Only for now or if all text) */}
            {!isMulti && obj.type === 'text' && (
                <>
                    <input
                        type="color"
                        value={obj.fill || '#000000'}
                        onChange={(e) => handleChange('fill', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0 overflow-hidden"
                        title="Text Color"
                    />
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Size</span>
                        <input
                            type="number"
                            value={obj.fontSize || 16}
                            onChange={(e) => handleChange('fontSize', Number(e.target.value))}
                            className="w-16 p-1 border rounded text-center text-sm"
                            min={8} max={120}
                        />
                    </div>
                    <select
                        value={obj.fontFamily || 'Inter'}
                        onChange={(e) => handleChange('fontFamily', e.target.value)}
                        className="p-1 border rounded text-sm min-w-[100px]"
                    >
                        <option value="Inter">Inter</option>
                        <option value="Arial">Arial</option>
                        <option value="Times New Roman">Times</option>
                        <option value="Courier New">Courier</option>
                    </select>

                    <button
                        onClick={() => handleChange('fontWeight', obj.fontWeight === 'bold' ? 'normal' : 'bold')}
                        className={`p-1 rounded ${obj.fontWeight === 'bold' ? 'bg-gray-200 font-bold' : 'hover:bg-gray-100'}`}
                        title="Bold"
                    >
                        B
                    </button>
                    <button
                        onClick={() => handleChange('fontStyle', obj.fontStyle === 'italic' ? 'normal' : 'italic')}
                        className={`p-1 rounded italic ${obj.fontStyle === 'italic' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                        title="Italic"
                    >
                        I
                    </button>
                </>
            )}

            {/* Image Specific */}
            {obj.type === 'image' && (
                <>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600">Opacity:</label>
                        <input
                            type="range"
                            min="0" max="1" step="0.1"
                            value={obj.opacity ?? 1}
                            onChange={(e) => handleChange('opacity', Number(e.target.value))}
                            className="w-24"
                        />
                    </div>
                </>
            )}

            {/* Shape Specific */}
            {(obj.type === 'rectangle' || obj.type === 'circle') && (
                <>
                    <div className="flex flex-col justify-center">
                        <label className="text-[10px] text-gray-500 mb-0.5">Fill</label>
                        <input
                            type="color"
                            value={obj.fill === 'transparent' ? '#ffffff' : obj.fill || '#transparent'}
                            onChange={(e) => handleChange('fill', e.target.value)}
                            className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                            title="Fill Color"
                        />
                    </div>
                    <div className="flex flex-col justify-center">
                        <label className="text-[10px] text-gray-500 mb-0.5">Stroke</label>
                        <input
                            type="color"
                            value={obj.stroke || '#000000'}
                            onChange={(e) => handleChange('stroke', e.target.value)}
                            className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                            title="Stroke Color"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600">Border:</label>
                        <input
                            type="range"
                            min="0" max="20"
                            value={obj.strokeWidth || 0}
                            onChange={(e) => handleChange('strokeWidth', Number(e.target.value))}
                            className="w-24"
                        />
                    </div>
                </>
            )}

            {/* Common Actions */}
            <div className="flex items-center gap-2 border-l pl-4 border-gray-200 ml-auto">
                <button
                    onClick={() => deleteObjects(selectedObjectIds)}
                    className="p-1.5 hover:bg-red-50 text-red-500 rounded transition-colors flex items-center gap-2"
                    title="Delete"
                >
                    <Trash2 size={18} />
                    <span className="text-xs font-medium">Delete</span>
                </button>
            </div>

        </div>
    );
};
