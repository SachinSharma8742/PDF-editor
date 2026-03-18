import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Layers, X, Droplets, Type, ShieldBan, RotateCw,
    ChevronDown, ChevronUp, Check, Loader2, AlertCircle,
    RotateCcw, Trash2
} from 'lucide-react';
import clsx from 'clsx';
import { usePDFStore } from '../../../store/pdfStore';
import { useBatchOperationStore } from '../../../store/batchOperationStore';
import {
    batchAddWatermark,
    batchRemoveWatermark,
    batchChangeTextColor,
    batchRotatePages,
    batchAutoRedact,
    type AutoRedactOptions,
} from '../../../utils/batchOperations';

interface BatchOperationsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

type OperationSection = 'watermark' | 'text-color' | 'rotate' | 'redact';

const SECTIONS: { id: OperationSection; label: string; icon: React.ElementType; description: string }[] = [
    { id: 'watermark', label: 'Watermark', icon: Droplets, description: 'Add watermark text to pages' },
    { id: 'text-color', label: 'Text Color', icon: Type, description: 'Change text color across pages' },
    { id: 'rotate', label: 'Rotate', icon: RotateCw, description: 'Rotate multiple pages at once' },
    { id: 'redact', label: 'Auto-Redact', icon: ShieldBan, description: 'Redact matching text on pages' },
];

export const BatchOperationsPanel: React.FC<BatchOperationsPanelProps> = ({ isOpen, onClose }) => {
    const { pages } = usePDFStore();
    const { isRunning, done, error, operationType, currentPage, totalPages, reset } = useBatchOperationStore();

    const [openSection, setOpenSection] = useState<OperationSection | null>('watermark');
    const [targetMode, setTargetMode] = useState<'all' | 'current'>('all');

    // Watermark State
    const [wmText, setWmText] = useState('CONFIDENTIAL');
    const [wmOpacity, setWmOpacity] = useState(0.2);
    const [wmColor, setWmColor] = useState('#000000');
    const [wmFontSize, setWmFontSize] = useState(48);
    const [wmRotate, setWmRotate] = useState(-45);
    const [wmRepeating, setWmRepeating] = useState(true);

    // Text Color State
    const [textColor, setTextColor] = useState('#000000');

    // Auto-Redact State
    const [redactTerm, setRedactTerm] = useState('');
    const [redactOptions, setRedactOptions] = useState<AutoRedactOptions>({
        caseSensitive: false,
        wholeWord: false,
        useRegex: false,
    });
    const [redactCount, setRedactCount] = useState<number | null>(null);

    const currentPdfPage = usePDFStore.getState().currentPage;

    const getTargetPageIds = (): string[] => {
        if (targetMode === 'current') {
            const page = pages.find((p) => p.pageNumber === currentPdfPage);
            return page ? [page.id] : [];
        }
        return []; // empty = all pages in utility functions
    };

    const handleWatermarkApply = () => {
        reset();
        batchAddWatermark(getTargetPageIds(), {
            text: wmText,
            fontSize: wmFontSize,
            opacity: wmOpacity,
            color: wmColor,
            rotate: wmRotate,
            isRepeating: wmRepeating,
        });
    };

    const handleWatermarkRemove = () => {
        reset();
        batchRemoveWatermark(getTargetPageIds());
    };

    const handleTextColor = () => {
        reset();
        batchChangeTextColor(getTargetPageIds(), textColor);
    };

    const handleRotateCW = () => {
        reset();
        batchRotatePages(getTargetPageIds(), 'cw');
    };

    const handleRotateCCW = () => {
        reset();
        batchRotatePages(getTargetPageIds(), 'ccw');
    };

    const handleAutoRedact = () => {
        if (!redactTerm.trim()) return;
        reset();
        const count = batchAutoRedact(getTargetPageIds(), redactTerm, redactOptions);
        setRedactCount(count);
    };

    const progress = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;

    if (!isOpen) return null;

    const panel = (
        <div
            className="fixed inset-0 z-[200] flex items-start justify-end pt-20 pr-8 pointer-events-none"
            role="dialog"
            aria-label="Batch Operations Panel"
        >
            <div className="pointer-events-auto w-[340px] bg-white/95 dark:bg-[#1e1e20]/98 backdrop-blur-2xl border border-zinc-200 dark:border-white/10 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.12)] dark:shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-white/5 bg-zinc-50/80 dark:bg-[#18181b]/60">
                    <div className="flex items-center gap-2">
                        <Layers size={15} className="text-purple-500" />
                        <span className="text-[12px] font-black text-zinc-800 dark:text-white uppercase tracking-widest">
                            Batch Operations
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-all"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Target Mode Selector */}
                <div className="px-4 pt-3 pb-2">
                    <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Apply to</div>
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 gap-1">
                        {(['all', 'current'] as const).map((m) => (
                            <button
                                key={m}
                                onClick={() => setTargetMode(m)}
                                className={clsx(
                                    "flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                                    targetMode === m
                                        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                                )}
                            >
                                {m === 'all' ? `All Pages (${pages.length})` : 'Current Page'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Progress indicator */}
                {isRunning && (
                    <div className="px-4 pb-2">
                        <div className="flex items-center gap-2 mb-1">
                            <Loader2 size={12} className="animate-spin text-blue-500" />
                            <span className="text-[10px] text-blue-400 font-bold capitalize">{operationType} in progress...</span>
                            <span className="text-[10px] text-zinc-400 ml-auto">{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Done / Error Status */}
                {done && !isRunning && (
                    <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
                        <Check size={12} className="text-green-400" />
                        <span className="text-[10px] text-green-400 font-bold">
                            Operation complete {redactCount !== null && operationType === 'redact' ? `— ${redactCount} text objects redacted` : ''}
                        </span>
                    </div>
                )}
                {error && (
                    <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <AlertCircle size={12} className="text-red-400" />
                        <span className="text-[10px] text-red-400 font-bold">{error}</span>
                    </div>
                )}

                {/* Operations */}
                <div className="divide-y divide-zinc-100 dark:divide-white/5 overflow-y-auto max-h-[60vh]">
                    {SECTIONS.map((section) => {
                        const isExpanded = openSection === section.id;
                        const Icon = section.icon;
                        return (
                            <div key={section.id}>
                                {/* Section Header */}
                                <button
                                    onClick={() => setOpenSection(isExpanded ? null : section.id)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors text-left"
                                >
                                    <div className={clsx(
                                        "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                                        isExpanded ? "bg-purple-100 dark:bg-purple-500/20" : "bg-zinc-100 dark:bg-white/5"
                                    )}>
                                        <Icon size={14} className={isExpanded ? "text-purple-500" : "text-zinc-500"} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[11px] font-black text-zinc-800 dark:text-white uppercase tracking-wider">{section.label}</div>
                                        <div className="text-[9px] text-zinc-400 dark:text-zinc-500">{section.description}</div>
                                    </div>
                                    {isExpanded ? (
                                        <ChevronUp size={14} className="text-zinc-400 shrink-0" />
                                    ) : (
                                        <ChevronDown size={14} className="text-zinc-400 shrink-0" />
                                    )}
                                </button>

                                {/* Section Content */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 space-y-3 bg-zinc-50/40 dark:bg-white/[0.01]">
                                        {section.id === 'watermark' && (
                                            <WatermarkSection
                                                text={wmText} onTextChange={setWmText}
                                                opacity={wmOpacity} onOpacityChange={setWmOpacity}
                                                color={wmColor} onColorChange={setWmColor}
                                                fontSize={wmFontSize} onFontSizeChange={setWmFontSize}
                                                rotate={wmRotate} onRotateChange={setWmRotate}
                                                repeating={wmRepeating} onRepeatingChange={setWmRepeating}
                                                onApply={handleWatermarkApply}
                                                onRemove={handleWatermarkRemove}
                                                isRunning={isRunning}
                                            />
                                        )}
                                        {section.id === 'text-color' && (
                                            <TextColorSection
                                                color={textColor}
                                                onColorChange={setTextColor}
                                                onApply={handleTextColor}
                                                isRunning={isRunning}
                                            />
                                        )}
                                        {section.id === 'rotate' && (
                                            <RotateSection
                                                onCW={handleRotateCW}
                                                onCCW={handleRotateCCW}
                                                isRunning={isRunning}
                                            />
                                        )}
                                        {section.id === 'redact' && (
                                            <RedactSection
                                                term={redactTerm} onTermChange={setRedactTerm}
                                                options={redactOptions} onOptionsChange={setRedactOptions}
                                                onApply={handleAutoRedact}
                                                isRunning={isRunning}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    return createPortal(panel, document.body);
};

// ─── Sub-section components ──────────────────────────────────────────────────

const inputClass = "w-full bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/10 rounded-xl py-2 px-3 text-[11px] text-zinc-900 dark:text-white outline-none focus:border-blue-500/60 transition-all";
const labelClass = "block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1";
const primaryBtnClass = "w-full flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-purple-500/20 active:scale-95";
const secondaryBtnClass = "flex-1 flex items-center justify-center gap-1.5 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 disabled:opacity-50 text-zinc-700 dark:text-zinc-300 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all border border-zinc-200 dark:border-white/5 active:scale-95";

const WatermarkSection: React.FC<{
    text: string; onTextChange: (v: string) => void;
    opacity: number; onOpacityChange: (v: number) => void;
    color: string; onColorChange: (v: string) => void;
    fontSize: number; onFontSizeChange: (v: number) => void;
    rotate: number; onRotateChange: (v: number) => void;
    repeating: boolean; onRepeatingChange: (v: boolean) => void;
    onApply: () => void;
    onRemove: () => void;
    isRunning: boolean;
}> = ({ text, onTextChange, opacity, onOpacityChange, color, onColorChange, fontSize, onFontSizeChange, rotate, onRotateChange, repeating, onRepeatingChange, onApply, onRemove, isRunning }) => (
    <div className="space-y-3">
        <div>
            <label className={labelClass}>Watermark Text</label>
            <input type="text" className={inputClass} value={text} onChange={(e) => onTextChange(e.target.value)} placeholder="e.g. CONFIDENTIAL" />
        </div>
        <div className="grid grid-cols-2 gap-2">
            <div>
                <label className={labelClass}>Font Size</label>
                <input type="number" className={inputClass} value={fontSize} min={12} max={200} onChange={(e) => onFontSizeChange(Number(e.target.value))} />
            </div>
            <div>
                <label className={labelClass}>Rotation (°)</label>
                <input type="number" className={inputClass} value={rotate} min={-180} max={180} onChange={(e) => onRotateChange(Number(e.target.value))} />
            </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
            <div>
                <label className={labelClass}>Color</label>
                <div className="flex items-center gap-2">
                    <input type="color" value={color} onChange={(e) => onColorChange(e.target.value)} className="w-8 h-8 rounded-lg border border-zinc-200 dark:border-white/10 cursor-pointer bg-transparent p-0.5 flex-shrink-0" />
                    <input type="text" className={inputClass} value={color} onChange={(e) => onColorChange(e.target.value)} />
                </div>
            </div>
            <div>
                <label className={labelClass}>Opacity ({Math.round(opacity * 100)}%)</label>
                <input type="range" min={0.05} max={1} step={0.05} value={opacity} onChange={(e) => onOpacityChange(Number(e.target.value))} className="w-full mt-2 accent-purple-500" />
            </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={repeating} onChange={(e) => onRepeatingChange(e.target.checked)} className="accent-purple-500 w-4 h-4 rounded" />
            <span className="text-[10px] text-zinc-600 dark:text-zinc-400 font-bold">Repeat Pattern</span>
        </label>
        <div className="flex gap-2 pt-1">
            <button onClick={onApply} disabled={isRunning || !text.trim()} className={primaryBtnClass}>
                {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} strokeWidth={3} />}
                Apply
            </button>
            <button onClick={onRemove} disabled={isRunning} className={secondaryBtnClass} title="Remove watermark from pages">
                <Trash2 size={11} strokeWidth={2.5} />
                Remove
            </button>
        </div>
    </div>
);

const TextColorSection: React.FC<{
    color: string;
    onColorChange: (v: string) => void;
    onApply: () => void;
    isRunning: boolean;
}> = ({ color, onColorChange, onApply, isRunning }) => (
    <div className="space-y-3">
        <div>
            <label className={labelClass}>New Text Color</label>
            <div className="flex items-center gap-2">
                <input type="color" value={color} onChange={(e) => onColorChange(e.target.value)} className="w-10 h-10 rounded-xl border border-zinc-200 dark:border-white/10 cursor-pointer bg-transparent p-0.5 flex-shrink-0" />
                <input type="text" className={inputClass} value={color} onChange={(e) => onColorChange(e.target.value)} placeholder="#000000" />
            </div>
        </div>
        <p className="text-[9px] text-zinc-400 leading-relaxed">
            Applies the selected color to all text objects on the target pages.
        </p>
        <button onClick={onApply} disabled={isRunning} className={primaryBtnClass}>
            {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Type size={12} strokeWidth={3} />}
            Apply Text Color
        </button>
    </div>
);

const RotateSection: React.FC<{
    onCW: () => void;
    onCCW: () => void;
    isRunning: boolean;
}> = ({ onCW, onCCW, isRunning }) => (
    <div className="space-y-3">
        <p className="text-[9px] text-zinc-400 leading-relaxed">
            Rotate the target pages 90° at a time.
        </p>
        <div className="flex gap-2">
            <button onClick={onCW} disabled={isRunning} className={`${secondaryBtnClass} flex-1`}>
                {isRunning ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} strokeWidth={2.5} />}
                Clockwise
            </button>
            <button onClick={onCCW} disabled={isRunning} className={`${secondaryBtnClass} flex-1`}>
                {isRunning ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} strokeWidth={2.5} />}
                Counter-CW
            </button>
        </div>
    </div>
);

const RedactSection: React.FC<{
    term: string; onTermChange: (v: string) => void;
    options: AutoRedactOptions; onOptionsChange: (v: AutoRedactOptions) => void;
    onApply: () => void;
    isRunning: boolean;
}> = ({ term, onTermChange, options, onOptionsChange, onApply, isRunning }) => (
    <div className="space-y-3">
        <div>
            <label className={labelClass}>Search Pattern</label>
            <input
                type="text"
                className={inputClass}
                value={term}
                onChange={(e) => onTermChange(e.target.value)}
                placeholder={options.useRegex ? 'e.g. \\d{3}-\\d{2}-\\d{4}' : 'Text to redact...'}
            />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
            {([
                { key: 'caseSensitive', label: 'Case Sensitive' },
                { key: 'wholeWord', label: 'Whole Word' },
                { key: 'useRegex', label: 'Regex' },
            ] as const).map(({ key, label }) => (
                <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={options[key]}
                        onChange={(e) => onOptionsChange({ ...options, [key]: e.target.checked })}
                        className="accent-purple-500 w-3.5 h-3.5"
                    />
                    <span className="text-[10px] text-zinc-600 dark:text-zinc-400 font-bold">{label}</span>
                </label>
            ))}
        </div>
        <p className="text-[9px] text-zinc-400 leading-relaxed">
            Adds a black redaction rectangle over any text object matching the pattern.
        </p>
        <button onClick={onApply} disabled={isRunning || !term.trim()} className={primaryBtnClass}>
            {isRunning ? <Loader2 size={12} className="animate-spin" /> : <ShieldBan size={12} strokeWidth={3} />}
            Auto-Redact
        </button>
    </div>
);
