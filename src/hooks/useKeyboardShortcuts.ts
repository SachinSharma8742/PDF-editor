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
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedObjectIds.length > 0) {
                    e.preventDefault();
                    deleteObjects(selectedObjectIds);
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                copySelection();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                pasteClipboard();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                redo();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                if (selectedObjectIds.length > 0) {
                    clearSelection();
                } else {
                    // Optional: cancel() to exit editor? Or just switch to select tool?
                    // Let's just deselect for now to avoid accidental exists.
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isActive, selectedObjectIds, deleteObjects, copySelection, pasteClipboard, undo, redo, clearSelection]);
};
