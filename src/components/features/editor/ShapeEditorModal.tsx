import React, { useState, useEffect } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { usePDFStore } from '../../../store/pdfStore';
import { X, Check, Heart, Cloud, Zap, Droplets, MessageCircle, Square, Circle, Triangle, Star, Hexagon, ArrowRight, Minus } from 'lucide-react';
import clsx from 'clsx';
import { Slider, ColorGrid, ActionButton } from './properties/PropertyComponents';
import { SHAPE_PATHS } from '../../../constants/shapeConstants';

// Icons mapping for shapes
const SHAPE_ICONS: Record<string, React.ElementType> = {
    'rectangle': Square,
    'circle': Circle,
    'triangle': Triangle,
    'star': Star,
    'polygon': Hexagon, // Proxy for polygon
    'line': Minus,
    'arrow': ArrowRight,
    'heart': Heart,
    'cloud': Cloud,
    'lightning': Zap,
    'drop': Droplets,
    'callout-bubble': MessageCircle
};

type Tab = 'shape' | 'fill' | 'outline' | 'shadow';

export const ShapeEditorModal: React.FC = () => {
    const { shapeEditor, closeShapeEditor, addObject, updateObject, currentPage, selectedObjectIds } = useEditorStore();
    const { isOpen, mode } = shapeEditor;
    const [activeTab, setActiveTab] = useState<Tab>('shape');

    // Local state for "Add" mode
    const [previewShape, setPreviewShape] = useState<any>({
        type: 'heart',
        fill: '#ef4444',
        stroke: '#000000',
        strokeWidth: 2,
        opacity: 1,
        // Shadow defaults
        shadowColor: '#000000',
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        shadowOpacity: 0.5
    });

    // If Editing, sync with selection
    const selectedObj = mode === 'edit' && currentPage && selectedObjectIds.length > 0
        ? currentPage.objects.find(o => o.id === selectedObjectIds[0])
        : null;

    useEffect(() => {
        if (selectedObj) {
            setPreviewShape({ ...selectedObj });
        }
    }, [selectedObj]);

    if (!isOpen) return null;

    const handleUpdate = (updates: Partial<any>) => {
        if (mode === 'edit' && selectedObj) {
            updateObject(selectedObj.id, updates);
        } else {
            setPreviewShape(prev => ({ ...prev, ...updates }));
        }
    };

    const currentValues = mode === 'edit' && selectedObj ? selectedObj : previewShape;

    const handleApply = () => {
        if (mode === 'add') {
            addObject({
                id: crypto.randomUUID(),
                type: currentValues.type,
                x: 100, // Center or nice default
                y: 100,
                width: 100,
                height: 100,
                rotation: 0,
                ...currentValues
            });
        }
        closeShapeEditor();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center pointer-events-none">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={closeShapeEditor} />

            {/* Modal Content */}
            <div className="bg-[#18181b] w-full sm:w-[400px] sm:rounded-2xl border-t sm:border border-white/10 shadow-2xl overflow-hidden flex flex-col pointer-events-auto max-h-[85vh] sm:max-h-[600px] mb-0 sm:mb-4 animate-in slide-in-from-bottom-10 fade-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#18181b]">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                        {mode === 'add' ? 'Add Shape' : 'Edit Shape'}
                    </h3>
                    <button onClick={closeShapeEditor} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Live Preview Section */}
                <div className="flex flex-col items-center justify-center p-6 bg-[#09090b] border-b border-white/5 relative overflow-hidden">
                    {/* Background Grid Pattern */}
                    <div className="absolute inset-0 opacity-20"
                        style={{
                            backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
                            backgroundSize: '16px 16px'
                        }}
                    />

                    {/* Preview Canvas */}
                    <div className="relative z-10 w-24 h-24 flex items-center justify-center">
                        <svg
                            width="100%"
                            height="100%"
                            viewBox="0 0 100 100"
                            className="drop-shadow-2xl overflow-visible"
                            style={{
                                filter: `drop-shadow(${currentValues.shadowOffsetX || 0}px ${currentValues.shadowOffsetY || 0}px ${currentValues.shadowBlur || 0}px ${currentValues.shadowColor || 'black'})`
                            }}
                        >
                            {/* Standard Shapes */}
                            {currentValues.type === 'rectangle' && (
                                <rect x="10" y="10" width="80" height="80" rx="5"
                                    fill={currentValues.fill || 'transparent'}
                                    stroke={currentValues.stroke || 'black'}
                                    strokeWidth={currentValues.strokeWidth || 2}
                                    strokeOpacity={1}
                                    fillOpacity={currentValues.opacity ?? 1}
                                />
                            )}
                            {currentValues.type === 'circle' && (
                                <circle cx="50" cy="50" r="40"
                                    fill={currentValues.fill || 'transparent'}
                                    stroke={currentValues.stroke || 'black'}
                                    strokeWidth={currentValues.strokeWidth || 2}
                                    fillOpacity={currentValues.opacity ?? 1}
                                />
                            )}
                            {currentValues.type === 'triangle' && (
                                <polygon points="50,15 90,85 10,85"
                                    fill={currentValues.fill || 'transparent'}
                                    stroke={currentValues.stroke || 'black'}
                                    strokeWidth={currentValues.strokeWidth || 2}
                                    fillOpacity={currentValues.opacity ?? 1}
                                />
                            )}

                            {/* Path Shapes */}
                            {SHAPE_PATHS[currentValues.type] && (
                                <path
                                    d={SHAPE_PATHS[currentValues.type]}
                                    fill={currentValues.fill || 'transparent'}
                                    stroke={currentValues.stroke || 'black'}
                                    strokeWidth={currentValues.strokeWidth || 2}
                                    fillOpacity={currentValues.opacity ?? 1}
                                    transform="scale(2) translate(12, 12)" // Approximate scaling for 24px viewbox paths to 100px viewbox
                                // Note: Manual transform adjustment might be needed per shape if they vary widely
                                />
                            )}

                            {/* Fallback for others not explicitly handled in preview yet */}
                            {!['rectangle', 'circle', 'triangle'].includes(currentValues.type) && !SHAPE_PATHS[currentValues.type] && (
                                <text x="50" y="50" textAnchor="middle" fill="gray" fontSize="10">No Preview</text>
                            )}
                        </svg>
                    </div>

                    <div className="mt-4 flex flex-col items-center gap-1">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">{currentValues.type}</span>
                        <span className="text-[10px] text-zinc-500">Preview</span>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-[#09090b] p-1 gap-1 border-b border-white/5">
                    {(['shape', 'fill', 'outline', 'shadow'] as Tab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={clsx(
                                "flex-1 py-2 text-[10px] uppercase font-bold tracking-wide rounded-md transition-all",
                                activeTab === tab ? "bg-[#18181b] text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                            )}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6 min-h-[300px]">

                    {activeTab === 'shape' && (
                        <div className="grid grid-cols-4 gap-2">
                            {Object.entries(SHAPE_ICONS).map(([type, Icon]) => (
                                <button
                                    key={type}
                                    onClick={() => handleUpdate({ type })}
                                    className={clsx(
                                        "aspect-square rounded-xl flex flex-col items-center justify-center gap-2 border transition-all",
                                        currentValues.type === type
                                            ? "bg-blue-600/20 border-blue-500/50 text-blue-400"
                                            : "bg-white/[0.02] border-white/5 text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                                    )}
                                >
                                    <Icon size={24} />
                                    <span className="text-[9px] uppercase font-bold opacity-70">{type}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {activeTab === 'fill' && (
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-[10px] font-bold text-zinc-500 uppercase mb-2">Fill Color</h4>
                                <ColorGrid
                                    current={currentValues.fill || 'transparent'}
                                    onSelect={(c) => handleUpdate({ fill: c })}
                                    recentColors={['#000000', '#ffffff', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', 'transparent']}
                                />
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-zinc-400">
                                    <span>Opacity</span>
                                    <span>{Math.round((currentValues.opacity || 1) * 100)}%</span>
                                </div>
                                <Slider
                                    value={currentValues.opacity ?? 1}
                                    min={0} max={1} step={0.01}
                                    onChange={(v) => handleUpdate({ opacity: v })}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'outline' && (
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-[10px] font-bold text-zinc-500 uppercase mb-2">Stroke Color</h4>
                                <ColorGrid
                                    current={currentValues.stroke || 'transparent'}
                                    onSelect={(c) => handleUpdate({ stroke: c })}
                                    recentColors={['#000000', '#ffffff', '#ef4444', '#3b82f6', 'transparent']}
                                />
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-zinc-400">
                                    <span>Thickness</span>
                                    <span>{currentValues.strokeWidth}px</span>
                                </div>
                                <Slider
                                    value={currentValues.strokeWidth || 0}
                                    min={0} max={20} step={1}
                                    onChange={(v) => handleUpdate({ strokeWidth: v })}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'shadow' && (
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-[10px] font-bold text-zinc-500 uppercase mb-2">Shadow Color</h4>
                                <ColorGrid
                                    current={currentValues.shadowColor || '#000000'}
                                    onSelect={(c) => handleUpdate({ shadowColor: c })}
                                    recentColors={['#000000', '#ffffff', 'transparent']}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <span className="text-[10px] text-zinc-400">Blur</span>
                                    <Slider value={currentValues.shadowBlur || 0} min={0} max={50} onChange={(v) => handleUpdate({ shadowBlur: v })} />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] text-zinc-400">Opacity</span>
                                    <Slider value={currentValues.shadowOpacity ?? 0.5} min={0} max={1} step={0.01} onChange={(v) => handleUpdate({ shadowOpacity: v })} />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] text-zinc-400">Offset X</span>
                                    <Slider value={currentValues.shadowOffsetX || 0} min={-20} max={20} onChange={(v) => handleUpdate({ shadowOffsetX: v })} />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] text-zinc-400">Offset Y</span>
                                    <Slider value={currentValues.shadowOffsetY || 0} min={-20} max={20} onChange={(v) => handleUpdate({ shadowOffsetY: v })} />
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-white/5 bg-[#18181b] flex gap-3">
                    <button
                        onClick={closeShapeEditor}
                        className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 font-medium text-xs hover:bg-zinc-700 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleApply}
                        className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition flex items-center justify-center gap-2"
                    >
                        {mode === 'add' ? <><Check size={14} /> Add Shape</> : 'Done'}
                    </button>
                </div>
            </div>
        </div>
    );
};
