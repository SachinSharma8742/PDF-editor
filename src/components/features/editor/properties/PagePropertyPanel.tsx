import React, { useEffect, useMemo, useState } from 'react';
import { useEditorStore } from '../../../../store/editorStore';
import { usePDFStore } from '../../../../store/pdfStore';
import { useBatchOperationStore } from '../../../../store/batchOperationStore';
import { Slider, SimpleInput, ToggleButton } from './PropertyComponents';
import {
    LayoutTemplate,
    ArrowUpToLine,
    ArrowDownToLine,
    Maximize2,
    RotateCw,
    RotateCcw,
    FlipHorizontal,
    FlipVertical,
    Repeat,
    Type,
    Target,
    FileText,
    Loader2,
} from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';
import { applyWatermarkToAllPages, rotateAllPages, type WatermarkPosition } from '../../../../utils/batchOperations';

export const PagePropertyPanel: React.FC = () => {
    const { currentPage, updateCurrentPage } = useEditorStore();
    const { updatePage, applyStructureToAllPages, flipPage, pages } = usePDFStore();
    const { isProcessing, currentTask, currentPage: processedPages, totalPages } = useBatchOperationStore();

    if (!currentPage) return null;

    const [watermarkScope, setWatermarkScope] = useState<'current' | 'all'>('current');
    const [rotationScope, setRotationScope] = useState<'current' | 'all'>('current');
    const [watermarkText, setWatermarkText] = useState(currentPage.watermark?.text || 'DRAFT');
    const [watermarkFontSize, setWatermarkFontSize] = useState(currentPage.watermark?.fontSize || 80);
    const [watermarkOpacity, setWatermarkOpacity] = useState(currentPage.watermark?.opacity ?? 0.18);
    const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>(currentPage.watermark?.position || 'center');
    const [watermarkAngle, setWatermarkAngle] = useState(currentPage.watermark?.rotate ?? -25);
    const [rotationStep] = useState<90 | -90>(90);

    const sortedPages = useMemo(() => [...pages].sort((a, b) => a.pageNumber - b.pageNumber), [pages]);
    const batchProgress = totalPages > 0 ? Math.round((processedPages / totalPages) * 100) : 0;

    const presetDimensions: Record<string, { width: number; height: number }> = {
        A4: { width: 595, height: 842 },
        Letter: { width: 612, height: 792 },
        Legal: { width: 612, height: 1008 },
        Tabloid: { width: 792, height: 1224 },
    };

    const matchingPreset = Object.entries(presetDimensions).find(
        ([, dims]) => Math.round(currentPage.width) === dims.width && Math.round(currentPage.height) === dims.height
    )?.[0];

    const isPortrait = currentPage.height >= currentPage.width;
    const isBlankPage = currentPage.source === 'blank';

    const watermarkPositionGrid: Array<{ key: string; position?: WatermarkPosition; dotClass: string }> = [
        { key: 'top-left', position: 'top-left', dotClass: 'top-1.5 left-1.5' },
        { key: 'top-center', position: 'top-center', dotClass: 'top-1.5 left-1/2 -translate-x-1/2' },
        { key: 'top-right', position: 'top-right', dotClass: 'top-1.5 right-1.5' },
        { key: 'middle-left', position: 'middle-left', dotClass: 'top-1/2 left-1.5 -translate-y-1/2' },
        { key: 'center', position: 'center', dotClass: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' },
        { key: 'middle-right', position: 'middle-right', dotClass: 'top-1/2 right-1.5 -translate-y-1/2' },
        { key: 'bottom-left', position: 'bottom-left', dotClass: 'bottom-1.5 left-1.5' },
        { key: 'bottom-center', position: 'bottom-center', dotClass: 'bottom-1.5 left-1/2 -translate-x-1/2' },
        { key: 'bottom-right', position: 'bottom-right', dotClass: 'bottom-1.5 right-1.5' },
    ];

    useEffect(() => {
        setWatermarkText(currentPage.watermark?.text || 'DRAFT');
        setWatermarkFontSize(currentPage.watermark?.fontSize || 80);
        setWatermarkOpacity(currentPage.watermark?.opacity ?? 0.18);
        setWatermarkPosition(currentPage.watermark?.position || 'center');
        setWatermarkAngle(currentPage.watermark?.rotate ?? -25);
    }, [currentPage.id]);

    const handleUpdate = (updates: any) => {
        // Update both stores for immediate visual feedback
        updatePage(currentPage.id, updates);
        updateCurrentPage(updates);
    };

    const applyWatermark = () => {
        const text = watermarkText.trim();
        if (!text) return;

        if (watermarkScope === 'current') {
            handleUpdate({
                watermark: {
                    text,
                    fontSize: watermarkFontSize,
                    opacity: watermarkOpacity,
                    color: '#000000',
                    position: watermarkPosition,
                    rotate: watermarkAngle,
                    isRepeating: false,
                },
                isEdited: true,
            });
            return;
        }

        applyWatermarkToAllPages(
            text,
            watermarkFontSize,
            watermarkOpacity,
            watermarkPosition,
            watermarkAngle,
            sortedPages,
            {
                editorCurrentPage: currentPage,
                updateEditorCurrentPage: updateCurrentPage,
            }
        );
    };

    const applyRotation = (stepOverride?: 90 | -90) => {
        const stepToApply = stepOverride ?? rotationStep;

        if (rotationScope === 'current') {
            const nextRotation = (((currentPage.rotation || 0) + stepToApply) % 360 + 360) % 360;
            handleUpdate({ rotation: nextRotation, isEdited: true });
            return;
        }

        rotateAllPages(stepToApply, sortedPages, {
            editorCurrentPage: currentPage,
            updateEditorCurrentPage: updateCurrentPage,
        });
    };

    const applyFlip = (direction: 'horizontal' | 'vertical') => {
        if (rotationScope === 'current') {
            flipPage(currentPage.id, direction);
            handleUpdate(direction === 'horizontal'
                ? { flipX: !currentPage.flipX, isEdited: true }
                : { flipY: !currentPage.flipY, isEdited: true }
            );
            return;
        }

        sortedPages.forEach((page) => {
            flipPage(page.id, direction);
        });

        const syncedCurrent = usePDFStore.getState().pages.find((p) => p.id === currentPage.id);
        if (syncedCurrent) {
            updateCurrentPage({
                flipX: syncedCurrent.flipX,
                flipY: syncedCurrent.flipY,
                isEdited: true,
            });
        }
    };

    useEffect(() => {
        if (!currentPage.watermark?.text) return;
        if (!watermarkText.trim()) return;

        const timeout = window.setTimeout(() => {
            applyWatermark();
        }, 120);

        return () => window.clearTimeout(timeout);
    }, [watermarkText, watermarkFontSize, watermarkOpacity, watermarkPosition, watermarkAngle, watermarkScope]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#1c1d20] text-zinc-900 dark:text-zinc-100 transition-colors duration-300">
            <div className="px-5 py-4 border-b border-zinc-200/70 dark:border-white/10 bg-white/90 dark:bg-[#17181b]/95 sticky top-0 z-10 backdrop-blur-xl">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-400/20">
                            <LayoutTemplate size={16} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-800 dark:text-zinc-100">Page Properties</h3>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">Page {currentPage.pageNumber} of {pages.length}</p>
                        </div>
                    </div>
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/10">
                        {isPortrait ? 'Portrait' : 'Landscape'}
                    </span>
                </div>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto custom-scrollbar bg-zinc-50/60 dark:bg-transparent">
                {isBlankPage && (
                    <CollapsibleSection
                        title="Blank Page Layout"
                        icon={<Maximize2 size={12} />}
                        storageKey="blank_page_layout"
                    >
                        <div className="space-y-4 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
                            <div className="grid grid-cols-4 gap-2">
                                {Object.keys(presetDimensions).map((preset) => (
                                    <button
                                        key={preset}
                                        onClick={() => handleUpdate(presetDimensions[preset])}
                                        className={`p-2 rounded-lg text-[10px] font-semibold border transition-all ${matchingPreset === preset
                                            ? 'bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-500/30'
                                            : 'bg-zinc-50 dark:bg-white/[0.02] border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10'
                                            }`}
                                    >
                                        {preset}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <SimpleInput
                                    label="Width"
                                    value={Math.round(currentPage.width)}
                                    onChange={(v) => handleUpdate({ width: v })}
                                />
                                <SimpleInput
                                    label="Height"
                                    value={Math.round(currentPage.height)}
                                    onChange={(v) => handleUpdate({ height: v })}
                                />
                            </div>

                            <button
                                onClick={() => handleUpdate({ width: currentPage.height, height: currentPage.width })}
                                className="w-full p-2.5 rounded-xl bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                            >
                                <Repeat size={13} />
                                <span className="text-[10px] font-semibold uppercase tracking-wide">Swap Orientation</span>
                            </button>
                        </div>
                    </CollapsibleSection>
                )}

                <CollapsibleSection
                    title="Rotation"
                    icon={<RotateCw size={12} />}
                    storageKey="page_rotation"
                >
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">Current Rotation</span>
                                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-white/10">
                                    {((currentPage.rotation || 0) + 360) % 360}°
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-100/80 dark:bg-white/[0.03] p-1">
                                <button
                                    onClick={() => setRotationScope('current')}
                                    className={`flex items-center justify-center gap-2 px-2 py-2 rounded-lg text-[10px] font-semibold transition-all ${rotationScope === 'current'
                                        ? 'bg-blue-600 text-white'
                                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-white/10'
                                        }`}
                                >
                                    <Target size={12} /> Current
                                </button>
                                <button
                                    onClick={() => setRotationScope('all')}
                                    className={`flex items-center justify-center gap-2 px-2 py-2 rounded-lg text-[10px] font-semibold transition-all ${rotationScope === 'all'
                                        ? 'bg-blue-600 text-white'
                                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-white/10'
                                        }`}
                                >
                                    <FileText size={12} /> All Pages
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => {
                                        applyRotation(90);
                                    }}
                                    disabled={isProcessing}
                                    title="Rotate 90 degrees clockwise"
                                    className="group px-3 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-700 hover:bg-black dark:hover:bg-zinc-600 disabled:opacity-50 text-white transition-all flex items-center justify-center"
                                >
                                    <RotateCw size={16} className="transition-transform group-hover:rotate-45" />
                                </button>
                                <button
                                    onClick={() => {
                                        applyRotation(-90);
                                    }}
                                    disabled={isProcessing}
                                    title="Rotate 90 degrees counterclockwise"
                                    className="group px-3 py-2.5 rounded-xl bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-white/10 disabled:opacity-50 transition-all flex items-center justify-center"
                                >
                                    <RotateCcw size={16} className="transition-transform group-hover:-rotate-45" />
                                </button>
                            </div>

                            <div className="h-px bg-zinc-200 dark:bg-white/10" />

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => applyFlip('horizontal')}
                                    title="Flip horizontal"
                                    className="group px-3 py-2.5 rounded-xl bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-white/10 transition-all flex items-center justify-center"
                                >
                                    <FlipHorizontal size={16} className="transition-transform group-hover:scale-110" />
                                </button>
                                <button
                                    onClick={() => applyFlip('vertical')}
                                    title="Flip vertical"
                                    className="group px-3 py-2.5 rounded-xl bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-white/10 transition-all flex items-center justify-center"
                                >
                                    <FlipVertical size={16} className="transition-transform group-hover:scale-110" />
                                </button>
                            </div>
                        </div>

                        {isProcessing && currentTask?.includes('rotate') && (
                            <div className="space-y-1.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-2.5">
                                <div className="flex justify-between text-[9px] text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                                    <span>{currentTask || 'Processing'}</span>
                                    <span>{batchProgress}%</span>
                                </div>
                                <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${batchProgress}%` }} />
                                </div>
                            </div>
                        )}
                    </div>
                </CollapsibleSection>

                <CollapsibleSection
                    title="Header"
                    icon={<ArrowUpToLine size={12} />}
                    storageKey="page_header"
                    action={
                        <button
                            onClick={() => applyStructureToAllPages('both', currentPage.structure)}
                            className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 uppercase tracking-wide transition-colors"
                        >
                            Apply to All
                        </button>
                    }
                >
                    <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 space-y-3">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">Header Overlay</span>
                            </div>
                            <ToggleButton
                                active={!!currentPage.structure?.header}
                                onClick={() => {
                                    const newStruct = { ...(currentPage.structure || {}) };
                                    if (newStruct.header) delete newStruct.header;
                                    else newStruct.header = { text: 'Document Title', align: 'center', fontSize: 10, color: '#71717a', opacity: 0.8 };
                                    handleUpdate({ structure: newStruct });
                                }}
                            />
                        </div>

                        {currentPage.structure?.header && (
                            <input
                                type="text"
                                value={currentPage.structure.header.text}
                                onChange={(e) =>
                                    handleUpdate({
                                        structure: { ...(currentPage.structure || {}), header: { ...currentPage.structure!.header!, text: e.target.value } },
                                    })
                                }
                                className="w-full bg-white dark:bg-black/30 border border-zinc-200 dark:border-white/10 rounded-lg p-2.5 text-[12px] text-zinc-900 dark:text-white outline-none focus:border-blue-500/30 transition-all"
                                placeholder="Header text"
                            />
                        )}
                    </div>
                </CollapsibleSection>

                <CollapsibleSection
                    title="Footer"
                    icon={<ArrowDownToLine size={12} />}
                    storageKey="page_footer"
                    action={
                        <button
                            onClick={() => applyStructureToAllPages('footer', currentPage.structure)}
                            className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 uppercase tracking-wide transition-colors"
                        >
                            Apply to All
                        </button>
                    }
                >
                    <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">Footer Overlay</span>
                            <ToggleButton
                                active={!!currentPage.structure?.footer}
                                onClick={() => {
                                    const newStruct = { ...(currentPage.structure || {}) };
                                    if (newStruct.footer) delete newStruct.footer;
                                    else newStruct.footer = { text: 'Page {{page}} of {{total}}', align: 'center', fontSize: 9, color: '#71717a', opacity: 0.8 };
                                    handleUpdate({ structure: newStruct });
                                }}
                            />
                        </div>

                        {currentPage.structure?.footer && (
                            <input
                                type="text"
                                value={currentPage.structure.footer.text}
                                onChange={(e) =>
                                    handleUpdate({
                                        structure: { ...(currentPage.structure || {}), footer: { ...currentPage.structure!.footer!, text: e.target.value } },
                                    })
                                }
                                className="w-full bg-white dark:bg-black/30 border border-zinc-200 dark:border-white/10 rounded-lg p-2.5 text-[12px] text-zinc-900 dark:text-white outline-none focus:border-blue-500/30 transition-all"
                                placeholder="Footer text"
                            />
                        )}
                    </div>
                </CollapsibleSection>

                <CollapsibleSection
                    title="Watermark"
                    icon={<Type size={12} />}
                    storageKey="page_watermark"
                >
                    <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">Watermark Overlay</span>
                            <ToggleButton
                                active={!!currentPage.watermark?.text}
                                onClick={() => {
                                    if (currentPage.watermark?.text) {
                                        handleUpdate({ watermark: undefined });
                                        return;
                                    }
                                    const defaultText = watermarkText.trim() || 'DRAFT';
                                    setWatermarkText(defaultText);
                                    handleUpdate({
                                        watermark: {
                                            text: defaultText,
                                            color: '#71717a',
                                            opacity: watermarkOpacity,
                                            fontSize: watermarkFontSize,
                                            position: watermarkPosition,
                                            rotate: watermarkAngle,
                                        },
                                    });
                                }}
                            />
                        </div>

                        {currentPage.watermark?.text && (
                            <>
                                <div className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-100/80 dark:bg-white/[0.03] p-1">
                                    <button
                                        onClick={() => setWatermarkScope('current')}
                                        className={`flex items-center justify-center gap-2 px-2 py-2 rounded-lg text-[10px] font-semibold transition-all ${watermarkScope === 'current'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-white/10'
                                            }`}
                                    >
                                        <Target size={12} /> Current
                                    </button>
                                    <button
                                        onClick={() => setWatermarkScope('all')}
                                        className={`flex items-center justify-center gap-2 px-2 py-2 rounded-lg text-[10px] font-semibold transition-all ${watermarkScope === 'all'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-white/10'
                                            }`}
                                    >
                                        <FileText size={12} /> All Pages
                                    </button>
                                </div>

                                <input
                                    type="text"
                                    value={watermarkText}
                                    onChange={(e) => setWatermarkText(e.target.value)}
                                    className="w-full bg-white dark:bg-black/30 border border-zinc-200 dark:border-white/10 rounded-lg p-2.5 text-[12px] text-zinc-900 dark:text-white outline-none focus:border-blue-500/30 transition-all"
                                    placeholder="Watermark text"
                                />

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                                        <span>Size</span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min={10}
                                                max={240}
                                                step={1}
                                                value={watermarkFontSize}
                                                onChange={(e) => {
                                                    const next = Number(e.target.value);
                                                    if (Number.isNaN(next)) return;
                                                    setWatermarkFontSize(Math.min(240, Math.max(10, Math.round(next))));
                                                }}
                                                className="w-16 h-7 rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-2 text-[11px] text-zinc-800 dark:text-zinc-100 outline-none focus:border-blue-500/60"
                                            />
                                            <span className="font-semibold text-zinc-700 dark:text-zinc-200">px</span>
                                        </div>
                                    </div>
                                    <Slider value={watermarkFontSize} min={10} max={240} step={1} onChange={(v) => setWatermarkFontSize(v)} />
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                                        <span>Opacity</span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min={0}
                                                max={100}
                                                step={1}
                                                value={Math.round(watermarkOpacity * 100)}
                                                onChange={(e) => {
                                                    const next = Number(e.target.value);
                                                    if (Number.isNaN(next)) return;
                                                    const clamped = Math.min(100, Math.max(0, Math.round(next)));
                                                    setWatermarkOpacity(clamped / 100);
                                                }}
                                                className="w-16 h-7 rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-2 text-[11px] text-zinc-800 dark:text-zinc-100 outline-none focus:border-blue-500/60"
                                            />
                                            <span className="font-semibold text-zinc-700 dark:text-zinc-200">%</span>
                                        </div>
                                    </div>
                                    <Slider value={watermarkOpacity} min={0} max={1} step={0.01} onChange={(v) => setWatermarkOpacity(v)} />
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                                        <span>Angle</span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min={-180}
                                                max={180}
                                                step={1}
                                                value={watermarkAngle}
                                                onChange={(e) => {
                                                    const next = Number(e.target.value);
                                                    if (Number.isNaN(next)) return;
                                                    setWatermarkAngle(Math.min(180, Math.max(-180, Math.round(next))));
                                                }}
                                                className="w-16 h-7 rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-2 text-[11px] text-zinc-800 dark:text-zinc-100 outline-none focus:border-blue-500/60"
                                            />
                                            <span className="font-semibold text-zinc-700 dark:text-zinc-200">deg</span>
                                        </div>
                                    </div>
                                    <Slider value={watermarkAngle} min={-180} max={180} step={1} onChange={(v) => setWatermarkAngle(Math.round(v))} />
                                </div>

                                <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.03] p-2">
                                    <div className="grid grid-cols-3 gap-2">
                                        {watermarkPositionGrid.map((cell) => {
                                            const isActive = cell.position === watermarkPosition;

                                            return (
                                                <button
                                                    key={cell.key}
                                                    type="button"
                                                    onClick={() => setWatermarkPosition(cell.position as WatermarkPosition)}
                                                    aria-label={cell.position || cell.key}
                                                    className={`relative h-10 w-full rounded-lg border transition-all ${isActive
                                                        ? 'border-blue-500 bg-blue-500/10 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.45)]'
                                                        : 'border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.02] hover:border-zinc-300 dark:hover:border-white/20'
                                                        }`}
                                                >
                                                    <span
                                                        className={`absolute h-1.5 w-1.5 rounded-full transition-all ${cell.dotClass} ${isActive
                                                            ? 'bg-blue-500'
                                                            : 'bg-zinc-500 dark:bg-zinc-400'
                                                            }`}
                                                    />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </CollapsibleSection>
            </div>
        </div>
    );
};
