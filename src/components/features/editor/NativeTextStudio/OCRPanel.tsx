import React, { useCallback } from 'react';
import { useEditorStore } from '../../../../store/editorStore';
import { ScanLine, Copy, Trash2, X, Loader2, Check } from 'lucide-react';
import clsx from 'clsx';
import type { SinglePageCanvasHandle } from './SinglePageCanvas';

interface OCRPanelProps {
    canvasRef?: React.RefObject<SinglePageCanvasHandle | null>;
}

export const OCRPanel: React.FC<OCRPanelProps> = ({ canvasRef }) => {
    const {
        ocrState,
        startOCR,
        clearOCRResult,
        setOCROpen
    } = useEditorStore();

    const { isOpen, isProcessing, progress, result, error, confidence } = ocrState;
    const [copied, setCopied] = React.useState(false);
    const [language, setLanguage] = React.useState('auto');

    const languages = [
        { code: 'auto', name: 'Auto Detect' },
        { code: 'eng', name: 'English' },
        { code: 'spa', name: 'Spanish' },
        { code: 'fra', name: 'French' },
        { code: 'deu', name: 'German' },
        { code: 'ita', name: 'Italian' },
        { code: 'por', name: 'Portuguese' },
        { code: 'chi_sim', name: 'Chinese (Simplified)' },
        { code: 'jpn', name: 'Japanese' },
        { code: 'kor', name: 'Korean' },
        { code: 'rus', name: 'Russian' },
        { code: 'hin', name: 'Hindi' },
        { code: 'ara', name: 'Arabic' },
    ];

    const handleScan = useCallback(async () => {
        const canvas = canvasRef?.current?.getCanvas();
        if (!canvas) {
            console.error('No canvas reference available');
            return;
        }
        // Convert canvas to data URL for Tesseract
        const dataUrl = canvas.toDataURL('image/png');

        // If auto, we include all major supported languages
        // Note: Tesseract performance may degrade with too many languages, but this fulfills "all languages" request
        const langToUse = language === 'auto'
            ? 'eng+hin+spa+fra+deu+ita+por+rus' // Common subset to avoid excessive download
            : language;

        await startOCR(dataUrl, langToUse);
    }, [canvasRef, startOCR, language]);

    const handleCopy = useCallback(() => {
        if (result) {
            navigator.clipboard.writeText(result);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [result]);

    if (!isOpen) return null;

    return (
        <div className="bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-white/10 p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <ScanLine size={12} className="text-emerald-400" />
                    OCR Scanner
                </h3>
                <button
                    onClick={() => setOCROpen(false)}
                    className="p-1 text-zinc-400 hover:text-white rounded hover:bg-white/10 transition-colors"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Language Selector */}
            <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">Source Language</label>
                <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-zinc-800 border border-white/10 rounded-lg p-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/50 transition-colors"
                    disabled={isProcessing}
                >
                    {languages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                            {lang.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Confidence Warning */}
            {result && confidence !== null && confidence < 65 && language === 'auto' && (
                <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
                    <div className="text-yellow-500 mt-0.5">⚠️</div>
                    <div className="space-y-1">
                        <p className="text-[10px] text-yellow-200 font-medium">Low Confidence ({Math.round(confidence)}%)</p>
                        <p className="text-[10px] text-yellow-100/70">
                            Auto-detection might have failed. Please select the specific language and try scanning again.
                        </p>
                    </div>
                </div>
            )}

            {/* Scan Button */}
            <button
                onClick={handleScan}
                disabled={isProcessing}
                className={clsx(
                    "w-full py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                    isProcessing
                        ? "bg-zinc-700 text-zinc-400 cursor-wait"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white"
                )}
            >
                {isProcessing ? (
                    <>
                        <Loader2 size={16} className="animate-spin" />
                        Scanning... {progress}%
                    </>
                ) : (
                    <>
                        <ScanLine size={16} />
                        Scan Page for Text
                    </>
                )}
            </button>

            {/* Progress Bar */}
            {isProcessing && (
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-xs">
                    {error}
                </div>
            )}

            {/* Results */}
            {result && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Recognized Text</span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleCopy}
                                className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-white/10 transition-colors flex items-center gap-1"
                                title="Copy to clipboard"
                            >
                                {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            </button>
                            <button
                                onClick={clearOCRResult}
                                className="p-1.5 text-zinc-400 hover:text-red-400 rounded hover:bg-white/10 transition-colors"
                                title="Clear result"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto p-3 bg-zinc-800 rounded-lg border border-white/5">
                        <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
                            {result || 'No text found'}
                        </p>
                    </div>
                    <p className="text-[10px] text-zinc-500 text-center">
                        {result.split(/\s+/).filter(Boolean).length} words detected
                    </p>
                </div>
            )}

            {/* Translation Section */}
            {result && (
                <div className="border-t border-white/5 pt-3 mt-3">
                    <TranslationSection textToTranslate={result} />
                </div>
            )}

            {/* Help text */}
            {!result && !isProcessing && (
                <p className="text-[10px] text-zinc-500 text-center">
                    Click "Scan Page" to recognize text from images or scanned content
                </p>
            )}
        </div>
    );
};

// Sub-component for Translation
const TranslationSection: React.FC<{ textToTranslate: string }> = ({ textToTranslate }) => {
    const {
        translationState,
        setTranslationLanguage,
        translateOCRText,
        clearTranslation
    } = useEditorStore();

    // Cleanup on unmount
    React.useEffect(() => {
        return () => {
            clearTranslation();
        };
    }, [clearTranslation]);

    const [copiedTrans, setCopiedTrans] = React.useState(false);

    const LANGUAGES = [
        { code: 'es', name: 'Spanish' },
        { code: 'fr', name: 'French' },
        { code: 'de', name: 'German' },
        { code: 'it', name: 'Italian' },
        { code: 'pt', name: 'Portuguese' },
        { code: 'zh-CN', name: 'Chinese (Simplified)' },
        { code: 'ja', name: 'Japanese' },
        { code: 'ko', name: 'Korean' },
        { code: 'ru', name: 'Russian' },
        { code: 'hi', name: 'Hindi' },
        { code: 'ar', name: 'Arabic' },
    ];

    const handleTranslate = () => {
        translateOCRText(textToTranslate, translationState.targetLanguage);
    };

    const copyTranslation = () => {
        if (!translationState.translatedText) return;
        navigator.clipboard.writeText(translationState.translatedText);
        setCopiedTrans(true);
        setTimeout(() => setCopiedTrans(false), 2000);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <ScanLine size={12} className="text-purple-500" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-400">Translation</h3>
            </div>

            <div className="flex gap-2">
                <select
                    className="flex-1 bg-zinc-800 text-xs text-white border border-zinc-700 rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    value={translationState.targetLanguage}
                    onChange={(e) => setTranslationLanguage(e.target.value)}
                >
                    {LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                </select>
                <button
                    onClick={handleTranslate}
                    disabled={translationState.isTranslating}
                    className={clsx(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2",
                        translationState.isTranslating
                            ? "bg-zinc-700 text-zinc-400 cursor-wait"
                            : "bg-purple-600 hover:bg-purple-500 text-white"
                    )}
                >
                    {translationState.isTranslating ? <Loader2 className="animate-spin" size={14} /> : 'Translate'}
                </button>
            </div>

            {translationState.error && (
                <div className="text-red-400 text-[10px] bg-red-400/10 p-2 rounded border border-red-400/20">
                    {translationState.error}
                </div>
            )}

            {translationState.translatedText && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-zinc-500">Translated Result:</span>
                        <button
                            onClick={copyTranslation}
                            className="p-1 hover:bg-white/5 rounded text-zinc-400 hover:text-white transition-colors"
                            title="Copy translation"
                        >
                            {copiedTrans ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                        </button>
                    </div>
                    <div className="bg-purple-900/10 border border-purple-500/20 rounded-xl p-3 max-h-48 overflow-y-auto custom-scrollbar text-xs text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap select-text">
                        {translationState.translatedText}
                    </div>
                </div>
            )}
        </div>
    );
};
