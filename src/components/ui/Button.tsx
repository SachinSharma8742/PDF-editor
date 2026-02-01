import React from 'react';
import clsx from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    className,
    variant = 'primary',
    size = 'md',
    isLoading,
    disabled,
    ...props
}) => {
    const variants = {
        primary: 'bg-blue-600 text-white hover:bg-blue-500 border-b-4 border-blue-800 active:border-b-0 active:translate-y-[2px]',
        secondary: 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border-b-4 border-zinc-950 active:border-b-0 active:translate-y-[2px]',
        danger: 'bg-red-600 text-white hover:bg-red-500 border-b-4 border-red-800 active:border-b-0 active:translate-y-[2px]',
        ghost: 'bg-transparent text-zinc-400 hover:bg-white/5 border-none',
        outline: 'bg-transparent text-zinc-200 border border-white/10 hover:bg-white/5 active:bg-white/10'
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2.5 text-sm',
        lg: 'px-6 py-4 text-base'
    };

    return (
        <button
            className={clsx(
                'inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all disabled:opacity-50 disabled:pointer-events-none',
                variants[variant],
                sizes[size],
                className
            )}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && (
                <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            )}
            {children}
        </button>
    );
};
