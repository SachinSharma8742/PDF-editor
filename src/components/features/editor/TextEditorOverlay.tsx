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
        </div>,
        parentContainer
    );
};
