import React, { useState } from 'react';

interface TooltipProps {
    content: string;
    children: React.ReactNode;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'bottom' }) => {
    const [isVisible, setIsVisible] = useState(false);

    const positionClasses = {
        top: 'bottom-full mb-2',
        bottom: 'top-full mt-2',
        left: 'right-full mr-2',
        right: 'left-full ml-2'
    };

    return (
        <div
            className="relative flex items-center justify-center"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {isVisible && (
                <div className={`absolute ${positionClasses[position]} z-[100] whitespace-nowrap px-3 py-1.5 bg-gray-900 text-gray-100 text-xs font-medium rounded-lg shadow-xl shadow-black/20 border border-white/10 animate-in fade-in zoom-in-95 duration-200`}>
                    {content}
                    {/* Arrow */}
                    <div className={`absolute w-2 h-2 bg-gray-900 border-white/10 transform rotate-45 
                        ${position === 'top' ? 'bottom-[-4px] left-1/2 -translate-x-1/2' : ''}
                        ${position === 'bottom' ? 'top-[-4px] left-1/2 -translate-x-1/2' : ''}
                        ${position === 'left' ? 'right-[-4px] top-1/2 -translate-y-1/2' : ''}
                        ${position === 'right' ? 'left-[-4px] top-1/2 -translate-y-1/2' : ''}
                    `} />
                </div>
            )}
        </div>
    );
};
