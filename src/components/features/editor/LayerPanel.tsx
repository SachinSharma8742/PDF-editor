import React, { useMemo } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { Eye, EyeOff, Lock, Unlock, Text, Image as ImageIcon, Square, Edit3 } from 'lucide-react';

export const LayerPanel: React.FC = () => {
    const { currentPage, selectedObjectIds, selectObject, updateObject } = useEditorStore();

    // Reverse objects to show top layer at top of list
    const layers = useMemo(() => {
        return currentPage?.objects ? [...currentPage.objects].reverse() : [];
    }, [currentPage?.objects]);

    if (!currentPage) return null;

    const getIcon = (type: string) => {
        switch (type) {
            case 'text': return <Text size={14} />;
            case 'image': return <ImageIcon size={14} />;
            case 'draw': return <Edit3 size={14} />; // paths ?
            default: return <Square size={14} />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-900">
            <div className="p-3 border-b border-zinc-800">
                <h3 className="text-xs font-semibold uppercase text-gray-400">Layers</h3>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {layers.length === 0 && (
                    <div className="p-4 text-center text-gray-500 text-sm">
                        No layers
                    </div>
                )}

                {layers.map(obj => {
                    const isSelected = selectedObjectIds.includes(obj.id);
                    const isLocked = obj.isLocked || false;

                    return (
                        <div
                            key={obj.id}
                            onClick={() => selectObject(obj.id, false)}
                            className={`flex items-center gap-2 p-2 text-sm border-b border-zinc-800/50 cursor-pointer transition-colors
                                ${isSelected ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-zinc-800 text-gray-300'}
                            `}
                        >
                            <span className="text-gray-500">
                                {getIcon(obj.type)}
                            </span>

                            <span className="flex-1 truncate font-medium">
                                {obj.type === 'text' ? (obj.text || 'Text Layer') : obj.type}
                            </span>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    updateObject(obj.id, { isLocked: !isLocked });
                                }}
                                className={`p-1 rounded hover:bg-zinc-700 ${isLocked ? 'text-red-400' : 'text-gray-500 hover:text-gray-300'}`}
                                title={isLocked ? "Unlock" : "Lock"}
                            >
                                {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
