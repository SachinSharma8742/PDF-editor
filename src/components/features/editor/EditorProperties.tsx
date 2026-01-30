import React from 'react';
import { useEditorStore } from '../../../store/editorStore';

export const EditorProperties: React.FC = () => {
    const { selectedObjectIds, currentPage, updateObject, deleteObjects } = useEditorStore();

    if (!currentPage || selectedObjectIds.length === 0) {
        return (
            <div className="p-4 text-center text-gray-400 text-sm">
                Select an object to edit properties
            </div>
        );
    }

    const objectId = selectedObjectIds[0];
    const object = currentPage.objects.find(o => o.id === objectId);

    if (!object) return null;

    const isLocked = object.isLocked;

    const handleChange = (key: string, value: any) => {
        updateObject(objectId, { [key]: value });
    };

    return (
        <div className="flex flex-col gap-6 p-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-zinc-800">
                <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{object.type} Properties</h3>
                <button
                    onClick={() => deleteObjects([objectId])}
                    className="text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 text-xs font-medium"
                >
                    Delete
                </button>
            </div>

            {/* Common Transform Props */}
            <div className="space-y-3">
                <h4 className="text-xs font-medium text-gray-900 dark:text-gray-300">Transform</h4>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[10px] text-gray-500">X</label>
                        <input
                            type="number"
                            disabled={isLocked}
                            value={Math.round(object.x)}
                            onChange={(e) => handleChange('x', Number(e.target.value))}
                            className="w-full text-xs p-1 border rounded bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-500">Y</label>
                        <input
                            type="number"
                            disabled={isLocked}
                            value={Math.round(object.y)}
                            onChange={(e) => handleChange('y', Number(e.target.value))}
                            className="w-full text-xs p-1 border rounded bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-500">Width</label>
                        <input
                            type="number"
                            disabled={isLocked}
                            value={Math.round(object.width || 0)}
                            onChange={(e) => handleChange('width', Number(e.target.value))}
                            className="w-full text-xs p-1 border rounded bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-500">Height</label>
                        <input
                            type="number"
                            disabled={isLocked}
                            value={Math.round(object.height || 0)}
                            onChange={(e) => handleChange('height', Number(e.target.value))}
                            className="w-full text-xs p-1 border rounded bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                </div>
            </div>

            {/* Style Props */}
            <div className="space-y-3">
                <h4 className="text-xs font-medium text-gray-900 dark:text-gray-300">Appearance</h4>

                {/* Fill / Color */}
                <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600 dark:text-gray-400">Fill</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="color"
                            disabled={isLocked}
                            value={object.fill === 'transparent' ? '#ffffff' : (object.fill || '#000000')}
                            onChange={(e) => handleChange('fill', e.target.value)}
                            className="w-6 h-6 rounded border-0 p-0 cursor-pointer bg-transparent"
                        />
                    </div>
                </div>

                {/* Stroke */}
                <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600 dark:text-gray-400">Stroke</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="color"
                            disabled={isLocked}
                            value={object.stroke || '#000000'}
                            onChange={(e) => handleChange('stroke', e.target.value)}
                            className="w-6 h-6 rounded border-0 p-0 cursor-pointer bg-transparent"
                        />
                        <input
                            type="number"
                            disabled={isLocked}
                            min={0} max={20}
                            value={object.strokeWidth || 0}
                            onChange={(e) => handleChange('strokeWidth', Number(e.target.value))}
                            className="w-12 text-xs p-1 border rounded bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                </div>

                {/* Opacity */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-gray-600 dark:text-gray-400">Opacity</label>
                        <span className="text-xs text-gray-400 dark:text-gray-500">{Math.round((object.opacity ?? 1) * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min={0} max={1} step={0.1}
                        disabled={isLocked}
                        value={object.opacity ?? 1}
                        onChange={(e) => handleChange('opacity', Number(e.target.value))}
                        className="w-full accent-blue-600"
                    />
                </div>
            </div>

            {/* Text Props */}
            {object.type === 'text' && (
                <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-zinc-800">
                    <h4 className="text-xs font-medium text-gray-900 dark:text-gray-300">Text Style</h4>

                    <div className="grid grid-cols-2 gap-2">
                        <select
                            disabled={isLocked}
                            value={object.fontFamily || 'Inter'}
                            onChange={(e) => handleChange('fontFamily', e.target.value)}
                            className="col-span-2 text-xs p-1 border rounded bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
                        >
                            <option value="Inter">Inter</option>
                            <option value="Arial">Arial</option>
                            <option value="Times New Roman">Times</option>
                            <option value="Courier New">Courier</option>
                        </select>
                        <input
                            type="number"
                            disabled={isLocked}
                            value={object.fontSize || 16}
                            onChange={(e) => handleChange('fontSize', Number(e.target.value))}
                            className="text-xs p-1 border rounded bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                        <select
                            disabled={isLocked}
                            value={object.fontWeight || 'normal'}
                            onChange={(e) => handleChange('fontWeight', e.target.value)}
                            className="text-xs p-1 border rounded bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
                        >
                            <option value="normal">Normal</option>
                            <option value="bold">Bold</option>
                        </select>
                    </div>
                </div>
            )}

        </div>
    );
};
