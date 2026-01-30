import { Toolbar } from './components/layout/Toolbar';
import { Sidebar } from './components/layout/Sidebar';
import { PDFViewer } from './components/features/pdf-viewer/PDFViewer';
import { usePDFWorker } from './utils/pdfWorker';

function App() {
  // Initialize worker
  usePDFWorker();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col relative">
          <PDFViewer />
        </div>
      </div>
    </div>
  );
}

export default App;
