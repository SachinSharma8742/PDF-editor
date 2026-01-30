# Premium PDF Editor

A high-fidelity, client-side PDF editor built with React, TypeScript, and Vite. This application provides a seamless, professional environment for managing and editing PDF documents directly in your browser.

## 🚀 Key Features

### 💎 Premium Interface
- **Glassmorphic Design**: Modern, translucent UI components with high-precision animations.
- **Smart Sidebar**: An adaptable sidebar that provides document context and intuitive navigation.
- **Responsive Workspace**: A clean, centered document view that scales perfectly across different screen sizes.

### 📄 Document Operations
- **Focused Selection Mode**: A dedicated "Single-Purpose" terminal for bulk page management (Delete, Export, Clone).
- **Infinite Flexibility**: Add blank pages, append new PDF files, or reorder pages via smooth drag-and-drop.
- **Smart Scroll Tracking**: The sidebar "Viewing" marker automatically tracks your position in the document as you scroll.
- **Precision Page Management**: Full support for duplicating, deleting, and extracting specific page selections.

### 🛠 Tech Stack
- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **PDF Engine**: `pdfjs-dist` for rendering, `pdf-lib` for document manipulation.
- **State Management**: Zustand (for high-performance, predictable state).
- **Interactions**: `@dnd-kit` for robust drag-and-drop.

## 📦 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## 🏗 Project Structure
- `src/components/layout`: Core UI layout components (Sidebar, Toolbar).
- `src/components/features`: Feature-specific modules (PDF Viewer, Page Operations).
- `src/store`: Global state management via Zustand.
- `src/utils`: PDF heavy-lifting and utility functions.

---

*Built with precision and focus to provide a state-of-the-art PDF editing experience.*
