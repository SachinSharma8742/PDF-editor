import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
    content: string;
    children: React.ReactNode;
    position?: 'top' | 'bottom' | 'left' | 'right';
    delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top', delay = 100 }) => {
    const [isVisible, setIsVisible] = useState(false);
    const triggerRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<any>(null);
    const [tooltipStyles, setTooltipStyles] = useState<React.CSSProperties>({});

    const updatePosition = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();

        const style: React.CSSProperties = {
            position: 'fixed',
            zIndex: 9999,
            pointerEvents: 'none',
        };

        const gap = 8;

        if (position === 'top') {
            style.top = rect.top - gap;
            style.left = rect.left + rect.width / 2;
            style.transform = 'translate(-50%, -100%)';
        } else if (position === 'bottom') {
            style.top = rect.bottom + gap;
            style.left = rect.left + rect.width / 2;
            style.transform = 'translate(-50%, 0)';
        } else if (position === 'left') {
            style.top = rect.top + rect.height / 2;
            style.left = rect.left - gap;
            style.transform = 'translate(-100%, -50%)';
        } else if (position === 'right') {
            style.top = rect.top + rect.height / 2;
            style.left = rect.right + gap;
            style.transform = 'translate(0, -50%)';
        }

        setTooltipStyles(style);
    };

    const handleMouseEnter = () => {
        updatePosition();
        timeoutRef.current = setTimeout(() => {
            setIsVisible(true);
            // Update again in case of layout shifts
            requestAnimationFrame(updatePosition);
        }, delay);
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsVisible(false);
    };

    useEffect(() => {
        if (isVisible) {
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition, true);
        }
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isVisible]);

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="contents"
            >
                {children}
            </div>
            {isVisible && createPortal(
                <div
                    style={tooltipStyles}
                    className="px-3 py-1.5 bg-[#09090b] text-zinc-100 text-[10px] font-black uppercase tracking-wider rounded-lg shadow-xl shadow-black/20 border border-white/10 whitespace-nowrap animate-in fade-in zoom-in-95 duration-150"
                >
                    {content}
                </div>,
                document.body
            )}
        </>
    );
};
