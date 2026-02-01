import React from 'react';
import { Stamp as LucideStamp, Star, AlertCircle, CheckCircle, XCircle, Clock, FileText, ThumbsUp, HelpCircle } from 'lucide-react';
import { useEditorStore } from '../../../store/editorStore';

interface Stamp {
    id: string;
    label: string;
    icon: React.ReactNode;
    svgContent: string; // The raw SVG to render on canvas
    color: string;
}

const STAMPS: Record<string, Stamp[]> = {
    'Business': [
        {
            id: 'stamp-approved',
            label: 'Approved',
            icon: <CheckCircle className="w-6 h-6" />,
            color: '#22c55e',
            svgContent: `<svg width="200" height="80" viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="5" width="190" height="70" rx="10" ry="10" fill="#22c55e" fill-opacity="0.1" stroke="#22c55e" stroke-width="4"/>
                <text x="100" y="52" font-family="Arial, sans-serif" font-size="32" font-weight="900" fill="#22c55e" text-anchor="middle" letter-spacing="2">APPROVED</text>
            </svg>`
        },
        {
            id: 'stamp-rejected',
            label: 'Rejected',
            icon: <XCircle className="w-6 h-6" />,
            color: '#ef4444',
            svgContent: `<svg width="200" height="80" viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="5" width="190" height="70" rx="10" ry="10" fill="#ef4444" fill-opacity="0.1" stroke="#ef4444" stroke-width="4"/>
                <text x="100" y="52" font-family="Arial, sans-serif" font-size="32" font-weight="900" fill="#ef4444" text-anchor="middle" letter-spacing="2">REJECTED</text>
            </svg>`
        },
        {
            id: 'stamp-urgent',
            label: 'Urgent',
            icon: <Clock className="w-6 h-6" />,
            color: '#f97316',
            svgContent: `<svg width="200" height="80" viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="5" width="190" height="70" rx="10" ry="10" fill="#f97316" fill-opacity="0.1" stroke="#f97316" stroke-width="4" stroke-dasharray="8,4"/>
                <text x="100" y="52" font-family="Arial, sans-serif" font-size="32" font-weight="900" fill="#f97316" text-anchor="middle" letter-spacing="2">URGENT</text>
            </svg>`
        },
        {
            id: 'stamp-draft',
            label: 'Draft',
            icon: <FileText className="w-6 h-6" />,
            color: '#64748b',
            svgContent: `<svg width="200" height="80" viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
                <text x="100" y="55" font-family="Arial, sans-serif" font-size="54" font-weight="900" fill="#64748b" fill-opacity="0.2" text-anchor="middle" transform="rotate(-10, 100, 40)">DRAFT</text>
            </svg>`
        }
    ],
    'Status Icons': [
        {
            id: 'icon-star',
            label: 'Star',
            icon: <Star className="w-6 h-6" />,
            color: '#eab308',
            svgContent: `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 5L61.23 34.11H91.13L66.75 51.64L76.13 80.72L50 63L23.87 80.72L33.25 51.64L8.87 34.11H38.77L50 5Z" fill="#eab308" stroke="#a16207" stroke-width="2"/>
            </svg>`
        },
        {
            id: 'icon-thumb',
            label: 'Review',
            icon: <ThumbsUp className="w-6 h-6" />,
            color: '#3b82f6',
            svgContent: `<svg width="100" height="100" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" fill="#3b82f6" fill-opacity="0.2" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`
        },
        {
            id: 'icon-help',
            label: 'Question',
            icon: <HelpCircle className="w-6 h-6" />,
            color: '#8b5cf6',
            svgContent: `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="45" fill="#8b5cf6" fill-opacity="0.1" stroke="#8b5cf6" stroke-width="4"/>
                <text x="50" y="68" font-family="Arial" font-size="54" font-weight="900" fill="#8b5cf6" text-anchor="middle">?</text>
            </svg>`
        }
    ]
};

export const StampsPanel: React.FC = () => {
    const { addObject } = useEditorStore();

    const handleDragStart = (e: React.DragEvent, stamp: Stamp) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
            type: 'stamp',
            ...stamp
        }));
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleClick = (stamp: Stamp) => {
        addObject({
            id: crypto.randomUUID(),
            type: 'stamp',
            x: 50,
            y: 50,
            width: stamp.id.includes('stamp') ? 200 : 80,
            height: stamp.id.includes('stamp') ? 80 : 80,
            content: stamp.svgContent,
            opacity: 1,
            rotation: 0
        });
    };

    return (
        <div className="p-4 space-y-6">
            {Object.entries(STAMPS).map(([category, stamps]) => (
                <div key={category}>
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-[0.15em] mb-3 pl-1">
                        {category}
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        {stamps.map((stamp) => (
                            <button
                                key={stamp.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, stamp)}
                                onClick={() => handleClick(stamp)}
                                className="group relative aspect-square bg-[#09090b] rounded-2xl border border-white/5 hover:border-blue-500/50 hover:bg-zinc-800 transition-all flex flex-col items-center justify-center gap-2 shadow-sm shadow-black overflow-hidden"
                            >
                                <div className="text-zinc-400 group-hover:scale-110 group-hover:text-white transition-all duration-300">
                                    {stamp.icon}
                                </div>
                                <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300 font-bold uppercase tracking-wider text-center px-1">
                                    {stamp.label}
                                </span>

                                <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: stamp.color }} />
                            </button>
                        ))}
                    </div>
                </div>
            ))}

            <div className="mt-8 p-4 bg-zinc-800/30 rounded-2xl border border-white/5">
                <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                        <LucideStamp className="w-4 h-4 text-blue-400" />
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed pt-1">
                        <strong>Pro Tip:</strong> Click a stamp to place it at the top-left, or drag it specifically where you want it on the page.
                    </p>
                </div>
            </div>
        </div>
    );
};

