import React, { useCallback } from 'react';
import { useEditorStore } from '../../../../store/editorStore';
import { Languages, Loader2, Check, Undo2 } from 'lucide-react';
import clsx from 'clsx';

interface TranslationPanelProps {
    textItems: Record<string, unknown>[];
}

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
    { code: 'en', name: 'English' },
];

export const TranslationPanel: React.FC<TranslationPanelProps> = ({ textItems }) => {
    const {
        translationState,
        setTranslationLanguage,
        translatePage,
        undoPageTranslation,
    } = useEditorStore();

    const handleTranslatePage = useCallback(() => {
        translatePage(
            textItems as unknown as Parameters<typeof translatePage>[0],
            translationState.targetLanguage
        );
    }, [textItems, translationState.targetLanguage, translatePage]);

    const hasPageTranslation = translationState.pageTranslationEditIds.length > 0;
    const isTranslating = translationState.isTranslatingPage;

    return (
        <div className="bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-white/10 p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
            {/* Header */}
            <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-purple-500/20 rounded-lg">
                    <Languages size={14} className="text-purple-400" />
                </div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Translation</h3>
            </div>

            {/* Language Selector */}
            <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
                    Target Language
                </label>
                <select
                    className="w-full bg-zinc-800/80 text-xs text-white border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-purple-500/50 transition-colors appearance-none cursor-pointer"
                    value={translationState.targetLanguage}
                    onChange={(e) => setTranslationLanguage(e.target.value)}
                    disabled={isTranslating}
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 0.5rem center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '1.5em 1.5em',
                        paddingRight: '2.5rem'
                    }}
                >
                    {LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                </select>
            </div>

            {/* Translate Page Button */}
            <button
                onClick={handleTranslatePage}
                disabled={isTranslating || textItems.length === 0}
                className={clsx(
                    "w-full py-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2",
                    isTranslating
                        ? "bg-zinc-700 text-zinc-400 cursor-wait"
                        : textItems.length > 0
                            ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/30"
                            : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                )}
            >
                {isTranslating ? (
                    <>
                        <Loader2 size={14} className="animate-spin" />
                        Translating...
                    </>
                ) : (
                    <>
                        <Languages size={14} />
                        Translate Page
                    </>
                )}
            </button>

            {/* Progress */}
            {isTranslating && translationState.translatingPageProgress && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2.5 bg-purple-500/10 border border-purple-500/15 rounded-lg">
                        <Loader2 size={12} className="animate-spin text-purple-400 shrink-0" />
                        <span className="text-[10px] text-purple-200">{translationState.translatingPageProgress}</span>
                    </div>
                    <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                    </div>
                </div>
            )}

            {/* Error */}
            {translationState.error && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[10px]">
                    {translationState.error}
                </div>
            )}

            {/* Success + Undo */}
            {hasPageTranslation && !isTranslating && (
                <div className="space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <Check size={12} className="text-emerald-400 shrink-0" />
                        <span className="text-[10px] text-emerald-200 font-medium">
                            {translationState.pageTranslationEditIds.length} text blocks translated
                        </span>
                    </div>
                    <button
                        onClick={undoPageTranslation}
                        className="w-full py-2.5 rounded-lg text-xs font-medium bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all flex items-center justify-center gap-2 border border-white/5 hover:border-white/10"
                    >
                        <Undo2 size={12} />
                        Undo Translation
                    </button>
                </div>
            )}

            {textItems.length === 0 && (
                <p className="text-[10px] text-zinc-600 text-center italic py-1">
                    No text found on this page
                </p>
            )}
        </div>
    );
};
