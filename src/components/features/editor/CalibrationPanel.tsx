import React from 'react';
import { usePDFStore } from '../../../store/pdfStore';
import { Ruler, Scale, Maximize2, Grid as GridIcon } from 'lucide-react';
import { Button } from '../../ui/Button';
import { useEditorStore } from '../../../store/editorStore';

export const CalibrationPanel: React.FC = () => {
    const { calibration, setCalibration } = usePDFStore();
    const { snapToGrid, toggleSnapToGrid, gridSize, setGridSize } = useEditorStore();

    const units = ['px', 'in', 'cm', 'mm', 'ft', 'm'];

    const handleUpdate = (updates: { scale?: number; unit?: string }) => {
        const newScale = updates.scale !== undefined ? updates.scale : calibration.scale;
        const newUnit = updates.unit !== undefined ? updates.unit : calibration.unit;
        setCalibration(newScale, newUnit);
    };

    return (
        <div className="p-4 space-y-6">
            <div className="flex items-center gap-2 mb-2">
                <Scale size={20} className="text-amber-500" />
                <h3 className="font-bold text-sm uppercase tracking-wider text-zinc-400">Calibration & Scale</h3>
            </div>

            <div className="bg-zinc-800/50 rounded-2xl p-4 border border-white/5 space-y-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Standard Units</label>
                    <div className="grid grid-cols-3 gap-2">
                        {units.map(u => (
                            <button
                                key={u}
                                onClick={() => handleUpdate({ unit: u })}
                                className={`py-2 px-1 rounded-xl text-xs font-bold transition-all ${calibration.unit === u
                                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                    }`}
                            >
                                {u}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2 pt-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Pixels per Unit</label>
                    <div className="relative">
                        <input
                            type="number"
                            value={calibration.scale}
                            onChange={(e) => handleUpdate({ scale: parseFloat(e.target.value) || 1 })}
                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all outline-none"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-600">
                            PX/{calibration.unit}
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-zinc-800/50 rounded-2xl p-4 border border-white/5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <GridIcon size={20} className="text-blue-500" />
                    <h3 className="font-bold text-sm uppercase tracking-wider text-zinc-400">Grid & Precision</h3>
                </div>

                <div className="flex items-center justify-between p-2 bg-zinc-900 rounded-xl border border-white/5">
                    <span className="text-xs font-bold text-zinc-400">Snap to Grid</span>
                    <button
                        onClick={toggleSnapToGrid}
                        className={`w-10 h-6 rounded-full transition-colors relative ${snapToGrid ? 'bg-blue-600' : 'bg-zinc-700'}`}
                    >
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${snapToGrid ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                </div>

                {snapToGrid && (
                    <div className="space-y-2 pt-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Grid Size (px)</label>
                        <input
                            type="number"
                            value={gridSize}
                            onChange={(e) => setGridSize(parseInt(e.target.value) || 20)}
                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all outline-none"
                        />
                    </div>
                )}
            </div>

            <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                    <Maximize2 size={16} className="text-blue-400 flex-shrink-0" />
                    <p className="text-[11px] text-blue-200/80 leading-tight">
                        <strong>Tip:</strong> Draw a measurement across a known distance, then update pixels until the label matches the real-world value.
                    </p>
                </div>

                <Button variant="secondary" className="w-full py-4 text-xs font-bold border-zinc-700">
                    <Ruler size={16} />
                    Auto-Calibrate from Selection
                </Button>
            </div>

            <div className="pt-4 border-t border-white/5">
                <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Global Accuracy</span>
                    <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[10px] font-bold">READY</span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-2 italic px-1">
                    Scale is applied to all measurement annotations in this document.
                </p>
            </div>
        </div>
    );
};
