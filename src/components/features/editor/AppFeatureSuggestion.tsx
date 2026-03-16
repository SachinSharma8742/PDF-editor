import React, { useState } from 'react';
import { X, ChevronRight, Lightbulb } from 'lucide-react';
import type { AppFeature } from '../../../utils/appFeatures';
import clsx from 'clsx';

interface AppFeatureSuggestionProps {
    features: AppFeature[];
}

export const AppFeatureSuggestion: React.FC<AppFeatureSuggestionProps> = ({ features }) => {
    const [index, setIndex] = useState(0);
    const [dismissed, setDismissed] = useState(false);

    if (dismissed || features.length === 0) return null;

    const feature = features[index];
    const hasMore = features.length > 1;

    return (
        <div className={clsx(
            "relative rounded-xl overflow-hidden",
            "animate-in slide-in-from-bottom-2 fade-in duration-500",
        )}>
            {/* Gradient top border */}
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-sky-500 via-violet-500 to-purple-500" />

            {/* Card body */}
            <div className="bg-gradient-to-br from-sky-950/60 to-violet-950/60 dark:from-sky-950/60 dark:to-violet-950/60 from-sky-50 to-violet-50 border border-sky-500/15 dark:border-sky-500/15 border-sky-200/60 px-3 pt-3 pb-2.5 rounded-xl">

                {/* Header row */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                        {/* Glow icon */}
                        <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-sky-500 to-violet-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
                            <Lightbulb size={10} className="text-white" />
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-sky-600 dark:text-sky-400">
                            App Tip
                        </span>
                        {hasMore && (
                            <span className="text-[8px] text-zinc-400 dark:text-zinc-600 ml-0.5">
                                {index + 1}/{features.length}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-1">
                        {/* Next tip button */}
                        {hasMore && (
                            <button
                                onClick={() => setIndex(i => (i + 1) % features.length)}
                                className="flex items-center gap-0.5 text-[8px] text-zinc-400 dark:text-zinc-500 hover:text-sky-500 dark:hover:text-sky-400 transition-colors px-1.5 py-0.5 rounded hover:bg-sky-500/10"
                            >
                                Next <ChevronRight size={8} />
                            </button>
                        )}
                        {/* Dismiss */}
                        <button
                            onClick={() => setDismissed(true)}
                            className="p-0.5 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
                            aria-label="Dismiss suggestion"
                        >
                            <X size={10} />
                        </button>
                    </div>
                </div>

                {/* Feature info */}
                <div className="flex items-start gap-2">
                    <span className="text-base leading-none mt-0.5 select-none">{feature.icon}</span>
                    <div className="min-w-0">
                        <div className="text-[11px] font-bold text-zinc-800 dark:text-white leading-tight">
                            {feature.name}
                        </div>
                        {/* Location path */}
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            {feature.location.split('→').map((part, i, arr) => (
                                <React.Fragment key={i}>
                                    <span className="text-[9px] text-zinc-500 dark:text-zinc-500 bg-zinc-100 dark:bg-white/5 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-white/5 font-medium">
                                        {part.trim()}
                                    </span>
                                    {i < arr.length - 1 && (
                                        <ChevronRight size={8} className="text-zinc-400 dark:text-zinc-600 shrink-0" />
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                        {/* Tip text */}
                        <p className="text-[10px] text-zinc-600 dark:text-zinc-400 mt-1.5 leading-relaxed">
                            {feature.tip}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
