import { Toolbar } from './components/layout/Toolbar';
import { Sidebar } from './components/layout/Sidebar';
import { PDFViewer } from './components/features/pdf-viewer/PDFViewer';
import './utils/pdfWorker'; // Import worker config
import { EditorMode } from './components/features/editor/EditorMode';
import { ContextMenu } from './components/features/editor/ContextMenu';
import { useEditorStore } from './store/editorStore';

import { usePDFStore } from './store/pdfStore';

export default function App() {
  const { theme } = usePDFStore();
  const { isActive } = useEditorStore();

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Background Layer for Dark Mode depth */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-0 dark:opacity-100 transition-opacity duration-700 bg-[radial-gradient(circle_at_50%_-20%,#3b82f615,transparent_50%)]" />

      <div className="flex flex-1 overflow-hidden relative bg-gray-50 dark:bg-[#09090b] text-gray-900 dark:text-zinc-100 transition-colors duration-500 z-10">
        <SidebarHelpWrapper />

        <div className="flex-1 flex flex-col relative w-full h-full bg-gray-100 dark:bg-transparent overflow-hidden transition-colors duration-500">
          {/* Surface texture in dark mode */}
          <div className="absolute inset-0 dark:bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none mix-blend-overlay" />

          {/* Toolbar Container - Absolute Top */}
          <div className="absolute top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
            <div className="pointer-events-auto">
              <Toolbar />
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 w-full h-full overflow-auto pt-20 px-4 md:px-10 pb-10 custom-scrollbar relative z-20" id="main-scroll-container">
            <div className="min-h-full rounded-3xl border border-gray-200/50 dark:border-white/5 shadow-2xl shadow-black/5 dark:shadow-none bg-white/40 dark:bg-zinc-900/30 backdrop-blur-sm relative flex flex-col transition-all duration-500">
              <PDFViewer />
            </div>
          </div>
        </div>
      </div>
      {isActive && <EditorMode />}
      <ContextMenu />
    </div>
  );
}

// Small helper to handle sidebar layout better
function SidebarHelpWrapper() {
  return (
    <div className="flex-shrink-0 h-full relative z-30">
      <Sidebar />
    </div>
  );
}

