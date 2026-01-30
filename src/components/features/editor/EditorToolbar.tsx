import React from 'react';
import { useEditorStore } from '../../../store/editorStore';
import type { ToolType } from '../../../store/pdfStore';
import {
    MousePointer2,
    Hand,
    Square,
    Circle,
    Type,
    Image as ImageIcon,
    Pen,
    Eraser,
    Highlighter
} from 'lucide-react';

export const EditorToolbar: React.FC = () => {
    const { activeTool, setActiveTool, addObject, currentPage } = useEditorStore();
    const imageInputRef = React.useRef<HTMLInputElement>(null);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            const img = new Image();
            img.onload = () => {
                // Calculate reasonable dimensions
                const targetWidth = 200;
                const targetHeight = (img.height / img.width) * targetWidth;

                addObject({
                    id: crypto.randomUUID(),
                    type: 'image',
                    x: 100, // Default position
                    y: 100,
                    width: targetWidth,
                    height: targetHeight,
                    src: dataUrl,
                    rotation: 0,
                    opacity: 1
                });
                setActiveTool('select');
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
        e.target.value = ''; // Reset
    };

    const handleToolClick = (toolId: ToolType) => {
        if (toolId === 'image') {
            imageInputRef.current?.click();
        } else {
            setActiveTool(toolId);
        }
    };

    const tools: { id: ToolType; icon: React.ReactNode; label: string }[] = [
        { id: 'select', icon: <MousePointer2 size={20} />, label: 'Select' },
        { id: 'pan', icon: <Hand size={20} />, label: 'Pan' },
        { id: 'rectangle', icon: <Square size={20} />, label: 'Rectangle' },
        { id: 'circle', icon: <Circle size={20} />, label: 'Circle' },
        { id: 'text', icon: <Type size={20} />, label: 'Text' },
        { id: 'image', icon: <ImageIcon size={20} />, label: 'Image' },
        { id: 'pen', icon: <Pen size={20} />, label: 'Pen' },
        { id: 'highlighter', icon: <Highlighter size={20} />, label: 'Highlighter' },
        { id: 'eraser', icon: <Eraser size={20} />, label: 'Eraser' },
    ];

    return (
        <div className="w-16 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-4 gap-4 z-30 shadow-sm h-full">
            {tools.map((tool) => (
                <button
                    key={tool.id}
                    onClick={() => handleToolClick(tool.id)}
                    className={`p-3 rounded-xl transition-all duration-200 flex flex-col items-center gap-1 group relative
                        ${activeTool === tool.id
                            ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50'
                            : 'text-gray-500 hover:bg-zinc-800 hover:text-gray-200'
                        }`}
                    title={tool.label}
                >
                    {tool.icon}
                    {/* Tooltip on hover (simple absolute pos) */}
                    <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity border border-zinc-700 shadow-xl">
                        {tool.label}
                    </div>
                </button>
            ))}

            <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
            />
        </div>
    );
};
