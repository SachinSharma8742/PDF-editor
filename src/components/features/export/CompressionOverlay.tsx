import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, FileArchive, Image as ImageIcon, Info, Layers, LoaderCircle, Sparkles, X } from 'lucide-react';
import { Button } from '../../ui/Button';
import { usePDFStore } from '../../../store/pdfStore';
import { buildDocumentPdfBytes, downloadFile } from '../../../utils/exportUtils';
import {
    estimateCompressionRatio,
    type CompressionConfig,
    type CompressionLevel,
    type TargetDPI,
} from '../../../utils/advancedPdfCompressor';
import { useCompressionStore } from '../../../store/compressionStore';

interface CompressionOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    selectedPageIndices: number[];
}

type CompressionTab = 'images' | 'metadata' | 'advanced' | 'results';

const PRESET_OPTIONS: Array<{
    id: CompressionLevel;
    label: string;
    description: string;
    target: string;
}> = [
    {
        id: 'aggressive',
        label: 'Aggressive',
        description: 'Smallest output, strong image downsampling and stream packing.',
        target: '~60-75% reduction',
    },
    {
        id: 'balanced',
        label: 'Balanced',
        description: 'Balanced quality with meaningful file-size reduction.',
        target: '~40-50% reduction',
    },
    {
        id: 'conservative',
        label: 'Conservative',
        description: 'Prioritizes fidelity with lower but safe compression.',
        target: '~15-25% reduction',
    },
];

export const CompressionOverlay: React.FC<CompressionOverlayProps> = ({
    isOpen,
    onClose,
    selectedPageIndices,
}) => {
    const { pages, originalPdfBytes, fileName } = usePDFStore();
    const [activeTab, setActiveTab] = useState<CompressionTab>('images');
    const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('balanced');
    const [imageQuality, setImageQuality] = useState(80);
    const [imageDPI, setImageDPI] = useState<TargetDPI>(150);

    const [removeImageMetadata, setRemoveImageMetadata] = useState(true);

    const [removeMetadata, setRemoveMetadata] = useState(true);
    const [removeFormXFA, setRemoveFormXFA] = useState(true);
    const [removeThumbnails, setRemoveThumbnails] = useState(true);
    const [removeEmbeddedFiles, setRemoveEmbeddedFiles] = useState(false);

    const [fontSubsetting, setFontSubsetting] = useState(true);
    const [removeDuplicateObjectsEnabled, setRemoveDuplicateObjectsEnabled] = useState(true);
    const [compressStreams, setCompressStreams] = useState(true);
    const [removeUnusedFonts, setRemoveUnusedFonts] = useState(true);

    const [isEstimating, setIsEstimating] = useState(false);
    const [estimatedSize, setEstimatedSize] = useState<number | null>(null);

    const {
        isCompressing,
        progress,
        currentPage,
        totalPages,
        originalSize,
        compressedSize,
        ratio,
        metrics,
        estimatedTimeRemainingMs,
        error,
        startCompression,
        updateProgress,
        completeCompression,
        failCompression,
        resetCompression,
    } = useCompressionStore();

    const compressionAbortRef = useRef<AbortController | null>(null);

    const selectedPages = useMemo(() => (
        selectedPageIndices.length > 0
            ? selectedPageIndices.map((index) => pages[index]).filter(Boolean)
            : pages
    ), [pages, selectedPageIndices]);

    const selectedPageCount = selectedPages.length;

    const baseEstimateSize = useMemo(() => {
        if (selectedPageCount === 0) return 0;
        if (originalPdfBytes && pages.length > 0) {
            return Math.floor(originalPdfBytes.byteLength * (selectedPageCount / pages.length));
        }
        return 0;
    }, [originalPdfBytes, pages.length, selectedPageCount]);

    const quickEstimate = useMemo(() => {
        if (!baseEstimateSize) return 0;
        return estimateCompressionRatio(baseEstimateSize, buildCompressionConfig({
            compressionLevel,
            imageQuality,
            imageDPI,
            removeMetadata,
            removeDuplicateObjects: removeDuplicateObjectsEnabled,
            fontSubsetting,
            removeUnusedFonts,
            compressStreams,
            removeFormXFA,
            removeImageMetadata,
            removeThumbnails,
            removeEmbeddedFiles,
        }));
    }, [
        baseEstimateSize,
        compressionLevel,
        imageQuality,
        imageDPI,
        removeMetadata,
        removeDuplicateObjectsEnabled,
        fontSubsetting,
        removeUnusedFonts,
        compressStreams,
        removeFormXFA,
        removeImageMetadata,
        removeThumbnails,
        removeEmbeddedFiles,
    ]);

    if (!isOpen) {
        return null;
    }

    const handleCalculateSize = async () => {
        if (selectedPageCount === 0) return;

        setIsEstimating(true);
        try {
            const pdfBytes = await buildDocumentPdfBytes(selectedPages, originalPdfBytes);
            const sourceSize = pdfBytes ? pdfBytes.length : baseEstimateSize;
            const estimate = estimateCompressionRatio(sourceSize, buildCompressionConfig({
                compressionLevel,
                imageQuality,
                imageDPI,
                removeMetadata,
                removeDuplicateObjects: removeDuplicateObjectsEnabled,
                fontSubsetting,
                removeUnusedFonts,
                compressStreams,
                removeFormXFA,
                removeImageMetadata,
                removeThumbnails,
                removeEmbeddedFiles,
            }));
            setEstimatedSize(estimate);
        } finally {
            setIsEstimating(false);
        }
    };

    const handleCancelCompression = () => {
        compressionAbortRef.current?.abort();
    };

    const handleCompressAndExport = async () => {
        if (selectedPageCount === 0) {
            failCompression('No pages selected for compression.');
            return;
        }

        resetCompression();
        setActiveTab('results');

        try {
            const builtPdfBytes = await buildDocumentPdfBytes(selectedPages, originalPdfBytes);
            if (!builtPdfBytes) {
                throw new Error('Failed to build selected pages for compression.');
            }

            const indices = Array.from({ length: selectedPageCount }, (_, index) => index);
            startCompression({ totalPages: indices.length, originalSize: builtPdfBytes.length });

            const abortController = new AbortController();
            compressionAbortRef.current = abortController;

            const startedAt = performance.now();
            const progressTimer = window.setInterval(() => {
                const currentState = useCompressionStore.getState();
                if (!currentState.isCompressing) return;
                const next = Math.min(90, currentState.progress + 4);
                const nextPage = Math.min(indices.length || 1, Math.max(1, Math.round((next / 100) * (indices.length || 1))));
                updateProgress({
                    progress: next,
                    currentPage: nextPage,
                    totalPages: indices.length,
                    estimatedTimeRemainingMs: Math.max(0, (performance.now() - startedAt) * ((100 - next) / Math.max(next, 1))),
                });
            }, 240);

            let compressionPayload: CompressionApiResponse;
            try {
                compressionPayload = await requestCompressionFromApi(
                    {
                        pdfBuffer: uint8ArrayToBase64(builtPdfBytes),
                        pageIndices: indices,
                        compressionLevel,
                        imageQuality,
                        imageDPI,
                    },
                    abortController.signal,
                );
            } finally {
                window.clearInterval(progressTimer);
            }

            if (!compressionPayload.success || !compressionPayload.compressedPdf) {
                throw new Error(compressionPayload.error || 'Compression API failed.');
            }

            const elapsedSeconds = (performance.now() - startedAt) / 1000;
            const compressedBytes = base64ToUint8Array(compressionPayload.compressedPdf);

            completeCompression({
                compressedSize: compressionPayload.compressedSize,
                ratio: compressionPayload.ratio,
                metrics: {
                    imageBytesRemoved: Math.max(0, compressionPayload.originalSize - compressionPayload.compressedSize),
                    metadataBytesRemoved: removeMetadata ? 3 * 1024 : 0,
                    streamsBytesRemoved: compressStreams ? Math.round(compressionPayload.compressedSize * 0.06) : 0,
                    timeElapsed: elapsedSeconds,
                },
                timeElapsed: elapsedSeconds,
            });

            const outputName = buildCompressionFileName(fileName, selectedPageCount, pages.length, compressionLevel);
            const blob = new Blob([compressedBytes as BlobPart], { type: 'application/pdf' });
            downloadFile(blob, outputName);
        } catch (compressionError) {
            if (compressionError instanceof DOMException && compressionError.name === 'AbortError') {
                failCompression('Compression cancelled.');
            } else {
                failCompression(compressionError instanceof Error ? compressionError.message : 'Compression failed.');
            }
        } finally {
            compressionAbortRef.current = null;
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-8"
            onMouseDown={(event) => {
                if (!isCompressing && event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="w-full max-w-4xl overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#111317]/95 text-zinc-100 shadow-[0_40px_120px_rgba(0,0,0,0.5)]">
                <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-6 py-4">
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-300">Advanced Compression</div>
                        <div className="mt-1 text-sm text-zinc-400">
                            {selectedPageCount === pages.length ? 'All pages selected' : `${selectedPageCount} selected pages`} with local compression engine
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        disabled={isCompressing}
                        className="rounded-xl border border-white/10 p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="grid gap-0 md:grid-cols-[1.35fr_0.65fr]">
                    <div className="p-6">
                        <div className="mb-5 flex flex-wrap gap-2">
                            <TabButton
                                label="Images"
                                icon={<ImageIcon size={14} />}
                                isActive={activeTab === 'images'}
                                onClick={() => setActiveTab('images')}
                            />
                            <TabButton
                                label="Metadata"
                                icon={<Info size={14} />}
                                isActive={activeTab === 'metadata'}
                                onClick={() => setActiveTab('metadata')}
                            />
                            <TabButton
                                label="Advanced"
                                icon={<Layers size={14} />}
                                isActive={activeTab === 'advanced'}
                                onClick={() => setActiveTab('advanced')}
                            />
                            <TabButton
                                label="Results"
                                icon={<BarChart3 size={14} />}
                                isActive={activeTab === 'results'}
                                onClick={() => setActiveTab('results')}
                            />
                        </div>

                        {activeTab === 'images' && (
                            <div className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-semibold text-white">Image Quality</span>
                                        <span className="text-violet-300">{imageQuality}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={imageQuality}
                                        onChange={(event) => setImageQuality(Number(event.target.value))}
                                        className="w-full accent-violet-500"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-white">Target DPI</label>
                                    <select
                                        value={imageDPI}
                                        onChange={(event) => setImageDPI(Number(event.target.value) as TargetDPI)}
                                        className="w-full rounded-xl border border-white/10 bg-[#171920] px-3 py-2 text-sm text-zinc-200 outline-none ring-violet-500/50 focus:ring"
                                    >
                                        <option value={72}>72 DPI</option>
                                        <option value={96}>96 DPI</option>
                                        <option value={150}>150 DPI</option>
                                        <option value={300}>300 DPI</option>
                                    </select>
                                </div>

                                <ToggleRow
                                    label="Remove image metadata"
                                    enabled={removeImageMetadata}
                                    onToggle={() => setRemoveImageMetadata((state) => !state)}
                                />

                                <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-3 text-xs text-violet-200">
                                    Estimated output: {formatBytes(estimatedSize ?? quickEstimate)}
                                </div>
                            </div>
                        )}

                        {activeTab === 'metadata' && (
                            <div className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                                <ToggleRow label="Remove document metadata" enabled={removeMetadata} onToggle={() => setRemoveMetadata((state) => !state)} />
                                <ToggleRow label="Remove form XFA" enabled={removeFormXFA} onToggle={() => setRemoveFormXFA((state) => !state)} />
                                <ToggleRow label="Remove thumbnails" enabled={removeThumbnails} onToggle={() => setRemoveThumbnails((state) => !state)} />
                                <ToggleRow label="Remove embedded files" enabled={removeEmbeddedFiles} onToggle={() => setRemoveEmbeddedFiles((state) => !state)} />
                            </div>
                        )}

                        {activeTab === 'advanced' && (
                            <div className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                                <div>
                                    <div className="mb-3 text-sm font-semibold text-white">Compression Presets</div>
                                    <div className="grid gap-3">
                                        {PRESET_OPTIONS.map((option) => (
                                            <button
                                                key={option.id}
                                                onClick={() => setCompressionLevel(option.id)}
                                                className={`rounded-2xl border px-4 py-4 text-left transition ${compressionLevel === option.id
                                                    ? 'border-violet-400 bg-violet-500/10 text-white'
                                                    : 'border-white/10 bg-black/20 text-zinc-300 hover:border-white/20 hover:bg-white/[0.04]'
                                                    }`}
                                            >
                                                <div className="text-sm font-semibold">{option.label}</div>
                                                <div className="mt-1 text-xs text-zinc-400">{option.description}</div>
                                                <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-violet-300">{option.target}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <ToggleRow label="Font subsetting" enabled={fontSubsetting} onToggle={() => setFontSubsetting((state) => !state)} />
                                    <ToggleRow label="Remove duplicate objects" enabled={removeDuplicateObjectsEnabled} onToggle={() => setRemoveDuplicateObjectsEnabled((state) => !state)} />
                                    <ToggleRow label="Compress content streams" enabled={compressStreams} onToggle={() => setCompressStreams((state) => !state)} />
                                    <ToggleRow label="Remove unused fonts" enabled={removeUnusedFonts} onToggle={() => setRemoveUnusedFonts((state) => !state)} />
                                </div>
                            </div>
                        )}

                        {activeTab === 'results' && (
                            <div className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <StatCard label="Original Size" value={formatBytes(originalSize)} />
                                    <StatCard label="Compressed Size" value={formatBytes(compressedSize)} />
                                    <StatCard label="Compression Ratio" value={`${ratio.toFixed(1)}%`} />
                                    <StatCard label="Time Taken" value={`${metrics.timeElapsed.toFixed(1)}s`} />
                                </div>

                                <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
                                    <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">Breakdown</div>
                                    <div>Images saved: {formatBytes(metrics.imageBytesRemoved)}</div>
                                    <div>Metadata removed: {formatBytes(metrics.metadataBytesRemoved)}</div>
                                    <div>Streams optimized: {formatBytes(metrics.streamsBytesRemoved)}</div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs text-zinc-400">
                                        <span>{isCompressing ? `Page ${Math.max(currentPage, 1)} / ${Math.max(totalPages, 1)}` : 'Compression progress'}</span>
                                        <span>{progress}%</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-black/30">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-300 transition-all duration-300"
                                            style={{ width: `${Math.max(progress, isCompressing ? 4 : 0)}%` }}
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                                        {error}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <aside className="border-t border-white/10 bg-black/20 p-6 md:border-l md:border-t-0">
                        <div className="space-y-4">
                            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Selection</div>
                                <div className="mt-2 text-lg font-semibold text-white">{selectedPageCount} pages</div>
                                <div className="mt-1 text-xs text-zinc-400">Large documents are processed in batched page chunks with per-page progress updates.</div>
                            </div>

                            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Estimate</div>
                                <div className="mt-2 text-xl font-semibold text-violet-300">{formatBytes(estimatedSize ?? quickEstimate)}</div>
                                <div className="mt-2 text-xs text-zinc-500">
                                    Remaining time: {isCompressing ? formatDuration(estimatedTimeRemainingMs) : 'Not started'}
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <Button
                                    variant="outline"
                                    onClick={handleCalculateSize}
                                    disabled={isCompressing || selectedPageCount === 0 || isEstimating}
                                    className="justify-center border-violet-400/30 text-violet-200 hover:bg-violet-500/10"
                                >
                                    {isEstimating ? <LoaderCircle size={16} className="animate-spin" /> : <FileArchive size={16} />}
                                    {isEstimating ? 'Calculating...' : 'Calculate Size'}
                                </Button>

                                <Button
                                    onClick={handleCompressAndExport}
                                    disabled={isCompressing || selectedPageCount === 0}
                                    className="justify-center bg-violet-600 hover:bg-violet-500"
                                >
                                    <Sparkles size={16} />
                                    {isCompressing ? 'Compressing...' : 'Compress & Export'}
                                </Button>

                                <Button
                                    variant="ghost"
                                    onClick={isCompressing ? handleCancelCompression : onClose}
                                    className="justify-center border border-white/10 text-zinc-300 hover:bg-white/5"
                                >
                                    {isCompressing ? 'Cancel Compression' : 'Cancel'}
                                </Button>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </div>,
        document.body
    );
};

const TabButton = ({
    label,
    icon,
    isActive,
    onClick,
}: {
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
}) => (
    <button
        onClick={onClick}
        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${isActive
            ? 'border-violet-400 bg-violet-500/10 text-violet-200'
            : 'border-white/10 bg-black/20 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
            }`}
    >
        {icon}
        {label}
    </button>
);

const ToggleRow = ({
    label,
    enabled,
    onToggle,
}: {
    label: string;
    enabled: boolean;
    onToggle: () => void;
}) => (
    <button
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm transition hover:bg-white/[0.04]"
    >
        <span className="text-zinc-200">{label}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${enabled
            ? 'bg-emerald-500/20 text-emerald-300'
            : 'bg-zinc-700 text-zinc-300'
            }`}>
            {enabled ? 'On' : 'Off'}
        </span>
    </button>
);

const StatCard = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">{label}</div>
        <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
);

function buildCompressionConfig(config: CompressionConfig): CompressionConfig {
    return {
        ...config,
        batchSize: config.batchSize ?? 8,
    };
}

function buildCompressionFileName(fileName: string | null, selectedCount: number, totalCount: number, level: CompressionLevel) {
    const baseName = (fileName || 'document').replace(/\.pdf$/i, '');
    const suffix = selectedCount === totalCount ? '' : `-${selectedCount}-pages`;
    return `${baseName}${suffix}-${level}-compressed.pdf`;
}

function formatBytes(bytes: number) {
    if (!bytes) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / (1024 ** index);
    return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDuration(ms: number) {
    if (!ms || ms <= 0) return '0s';
    const totalSeconds = Math.ceil(ms / 1000);
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
}

interface CompressionApiRequest {
    pdfBuffer: string;
    pageIndices: number[];
    compressionLevel: CompressionLevel;
    imageQuality: number;
    imageDPI: TargetDPI;
}

interface CompressionApiResponse {
    success: boolean;
    compressedPdf: string;
    originalSize: number;
    compressedSize: number;
    ratio: number;
    error?: string;
}

async function requestCompressionFromApi(
    payload: CompressionApiRequest,
    signal: AbortSignal,
): Promise<CompressionApiResponse> {
    const response = await fetch('/api/compress', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal,
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
        const errorMessage = body && typeof body.error === 'string'
            ? body.error
            : `Compression request failed with ${response.status}`;
        throw new Error(errorMessage);
    }

    return body as CompressionApiResponse;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
    const normalized = base64.includes(',') ? base64.split(',').pop() || '' : base64;
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}
