import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import { X, Check, RotateCcw, PenTool } from 'lucide-react';
import { Button } from '../../ui/Button';

interface SignatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (dataUrl: string) => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({ isOpen, onClose, onSave }) => {
    const [lines, setLines] = useState<any[]>([]);
    const isDrawing = useRef(false);
    const stageRef = useRef<any>(null);

    const handleMouseDown = (e: any) => {
        isDrawing.current = true;
        const pos = e.target.getStage().getPointerPosition();
        setLines([...lines, { points: [pos.x, pos.y] }]);
    };

    const handleMouseMove = (e: any) => {
        if (!isDrawing.current) return;
        const stage = e.target.getStage();
        const point = stage.getPointerPosition();
        const lastLine = lines[lines.length - 1];
        lastLine.points = lastLine.points.concat([point.x, point.y]);
        lines.splice(lines.length - 1, 1, lastLine);
        setLines(lines.concat());
    };

    const handleMouseUp = () => {
        isDrawing.current = false;
    };

    const clear = () => setLines([]);

    const save = () => {
        if (lines.length === 0) return;
        const dataUrl = stageRef.current.toDataURL();
        onSave(dataUrl);
        onClose();
        clear();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-zinc-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center">
                            <PenTool size={16} />
                        </div>
                        <h2 className="text-lg font-bold text-white tracking-tight">Draw Signature</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-zinc-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Canvas Area */}
                <div className="p-6">
                    <div className="bg-white rounded-2xl overflow-hidden shadow-inner cursor-crosshair relative border-4 border-zinc-800">
                        <Stage
                            width={600}
                            height={300}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onTouchStart={handleMouseDown}
                            onTouchMove={handleMouseMove}
                            onTouchEnd={handleMouseUp}
                            ref={stageRef}
                        >
                            <Layer>
                                {lines.map((line, i) => (
                                    <Line
                                        key={i}
                                        points={line.points}
                                        stroke="black"
                                        strokeWidth={3}
                                        tension={0.5}
                                        lineCap="round"
                                        lineJoin="round"
                                    />
                                ))}
                            </Layer>
                        </Stage>

                        {lines.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-zinc-300">
                                <span className="text-sm font-medium italic">Sign here...</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/5 bg-zinc-800/50 flex items-center justify-between">
                    <Button variant="ghost" onClick={clear} className="text-zinc-400 hover:text-white">
                        <RotateCcw size={16} />
                        Clear
                    </Button>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={onClose}>Cancel</Button>
                        <Button variant="primary" onClick={save} disabled={lines.length === 0}>
                            <Check size={16} />
                            Apply Signature
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
