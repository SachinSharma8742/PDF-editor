import { Toolbar } from './components/layout/Toolbar';
import { Sidebar } from './components/layout/Sidebar';
import { PDFViewer } from './components/features/pdf-viewer/PDFViewer';
import './utils/pdfWorker'; // Import worker config
import { EditorMode } from './components/features/editor/EditorMode';

import { usePDFStore } from './store/pdfStore';

export default function App() {
  const { theme } = usePDFStore();

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="flex flex-1 overflow-hidden relative bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-gray-200 transition-colors duration-200">
        <Sidebar />
        <div className="flex-1 flex flex-col relative w-full h-full bg-gray-100 dark:bg-zinc-900/50 overflow-hidden transition-colors duration-200">
          {/* Toolbar Container - Absolute Top */}
          <div className="absolute top-0 left-0 right-0 z-50 flex justify-center pt-8 pointer-events-none">
            <div className="pointer-events-auto">
              <Toolbar />
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 w-full h-full overflow-auto pt-24 px-10 pb-10 custom-scrollbar" id="main-scroll-container">
            <div className="min-h-full rounded-2xl border border-gray-200/50 dark:border-zinc-800 shadow-inner bg-gray-50/50 dark:bg-zinc-900/50 relative flex flex-col transition-colors duration-200">
              <PDFViewer />
            </div>
          </div>
        </div>
      </div>
      <EditorMode />
    </div>
  );
}

