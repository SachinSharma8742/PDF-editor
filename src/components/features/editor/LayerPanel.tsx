import React, { useMemo, useState } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { Eye, EyeOff, Lock, Unlock, Text, Image as ImageIcon, Edit3, Square, MoreVertical, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, Trash2, Copy, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PDFObject } from '../../../store/pdfStore';

// --- Sortable Item Component ---

interface SortableLayerItemProps {
    object: PDFObject;
    isSelected: boolean;
    onSelect: () => void;
    onToggleLock: () => void;
    onToggleVisibility: () => void;
}

const SortableLayerItem: React.FC<SortableLayerItemProps> = ({ object, isSelected, onSelect, onToggleLock, onToggleVisibility }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: object.id });

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { reorderObject, deleteObjects, addObject } = useEditorStore();

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 50 : (isMenuOpen ? 40 : 'auto'),
        opacity: isDragging ? 0.5 : 1
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'text': return <Text size={14} />;
            case 'image': return <ImageIcon size={14} />;
            case 'draw':
            case 'path': return <Edit3 size={14} />;
            default: return <Square size={14} />;
        }
    };

    const handleAction = (action: () => void) => {
        action();
        setIsMenuOpen(false);
    };

    // Calculate generic name if text is empty
    const displayName = object.type === 'text'
        ? (object.text ? (object.text.length > 20 ? object.text.substring(0, 20) + '...' : object.text) : 'Text Layer')
        : object.type.charAt(0).toUpperCase() + object.type.slice(1);

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group relative flex items-center gap-2 p-2 px-3 text-sm border-b border-gray-100 dark:border-zinc-800/50 transition-colors
                ${isSelected ? 'bg-blue-50 dark:bg-blue-500/10' : 'bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-zinc-800'}
            `}
            onClick={onSelect}
        >
            {/* Drag Handle */}
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-zinc-600 hover:text-gray-500">
                <GripVertical size={14} />
            </div>

            {/* Icon */}
            <div className={`text-gray-400 dark:text-zinc-500 ${isSelected ? 'text-blue-500 dark:text-blue-400' : ''}`}>
                {getIcon(object.type)}
            </div>

            {/* Name */}
            <span className={`flex-1 truncate font-medium select-none ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-zinc-300'}`}>
                {displayName}
            </span>

            {/* Quick Actions (Hover Only unless selected or menu open) */}
            <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isMenuOpen ? 'opacity-100' : ''}`}>
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}
                    className={`p-1.5 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 ${object.visible === false ? 'text-gray-400 opacity-100' : 'text-gray-400'}`}
                    title={object.visible === false ? "Show" : "Hide"}
                >
                    {object.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>

                <button
                    onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
                    className={`p-1.5 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 ${object.isLocked ? 'text-red-500 opacity-100' : 'text-gray-400'}`}
                    title={object.isLocked ? "Unlock" : "Lock"}
                >
                    {object.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>

                {/* Context Menu Trigger */}
                <div className="relative">
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
                        className={`p-1.5 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 ${isMenuOpen ? 'bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-200' : 'text-gray-400'}`}
                    >
                        <MoreVertical size={12} />
                    </button>

                    {isMenuOpen && (
                        <>
                            {/* Backdrop to close */}
                            <div className="fixed inset-0 z-[60]" onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); }} />

                            {/* Menu */}
                            <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-gray-200 dark:border-zinc-700 z-[70] py-1 animate-in fade-in zoom-in-95 duration-200 flex flex-col text-left">
                                <div className="px-3 py-2 text-[10px] font-black uppercase text-gray-400 dark:text-zinc-600 tracking-wider">Arrange</div>
                                <button className="layer-menu-item" onClick={(e) => { e.stopPropagation(); handleAction(() => reorderObject(object.id, 'front')); }}>
                                    <ChevronsUp size={14} /> Bring to Front
                                </button>
                                <button className="layer-menu-item" onClick={(e) => { e.stopPropagation(); handleAction(() => reorderObject(object.id, 'forward')); }}>
                                    <ChevronUp size={14} /> Bring Forward
                                </button>
                                <button className="layer-menu-item" onClick={(e) => { e.stopPropagation(); handleAction(() => reorderObject(object.id, 'backward')); }}>
                                    <ChevronDown size={14} /> Send Backward
                                </button>
                                <button className="layer-menu-item" onClick={(e) => { e.stopPropagation(); handleAction(() => reorderObject(object.id, 'back')); }}>
                                    <ChevronsDown size={14} /> Send to Back
                                </button>

                                <div className="h-px bg-gray-100 dark:bg-zinc-800 my-1" />

                                <button className="layer-menu-item" onClick={(e) => {
                                    e.stopPropagation();
                                    handleAction(() => {
                                        const newObj = { ...object, id: crypto.randomUUID(), x: object.x + 20, y: object.y + 20 };
                                        addObject(newObj);
                                    });
                                }}>
                                    <Copy size={14} /> Duplicate
                                </button>
                                <button className="layer-menu-item text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={(e) => { e.stopPropagation(); handleAction(() => deleteObjects([object.id])); }}>
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};


// --- Main Panel Component ---

export const LayerPanel: React.FC = () => {
    const { currentPage, selectedObjectIds, selectObject, updateObject, setObjects } = useEditorStore();

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // Require slight move to prevent accidental drag on click
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Note: currentPage.objects is ordered back-to-front (render order). 
    // We want to display front-to-back (top of list = front).
    // so we need to reverse the list for display.
    const displayLayers = useMemo(() => {
        return currentPage?.objects ? [...currentPage.objects].reverse() : [];
    }, [currentPage]);

    if (!currentPage) return null;

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;



        // Find indices in the Render Order array
        // But wait, DndKit is operating on the "displayLayers" which is reversed.
        const displayIndexOld = displayLayers.findIndex(o => o.id === active.id);
        const displayIndexNew = displayLayers.findIndex(o => o.id === over.id);

        if (displayIndexOld === -1 || displayIndexNew === -1) return;

        // Simulate move in the Display List (Reversed)
        const newDisplayOrder = arrayMove(displayLayers, displayIndexOld, displayIndexNew);

        // Convert back to Render Order (Reverse again)
        const newRenderOrder = [...newDisplayOrder].reverse();

        setObjects(newRenderOrder);
    };

    return (
        <div className="flex flex-col h-full bg-transparent select-none overflow-hidden">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={displayLayers.map(o => o.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="flex flex-col gap-1">
                            {displayLayers.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-zinc-600">
                                    <Square size={24} className="mb-2 opacity-50" />
                                    <p className="text-xs">No layers yet</p>
                                </div>
                            )}

                            {displayLayers.map(obj => (
                                <SortableLayerItem
                                    key={obj.id}
                                    object={obj}
                                    isSelected={selectedObjectIds.includes(obj.id)}
                                    onSelect={() => selectObject(obj.id, false)}
                                    onToggleLock={() => updateObject(obj.id, { isLocked: !obj.isLocked })}
                                    onToggleVisibility={() => updateObject(obj.id, { visible: !(obj.visible !== false) })} // Toggle visible
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>

            {/* Styles for menu items */}
            <style>{`
                .layer-menu-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    width: 100%;
                    padding: 8px 12px;
                    font-size: 11px;
                    font-weight: 500;
                    color: #52525b;
                    transition: background-color 0.2s;
                    text-align: left;
                }
                .dark .layer-menu-item {
                    color: #a1a1aa;
                }
                .layer-menu-item:hover {
                    background-color: #f4f4f5;
                }
                .dark .layer-menu-item:hover {
                    background-color: #27272a;
                    color: #e4e4e7;
                }
            `}</style>
        </div>
    );
};
