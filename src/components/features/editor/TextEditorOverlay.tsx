import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore } from '../../../store/editorStore';
import type { PDFObject } from '../../../store/pdfStore';

interface TextEditorOverlayProps {
    object: PDFObject;
    onBlur: (text: string) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    stageX?: number;
    stageY?: number;
}

export const TextEditorOverlay: React.FC<TextEditorOverlayProps> = ({ object, onBlur, onKeyDown, stageX = 0, stageY = 0 }) => {
    const { scale } = useEditorStore();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [val, setVal] = useState(object.text || '');

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
            // Set cursor to end
            textareaRef.current.setSelectionRange(val.length, val.length);
        }
    }, []);

    const parentContainer = document.getElementById('editor-workspace');
    if (!parentContainer) {
        console.error("TextEditorOverlay: 'editor-workspace' container not found!");
        return null;
    }

    // Calculate absolute position on the screen/container
    // Apply Stage Offset (Pan) + Object Position (Scaled)
    const top = (object.y * scale) + stageY;
    const left = (object.x * scale) + stageX;
    const width = (object.width || 200) * scale;
    const height = (object.height || 100) * scale;
    const fontSize = (object.fontSize || 16) * scale;

    const style: React.CSSProperties = {
        position: 'absolute',
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        height: `${height}px`,
        fontSize: `${fontSize}px`,
        fontFamily: object.fontFamily || 'Inter',
        fontWeight: object.fontWeight as any,
        fontStyle: object.fontStyle as any,
        color: object.fill || 'black',
        textAlign: object.align || 'left',
        background: 'rgba(59, 130, 246, 0.05)', // Subtle blue background to indicate edit area
        border: '1px solid rgba(59, 130, 246, 0.5)', // Visible border
        outline: 'none',
        resize: 'none',
        overflow: 'hidden',
        padding: '0',
        margin: '-1px 0 0 -1px', // Slight offset to align perfectly with underlying text
        lineHeight: object.lineHeight || 1.2,
        letterSpacing: object.letterSpacing ? `${object.letterSpacing * scale}px` : 'normal',
        zIndex: 9999, // FORCE ON TOP
        transform: `rotate(${object.rotation || 0}deg)`,
        transformOrigin: '0 0',
        whiteSpace: 'pre-wrap'
    };

    return createPortal(
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 9999
        }}>
            <textarea
                ref={textareaRef}
                style={{ ...style, pointerEvents: 'auto' }}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onBlur={() => onBlur(val)}
                onKeyDown={onKeyDown}
                autoFocus
            />
            {/* Last Used Styles - Positioned below the textarea */}
            <div style={{
                position: 'absolute',
                top: `${top + height + 10}px`, // Below the text box
                left: `${left}px`,
                // constrain width if needed, or let it flow based on content
                width: 'max-content',
                maxWidth: '300px',
                pointerEvents: 'auto'
            }}>
                <RecentStylesPanel objectId={object.id} />
            </div>
        </div>,
        parentContainer
    );
};

// Extracted for clean component structure
const RecentStylesPanel: React.FC<{ objectId: string }> = ({ objectId }) => {
    const { recentTextStyles, updateObject } = useEditorStore();
    // Start open? Or manage internal state? The snippet implies it's just rendered.

    if (recentTextStyles.length === 0) return null;

    return (
        <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-xl p-2 shadow-2xl">
            <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 pt-1 px-1 max-w-[300px]">
                {recentTextStyles.map((style, i) => (
                    <button
                        key={i}
                        onClick={(e) => {
                            e.preventDefault(); // Prevent blur
                            e.stopPropagation();
                            updateObject(objectId, {
                                fontSize: style.fontSize,
                                fontFamily: style.fontFamily,
                                fontWeight: style.fontWeight,
                                fontStyle: style.fontStyle,
                                fill: style.color,
                                opacity: style.opacity
                            });
                        }}
                        className="group relative flex-shrink-0 w-12 h-12 flex flex-col items-center justify-center rounded-lg bg-zinc-900/50 border border-white/10 hover:bg-white/[0.06] hover:border-blue-500/50 hover:scale-105 transition-all shadow-sm"
                        title={`${style.fontFamily}, ${style.fontSize}px`}
                    >
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:4px_4px] rounded-lg pointer-events-none" />
                        <span style={{
                            fontFamily: style.fontFamily,
                            fontWeight: style.fontWeight as any,
                            fontStyle: style.fontStyle as any,
                            fontSize: Math.min(Math.max(style.fontSize * 0.5, 10), 20),
                            color: style.color
                        }} className="leading-none z-10">
                            Ag
                        </span>
                        {/* Tiny badge for size */}
                        <div className="absolute -bottom-1 -right-1 scale-75 origin-bottom-right bg-black/80 backdrop-blur-md text-[8px] text-white/90 px-1 rounded font-mono border border-white/10 opacity-60 group-hover:opacity-100 transition-opacity">
                            {style.fontSize}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};
