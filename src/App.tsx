import { Toolbar } from './components/layout/Toolbar';
import { Sidebar } from './components/layout/Sidebar';
import { PDFViewer } from './components/features/pdf-viewer/PDFViewer';
import './utils/pdfWorker'; // Import worker config

export default function App() {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50">
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar />
        <div className="flex-1 flex flex-col relative w-full h-full bg-gray-100 overflow-hidden">
          {/* Toolbar Container - Absolute Top */}
          <div className="absolute top-0 left-0 right-0 z-50 flex justify-center pt-8 pointer-events-none">
            <div className="pointer-events-auto">
              <Toolbar />
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 w-full h-full overflow-auto pt-24 px-10 pb-10" id="main-scroll-container">
            <div className="min-h-full rounded-2xl border border-gray-200/50 shadow-inner bg-gray-50/50 relative flex flex-col">
              <PDFViewer />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
