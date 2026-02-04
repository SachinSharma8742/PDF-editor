import React from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { Stamp, CheckCircle, AlertTriangle, XCircle, Award, ScanText } from 'lucide-react';
import type { PDFObject } from '../../../store/pdfStore';
import clsx from 'clsx';

// SVG Content for stamps
const STAMPS = {
    APPROVED: `<svg width="200" height="80" viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="5" width="190" height="70" rx="10" ry="10" fill="none" stroke="#22c55e" stroke-width="5"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="28" fill="#22c55e">APPROVED</text>
    </svg>`,
    REJECTED: `<svg width="200" height="80" viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="5" width="190" height="70" rx="10" ry="10" fill="none" stroke="#ef4444" stroke-width="5"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="28" fill="#ef4444">REJECTED</text>
    </svg>`,
    CONFIDENTIAL: `<svg width="200" height="80" viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="5" width="190" height="70" rx="10" ry="10" fill="none" stroke="#ef4444" stroke-width="5" stroke-dasharray="10,5"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="24" fill="#ef4444">CONFIDENTIAL</text>
    </svg>`,
    DRAFT: `<svg width="200" height="80" viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="5" width="190" height="70" rx="10" ry="10" fill="none" stroke="#6b7280" stroke-width="5"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="28" fill="#6b7280">DRAFT</text>
    </svg>`,
    PAID: `<svg width="200" height="80" viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="5" width="190" height="70" rx="10" ry="10" fill="none" stroke="#eab308" stroke-width="5"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="32" fill="#eab308">PAID</text>
    </svg>`,
    SIGN_HERE: `<svg width="200" height="60" viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="200" height="60" fill="#fef08a"/>
        <text x="100" y="30" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="20" fill="#854d0e">SIGN HERE</text>
        <path d="M10 30 L30 30 L25 25 M25 35 L30 30" stroke="#854d0e" stroke-width="2" fill="none"/>
    </svg>`
};

const CATEGORIES = [
    { id: 'business', label: 'Business', icon: Stamp },
    { id: 'status', label: 'Status', icon: CheckCircle },
    { id: 'notes', label: 'Notes', icon: ScanText },
    { id: 'alert', label: 'Alerts', icon: AlertTriangle },
];

export const StampsPanel: React.FC = () => {
    const { addObject, setActiveTool } = useEditorStore();
    const [activeCategory, setActiveCategory] = React.useState('business');

    const handleAddStamp = (type: string, svgContent: string, width: number, height: number) => {
        const newStamp: PDFObject = {
            id: `stamp-${Date.now()}`,
            type: 'stamp',
            x: 100, // Default position
            y: 100,
            width,
            height,
            content: svgContent,
            opacity: 1,
            rotation: 0
        };
        addObject(newStamp);
        setActiveTool('select'); // Switch back to select mode to move it
    };

    const handleAddStickyNote = () => {
        const newNote: PDFObject = {
            id: `note-${Date.now()}`,
            type: 'sticky-note',
            x: 100,
            y: 100,
            width: 200,
            height: 150,
            fill: '#fef08a',
            text: 'Double click to edit note...',
            opacity: 1,
            rotation: 0
        };
        addObject(newNote);
        setActiveTool('select');
    };

    return (
        <div className="flex flex-col h-full">
            {/* Category Tabs */}
            <div className="flex px-2 py-2 gap-1 overflow-x-auto border-b border-white/5 bg-zinc-900/50">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={clsx(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] uppercase font-bold tracking-wider transition-all whitespace-nowrap",
                            activeCategory === cat.id
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                        )}
                    >
                        <cat.icon size={12} />
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 gap-3 p-4">
                {activeCategory === 'notes' && (
                    <button
                        onClick={handleAddStickyNote}
                        className="col-span-2 group relative flex flex-col items-center gap-2 p-4 rounded-xl border border-dashed border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10 hover:border-yellow-500/50 transition-all active:scale-95"
                    >
                        <div className="h-20 w-32 bg-[#fef08a] shadow-md flex items-center justify-center rounded-sm transform group-hover:rotate-2 transition-transform">
                            <span className="text-[10px] text-yellow-800 font-medium">Sticky Note</span>
                        </div>
                        <span className="text-[10px] font-medium text-zinc-400 group-hover:text-yellow-400 transition-colors uppercase tracking-wide">
                            Add Sticky Note
                        </span>
                    </button>
                )}

                {(activeCategory === 'business') && (
                    <>
                        <StampPreview
                            label="Approved"
                            svg={STAMPS.APPROVED}
                            onClick={() => handleAddStamp('APPROVED', STAMPS.APPROVED, 150, 60)}
                        />
                        <StampPreview
                            label="Draft"
                            svg={STAMPS.DRAFT}
                            onClick={() => handleAddStamp('DRAFT', STAMPS.DRAFT, 150, 60)}
                        />
                    </>
                )}

                {(activeCategory === 'status') && (
                    <>
                        <StampPreview
                            label="Rejected"
                            svg={STAMPS.REJECTED}
                            onClick={() => handleAddStamp('REJECTED', STAMPS.REJECTED, 150, 60)}
                        />
                        <StampPreview
                            label="Paid"
                            svg={STAMPS.PAID}
                            onClick={() => handleAddStamp('PAID', STAMPS.PAID, 120, 50)}
                        />
                        <StampPreview
                            label="Sign Here"
                            svg={STAMPS.SIGN_HERE}
                            onClick={() => handleAddStamp('SIGN_HERE', STAMPS.SIGN_HERE, 150, 45)}
                        />
                    </>
                )}

                {(activeCategory === 'alert') && (
                    <>
                        <StampPreview
                            label="Confidential"
                            svg={STAMPS.CONFIDENTIAL}
                            onClick={() => handleAddStamp('CONFIDENTIAL', STAMPS.CONFIDENTIAL, 150, 60)}
                        />
                    </>
                )}
            </div>

            <div className="mt-auto p-4 border-t border-white/5">
                <div className="bg-blue-900/20 border border-blue-500/20 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Award size={14} className="text-blue-400" />
                        <span className="text-xs font-bold text-blue-100">Pro Tip</span>
                    </div>
                    <p className="text-[10px] text-blue-300/70 leading-relaxed">
                        Stamps are vector-based. You can resize them without losing quality. Rotate them using the top handle.
                    </p>
                </div>
            </div>
        </div>
    );
};

const StampPreview: React.FC<{ label: string, svg: string, onClick: () => void }> = ({ label, svg, onClick }) => (
    <button
        onClick={onClick}
        className="group relative flex flex-col items-center gap-2 p-3 rounded-xl border border-white/5 bg-[#18181b] hover:border-blue-500/50 hover:bg-blue-500/5 transition-all active:scale-95"
    >
        <div className="h-12 w-full flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
            <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
                alt={label}
                className="max-h-full max-w-full drop-shadow-sm"
            />
        </div>
        <span className="text-[10px] font-medium text-zinc-500 group-hover:text-blue-400 transition-colors uppercase tracking-wide">
            {label}
        </span>
    </button>
);
