import { Toolbar } from './components/layout/Toolbar';
import { Sidebar } from './components/layout/Sidebar';
import { PDFViewer } from './components/features/pdf-viewer/PDFViewer';
import './utils/pdfWorker'; // Import worker config
import { EditorMode } from './components/features/editor/EditorMode';
import { ContextMenu } from './components/features/editor/ContextMenu';
import { NativeTextStudio } from './components/features/editor/NativeTextStudio/NativeTextStudio';
import { PrintModal } from './components/modals/PrintModal';
import { useEditorStore } from './store/editorStore';

import { usePDFStore } from './store/pdfStore';
import { useEffect, useState } from 'react';
import { loadPDFFromStorage } from './utils/storage';
import { loadPDF } from './utils/pdfOps';

export default function App() {
  const { theme, setIsLoading } = usePDFStore();
  const { isActive } = useEditorStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const restoreSession = async () => {
      // Small delay to ensure store hydration?
      // Actually zustand persist is synchronous from localStorage.
      const saved = await loadPDFFromStorage();
      if (saved && !usePDFStore.getState().pdfDocument) {
        try {
          setIsLoading(true);
          const doc = await loadPDF(saved.bytes.slice(0)); // clone buffer for safety
          usePDFStore.setState({
            pdfDocument: doc,
            originalPdfBytes: saved.bytes,
            fileName: saved.metadata.fileName
          });
        } catch (e) {
          console.error('Failed to restore PDF session:', e);
        } finally {
          setIsLoading(false);
        }
      }
    };
    restoreSession();
  }, [setIsLoading]);

  return (
    <div className={`flex flex-col h-screen h-[100dvh] w-screen overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Background Layer for Dark Mode depth */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-0 dark:opacity-100 transition-opacity duration-700 bg-[radial-gradient(circle_at_50%_-20%,#3b82f615,transparent_50%)]" />

      <div className="flex flex-1 overflow-hidden relative bg-gray-50 dark:bg-[#09090b] text-gray-900 dark:text-zinc-100 transition-colors duration-500 z-10">
        <SidebarHelpWrapper isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        <div className="flex-1 flex flex-col relative w-full h-full bg-gray-100 dark:bg-transparent overflow-hidden transition-colors duration-500">
          {/* Surface texture in dark mode */}
          <div className="absolute inset-0 dark:bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none mix-blend-overlay" />

          {/* Toolbar Container - Absolute Top */}
          <div className="absolute top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
            {/* Mobile Menu Button - Removed, integrated into Toolbar */}

            <div className="pointer-events-auto max-w-[95vw]">
              <Toolbar onMenuClick={() => setIsSidebarOpen(true)} />
            </div>
            {/* Multi-Select / Context Toolbar removed as it is reported useless in Home mode */}
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

      {/* Native Text Studio - Rendered at app level so it works without editor init */}
      <NativeTextStudio />
      <PrintModal />

      <ContextMenu />
    </div>
  );
}

// Small helper to handle sidebar layout better
function SidebarHelpWrapper({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <>
      {/* Mobile Overlay/Backdrop */}
      <div
        className={`
        md:hidden fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm transition-opacity duration-300
        ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
      `}
        onClick={onClose}
      />

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-[100] h-full
        transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar />
      </div>
    </>
  );
}

