import React, { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';

interface CollapsibleSectionProps {
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    storageKey?: string; // If provided, state persists in localStorage
    defaultOpen?: boolean;
    className?: string;
    action?: React.ReactNode; // Optional action button in header
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
    title,
    icon,
    children,
    storageKey,
    defaultOpen = true,
    className,
    action
}) => {
    // Initialize state from localStorage if key exists, otherwise use default
    const [isOpen, setIsOpen] = useState(() => {
        if (!storageKey) return defaultOpen;
        try {
            const saved = localStorage.getItem(`editor_section_${storageKey}`);
            return saved !== null ? JSON.parse(saved) : defaultOpen;
        } catch (e) {
            console.warn('Failed to read from localStorage', e);
            return defaultOpen;
        }
    });

    // Update localStorage when state changes
    useEffect(() => {
        if (!storageKey) return;
        try {
            localStorage.setItem(`editor_section_${storageKey}`, JSON.stringify(isOpen));
        } catch (e) {
            console.warn('Failed to save to localStorage', e);
        }
    }, [isOpen, storageKey]);

    return (
        <div className={clsx("border-b border-zinc-200 dark:border-white/5 pb-2 mb-2 last:border-0 last:mb-0 last:pb-0 transition-colors duration-300", className)}>
            <div
                className="flex items-center justify-between py-3 px-4 cursor-pointer group select-none hover:bg-zinc-100 dark:hover:bg-white/[0.02] transition-colors rounded-lg"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-3 text-[10px] font-black text-zinc-500 uppercase tracking-[0.15em] group-hover:text-zinc-800 dark:group-hover:text-zinc-300 transition-colors">
                    <div className={clsx("transition-transform duration-200 text-zinc-400 dark:text-zinc-600 group-hover:text-zinc-600 dark:group-hover:text-zinc-400", isOpen ? "rotate-90" : "")}>
                        <ChevronRight size={10} strokeWidth={4} />
                    </div>
                    {icon}
                    <span>{title}</span>
                </div>
                {/* Prevent click propagation for action buttons */}
                {action && (
                    <div onClick={(e) => e.stopPropagation()}>
                        {action}
                    </div>
                )}
            </div>

            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        <div className="pt-1 pb-4 px-4">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
