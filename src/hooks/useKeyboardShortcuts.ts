import { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';

export const useKeyboardShortcuts = () => {
    const {
        isActive,
        selectedObjectIds,
        deleteObjects,
        copySelection,
        pasteClipboard,
        undo,
        redo,
        cancel,
        clearSelection
    } = useEditorStore();

    useEffect(() => {
        if (!isActive) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if active element is an input or textarea
            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
                return;
            }

            // Shortcuts
            const key = e.key.toLowerCase();
            const isMeta = e.ctrlKey || e.metaKey;

            // Shortcuts
            if (key === 'delete' || key === 'backspace') {
                if (selectedObjectIds.length > 0) {
                    e.preventDefault();
                    deleteObjects(selectedObjectIds);
                }
            } else if (isMeta && key === 'c') {
                e.preventDefault();
                copySelection();
            } else if (isMeta && key === 'v') {
                e.preventDefault();
                pasteClipboard();
            } else if (isMeta && key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
            } else if (isMeta && key === 'y') {
                e.preventDefault();
                redo();
            } else if (key === 'escape') {
                e.preventDefault();
                if (selectedObjectIds.length > 0) {
                    clearSelection();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isActive, selectedObjectIds, deleteObjects, copySelection, pasteClipboard, undo, redo, clearSelection]);
};
