import React from 'react';
import { Palette } from 'lucide-react';
import clsx from 'clsx';

export const PropertyLabel = ({ label, icon }: { label: string, icon?: React.ReactNode }) => (
    <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-[0.15em]">
        {icon} <span>{label}</span>
    </div>
);

export const ToggleButton = ({ active, onClick }: { active: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={clsx(
            "relative inline-flex h-5 w-10 items-center rounded-full transition-all duration-300",
            active ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-800'
        )}
    >
        <div className={clsx("h-3 w-3 rounded-full bg-white transition-all shadow-sm", active ? 'translate-x-6' : 'translate-x-1')} />
    </button>
);

export const ColorGrid = ({ current, onSelect, recentColors }: { current: string, onSelect: (c: string) => void, recentColors: string[] }) => (
    <div className="grid grid-cols-6 gap-2">
        {recentColors.slice(0, 5).map((color, i) => (
            <button
                key={i}
                onClick={() => onSelect(color)}
                className={clsx(
                    "aspect-square rounded-full border border-zinc-200 dark:border-white/10 transition-transform active:scale-95 shadow-sm",
                    current === color && "ring-2 ring-blue-500 ring-offset-2 ring-offset-zinc-50 dark:ring-offset-[#121214]"
                )}
                style={{ backgroundColor: color }}
            />
        ))}
        <div className="relative aspect-square rounded-full bg-zinc-200 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 flex items-center justify-center overflow-hidden hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors">
            <input
                type="color"
                value={current}
                onChange={(e) => onSelect(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <Palette size={12} className="text-zinc-500 dark:text-zinc-400" />
        </div>
    </div>
);

export const Slider = ({ value, min, max, step = 1, onChange, isPercent = false }: { value: number, min: number, max: number, step?: number, onChange: (v: number) => void, isPercent?: boolean }) => (
    <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600 transition-colors"
    />
);

export const SimpleInput = ({ label, value, onChange, disabled, className, suffix, min, max }: { label: string, value: string | number, onChange: (v: number) => void, disabled?: boolean, className?: string, suffix?: string, min?: number, max?: number }) => (
    <div className={clsx("relative group", className)}>
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-zinc-500 dark:text-zinc-600 transition-colors group-hover:text-zinc-800 dark:group-hover:text-zinc-400">{label}</span>
        <input
            type="number"
            value={value}
            min={min}
            max={max}
            disabled={disabled}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full bg-zinc-200/50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 rounded-xl p-2.5 pl-8 text-xs font-mono text-zinc-900 dark:text-white outline-none focus:border-blue-500/50 focus:bg-white dark:focus:bg-transparent transition-all text-right"
        />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 dark:text-zinc-600">{suffix}</span>}
    </div>
);

export const ActionButton = ({ label, icon, onClick, variant, className }: { label: string, icon: React.ReactNode, onClick: () => void, variant?: 'danger', className?: string }) => (
    <button
        onClick={onClick}
        className={clsx(
            "flex items-center justify-center gap-2 p-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
            variant === 'danger'
                ? 'bg-red-500/10 text-red-600 dark:text-red-500 border border-red-500/20 hover:bg-red-500/20'
                : 'bg-zinc-200/50 dark:bg-white/[0.03] text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 hover:bg-white dark:hover:bg-white/[0.08] hover:border-zinc-300 dark:hover:border-white/20 hover:text-zinc-900 dark:hover:text-white shadow-sm dark:shadow-none',
            className
        )}
    >
        {icon} {label}
    </button>
);

export const IconButton = ({ icon, onClick, title, active }: { icon: React.ReactNode, onClick: () => void, title: string, active?: boolean }) => (
    <button
        onClick={onClick}
        title={title}
        className={clsx(
            "flex-1 flex items-center justify-center p-2 rounded-lg transition-all",
            active ? "bg-blue-600 text-white shadow-sm" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/5"
        )}
    >
        {icon}
    </button>
);
