import React, { useRef, useState } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import type { ToolType } from '../../../store/pdfStore';
import {
    MousePointerClick, Move, TypeOutline, ImagePlus,
    PenTool, Brush, EraserIcon, Shapes, Signature, Settings2
} from 'lucide-react';
import clsx from 'clsx';
import { SignatureModal } from './SignatureModal';

interface MobileToolbarProps {
    onPropertiesClick: () => void;
}

interface ToolDef {
    id: ToolType;
    icon: React.ElementType;
    label: string;
}

const MOBILE_TOOLS: ToolDef[] = [
    { id: 'select', icon: MousePointerClick, label: 'Select' },
    { id: 'pan', icon: Move, label: 'Pan' },
    { id: 'pen', icon: PenTool, label: 'Pen' },
    { id: 'highlighter', icon: Brush, label: 'Highlighter' },
    { id: 'text', icon: TypeOutline, label: 'Text' },
    { id: 'image', icon: ImagePlus, label: 'Image' },
    { id: 'shapes' as ToolType, icon: Shapes, label: 'Shapes' },
    { id: 'eraser', icon: EraserIcon, label: 'Eraser' },
];

export const MobileToolbar: React.FC<MobileToolbarProps> = ({ onPropertiesClick }) => {
    const { activeTool, setActiveTool, addObject, openShapeEditor, openTextStudio } = useEditorStore();
    const imageInputRef = useRef<HTMLInputElement>(null);
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

    const handleToolSelect = (toolId: ToolType) => {
        if (toolId === 'image') {
            imageInputRef.current?.click();
        } else if (toolId === 'signature') {
            setIsSignatureModalOpen(true);
        } else if (toolId === ('shapes' as ToolType)) {
            openShapeEditor('add');
        } else if (toolId === 'text') {
            openTextStudio('create');
        } else {
            setActiveTool(toolId);
        }
    };

    const handleSignatureSave = (dataUrl: string) => {
        addObject({
            id: crypto.randomUUID(),
            type: 'image',
            x: 100,
            y: 100,
            width: 250,
            height: 125,
            src: dataUrl,
            rotation: 0,
            opacity: 1
        });
        setActiveTool('select');
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            const img = new Image();
            img.onload = () => {
                const aspect = img.width / img.height;
                const baseW = 200;
                addObject({
                    id: crypto.randomUUID(),
                    type: 'image',
                    x: 100,
                    y: 100,
                    width: baseW,
                    height: baseW / aspect,
                    src: dataUrl,
                    originalSrc: dataUrl,
                    rotation: 0,
                    opacity: 1
                });
                if (imageInputRef.current) imageInputRef.current.value = '';
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
    };

    return (
        <>
            {/* Mobile Bottom Toolbar - Only visible on mobile */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pb-4 pt-2 pointer-events-none">
                {/* Floating Properties Button */}
                <button
                    onClick={onPropertiesClick}
                    className="pointer-events-auto absolute right-4 -top-14 w-12 h-12 rounded-2xl bg-zinc-800/90 backdrop-blur-xl border border-white/10 shadow-2xl flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-700 transition-all active:scale-95"
                >
                    <Settings2 size={20} />
                </button>

                {/* Main Toolbar Dock */}
                <div className="pointer-events-auto bg-zinc-900/95 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl shadow-black/40 p-1.5 mx-auto w-fit max-w-full overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-0.5 px-1">
                        {MOBILE_TOOLS.map((tool) => {
                            const isActive = activeTool === tool.id;
                            return (
                                <button
                                    key={tool.id}
                                    onClick={() => handleToolSelect(tool.id)}
                                    className={clsx(
                                        "flex flex-col items-center justify-center min-w-[52px] h-14 rounded-xl transition-all duration-200",
                                        isActive
                                            ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                                            : "text-zinc-400 hover:text-white hover:bg-white/10"
                                    )}
                                >
                                    <tool.icon size={20} className={clsx("transition-transform", isActive && "scale-110")} />
                                    <span className="text-[9px] font-semibold mt-1 uppercase tracking-wider opacity-80">
                                        {tool.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <SignatureModal
                isOpen={isSignatureModalOpen}
                onClose={() => setIsSignatureModalOpen(false)}
                onSave={handleSignatureSave}
            />

            <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                style={{ position: 'absolute', width: 0, height: 0, opacity: 0, overflow: 'hidden', pointerEvents: 'none' }}
                onChange={handleImageUpload}
            />
        </>
    );
};
