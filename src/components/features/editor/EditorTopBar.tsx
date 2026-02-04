import { useEditorStore } from '../../../store/editorStore';
import { usePDFStore } from '../../../store/pdfStore';
import { Undo, Redo, ZoomIn, ZoomOut, Check, X, Moon, Sun } from 'lucide-react';

export const EditorTopBar: React.FC = () => {
    const {
        commit,
        cancel,
        undo,
        redo,
        scale,
        setScale,
        history,
    } = useEditorStore();

    const { theme, toggleTheme } = usePDFStore();

    const canUndo = history.past.length > 0;
    const canRedo = history.future.length > 0;

    return (
        <div className="h-14 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-4 flex items-center justify-between shadow-sm z-30 transition-colors duration-200">
            <div className="flex items-center gap-4">
                <button
                    onClick={cancel}
                    className="flex items-center gap-2 px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                >
                    <X size={18} />
                    <span className="font-medium text-sm">Cancel</span>
                </button>

                <div className="h-6 w-px bg-gray-200 dark:bg-zinc-800" />

                <button
                    onClick={undo}
                    disabled={!canUndo}
                    className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400 ${!canUndo ? 'opacity-30 cursor-not-allowed' : ''}`}
                    title="Undo"
                >
                    <Undo size={18} />
                </button>
                <button
                    onClick={redo}
                    disabled={!canRedo}
                    className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400 ${!canRedo ? 'opacity-30 cursor-not-allowed' : ''}`}
                    title="Redo"
                >
                    <Redo size={18} />
                </button>
            </div>

            <div className="flex items-center gap-2 bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg border border-transparent dark:border-zinc-700">
                <button
                    onClick={() => setScale(Math.max(0.5, scale - 0.1))}
                    className="p-1 hover:bg-white dark:hover:bg-zinc-700 rounded transition-colors shadow-sm text-gray-600 dark:text-gray-400"
                >
                    <ZoomOut size={16} />
                </button>
                <span className="text-xs font-medium w-12 text-center text-gray-700 dark:text-gray-300">{Math.round(scale * 100)}%</span>
                <button
                    onClick={() => setScale(Math.min(3, scale + 0.1))}
                    className="p-1 hover:bg-white dark:hover:bg-zinc-700 rounded transition-colors shadow-sm text-gray-600 dark:text-gray-400"
                >
                    <ZoomIn size={16} />
                </button>
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400 transition-colors"
                    title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                <div className="h-6 w-px bg-gray-200 dark:bg-zinc-800" />

                <button
                    onClick={commit}
                    className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors shadow-sm font-medium"
                >
                    <Check size={18} />
                    <span className="font-medium text-sm">Done</span>
                </button>
            </div>
        </div>
    );
};
