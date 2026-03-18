import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Download, LoaderCircle, ShieldCheck, X } from 'lucide-react';
import { Button } from '../../ui/Button';
import { usePDFStore } from '../../../store/pdfStore';
import { buildDocumentPdfBytes, downloadFile } from '../../../utils/exportUtils';
import {
    compressPdfWithPdfCo,
    type PdfCoCompressionPreset,
    type PdfCoCompressionResult,
} from '../../../services/pdfCoCompressionService';

interface CompressionOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    selectedPageIndices: number[];
}

const PRESET_OPTIONS: Array<{
    id: PdfCoCompressionPreset;
    label: string;
    description: string;
}> = [
    {
        id: 'high_quality',
        label: 'High Quality',
        description: 'Lighter compression, better fidelity',
    },
    {
        id: 'balanced',
        label: 'Balanced',
        description: 'Recommended default',
    },
    {
        id: 'max_compression',
        label: 'Max Compression',
        description: 'Smallest file size',
    },
];

export const CompressionOverlay: React.FC<CompressionOverlayProps> = ({
    isOpen,
    onClose,
    selectedPageIndices,
}) => {
    const { pages, originalPdfBytes, fileName } = usePDFStore();
    const [preset, setPreset] = useState<PdfCoCompressionPreset>('balanced');
    const [isCompressing, setIsCompressing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('Ready');
    const [result, setResult] = useState<PdfCoCompressionResult | null>(null);

    const selectedPages = useMemo(() => (
        selectedPageIndices.length > 0
            ? selectedPageIndices.map((index) => pages[index]).filter(Boolean)
            : pages
    ), [pages, selectedPageIndices]);

    if (!isOpen) {
        return null;
    }

    const handleCompress = async () => {
        if (selectedPages.length === 0) {
            setResult({
                success: false,
                provider: 'pdfco',
                inputSizeBytes: 0,
                outputSizeBytes: 0,
                bytesSaved: 0,
                percentReduced: 0,
                outputFileName: buildCompressionFileName(fileName, selectedPages.length, pages.length),
                error: 'There are no pages available to compress.',
            });
            return;
        }

        setIsCompressing(true);
        setProgress(15);
        setStatus('Preparing PDF export...');
        setResult(null);

        try {
            const pdfBytes = await buildDocumentPdfBytes(selectedPages, originalPdfBytes);
            if (!pdfBytes) {
                setResult({
                    success: false,
                    provider: 'pdfco',
                    inputSizeBytes: 0,
                    outputSizeBytes: 0,
                    bytesSaved: 0,
                    percentReduced: 0,
                    outputFileName: buildCompressionFileName(fileName, selectedPages.length, pages.length),
                    error: 'Failed to build the PDF before compression.',
                });
                setProgress(0);
                return;
            }

            const inputFile = new File(
                [pdfBytes as BlobPart],
                buildCompressionFileName(fileName, selectedPages.length, pages.length),
                { type: 'application/pdf' }
            );

            setProgress(55);
            setStatus('Uploading to PDF.co and compressing...');

            const compressionResult = await compressPdfWithPdfCo(inputFile, preset);
            setResult(compressionResult);

            if (compressionResult.success && compressionResult.blob) {
                setProgress(100);
                setStatus('Compression complete');
                downloadFile(compressionResult.blob, compressionResult.outputFileName);
            } else {
                setProgress(0);
                setStatus('Compression failed');
            }
        } catch (error) {
            setProgress(0);
            setStatus('Compression failed');
            setResult({
                success: false,
                provider: 'pdfco',
                inputSizeBytes: 0,
                outputSizeBytes: 0,
                bytesSaved: 0,
                percentReduced: 0,
                outputFileName: buildCompressionFileName(fileName, selectedPages.length, pages.length),
                error: error instanceof Error ? error.message : 'Compression failed.',
            });
        } finally {
            setIsCompressing(false);
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
            <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#101114]/95 text-zinc-100 shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
                <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-6 py-4">
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-300">PDF Compression</div>
                        <div className="mt-1 text-sm text-zinc-400">
                            {selectedPages.length === pages.length ? 'All pages' : `${selectedPages.length} selected pages`} via PDF.co
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

                <div className="grid gap-0 md:grid-cols-[1.2fr_0.8fr]">
                    <div className="space-y-6 p-6">
                        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                            <div className="mb-4 text-sm font-semibold text-white">Choose Preset</div>
                            <div className="grid gap-3">
                                {PRESET_OPTIONS.map((option) => (
                                    <button
                                        key={option.id}
                                        onClick={() => setPreset(option.id)}
                                        className={`rounded-2xl border px-4 py-4 text-left transition ${preset === option.id
                                            ? 'border-blue-400 bg-blue-500/10 text-white'
                                            : 'border-white/10 bg-black/20 text-zinc-300 hover:border-white/20 hover:bg-white/[0.04]'
                                            }`}
                                    >
                                        <div className="text-sm font-semibold">{option.label}</div>
                                        <div className="mt-1 text-xs text-zinc-500">{option.description}</div>
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                            <div className="mb-3 flex items-center gap-3">
                                <div className="rounded-2xl bg-blue-500/10 p-2 text-blue-300">
                                    {isCompressing ? <LoaderCircle size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-white">Status</div>
                                    <div className="text-xs text-zinc-400">{status}</div>
                                </div>
                            </div>

                            <div className="h-3 overflow-hidden rounded-full bg-black/30">
                                <div
                                    className={`h-full rounded-full bg-gradient-to-r from-blue-400 to-cyan-300 transition-all duration-300 ${isCompressing && progress < 100 ? 'animate-pulse' : ''}`}
                                    style={{ width: `${Math.max(progress, result ? 100 : 8)}%` }}
                                />
                            </div>

                            <div className="mt-3 text-xs text-zinc-500">
                                Provider: PDF.co only. No local compression engine is used.
                            </div>
                        </section>

                        {result && (
                            <section className={`rounded-3xl border p-5 ${result.success
                                ? 'border-emerald-400/20 bg-emerald-500/10'
                                : 'border-red-400/20 bg-red-500/10'
                                }`}>
                                <div className="mb-4 flex items-center gap-3">
                                    <div className={`rounded-2xl p-2 ${result.success ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
                                        <CheckCircle2 size={18} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold">{result.success ? 'Compression Complete' : 'Compression Error'}</div>
                                        <div className="text-xs text-zinc-400">
                                            {result.success ? 'Your compressed PDF was downloaded.' : result.error}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <StatCard label="Input Size" value={formatBytes(result.inputSizeBytes)} />
                                    <StatCard label="Output Size" value={formatBytes(result.outputSizeBytes)} />
                                    <StatCard label="Saved" value={formatBytes(result.bytesSaved)} />
                                    <StatCard label="Reduction" value={`${result.percentReduced.toFixed(1)}%`} />
                                </div>
                            </section>
                        )}
                    </div>

                    <aside className="border-t border-white/10 bg-black/20 p-6 md:border-l md:border-t-0">
                        <div className="space-y-5">
                            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Input</div>
                                <div className="mt-2 text-lg font-semibold text-white">{selectedPages.length} pages</div>
                                <div className="mt-2 text-sm text-zinc-400">
                                    The current export snapshot is sent to PDF.co, compressed there, and the result is downloaded back into the app.
                                </div>
                            </div>

                            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-400">
                                <div className="mb-2 font-semibold text-white">Preset guidance</div>
                                <p>`High Quality` keeps more fidelity.</p>
                                <p>`Balanced` is the default for most documents.</p>
                                <p>`Max Compression` aims for the smallest output file.</p>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    variant="ghost"
                                    onClick={onClose}
                                    disabled={isCompressing}
                                    className="flex-1 border border-white/10 text-zinc-300 hover:bg-white/5"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleCompress}
                                    disabled={isCompressing || selectedPages.length === 0}
                                    className="flex-1 justify-center bg-blue-600 hover:bg-blue-500"
                                >
                                    <Download size={16} />
                                    {isCompressing ? 'Compressing...' : 'Compress'}
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

const StatCard = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">{label}</div>
        <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
);

function buildCompressionFileName(fileName: string | null, selectedCount: number, totalCount: number) {
    const baseName = (fileName || 'document').replace(/\.pdf$/i, '');
    const suffix = selectedCount === totalCount ? '' : `-${selectedCount}-pages`;
    return `${baseName}${suffix}.pdf`;
}

function formatBytes(bytes: number) {
    if (!bytes) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / (1024 ** index);
    return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}
