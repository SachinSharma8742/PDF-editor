import React, { useEffect, useState, useRef } from 'react';
import { usePDFStore } from '../../../store/pdfStore';
import { useEditorStore } from '../../../store/editorStore';
import * as pdfjsLib from 'pdfjs-dist';
import clsx from 'clsx';

interface PDFTextLayerProps {
    pageNumber: number;
    scale: number;
    viewOnly?: boolean; // If true, just display edits without interaction
}

export const PDFTextLayer: React.FC<PDFTextLayerProps> = ({ pageNumber, scale, viewOnly = false }) => {
    const { pdfDocument, pages } = usePDFStore();
    const { editingMode, setActiveNativeTextItem, activeNativeTextItem, setEditingMode, findReplaceState, pendingNativeTextEdits } = useEditorStore();
    const [textItems, setTextItems] = useState<any[]>([]);
    const layerRef = useRef<HTMLDivElement>(null);

    const pageState = pages.find(p => p.pageNumber === pageNumber);

    useEffect(() => {
        if (!pdfDocument || !pageState || pageState.source !== 'pdf') return;

        const loadText = async () => {
            try {
                const page = await pdfDocument.getPage(pageState.originalPageIndex!);
                const viewport = page.getViewport({ scale });
                const textContent = await page.getTextContent();

                // Process text items
                // pdf.js text items are essentially: { str: string, transform: number[], width: number, height: number, ... }
                // We need to map them to DOM coordinates.
                const processedItems = textContent.items.map((item: any) => {
                    if (!item.str.trim()) return null; // Skip empty text

                    // Provides the transformation matrix: [scaleX, skewY, skewX, scaleY, translateX, translateY]
                    // We can use viewport.convertToViewportPoint(x, y) if useful, but standard transform calculation is usually needed

                    // Simple estimation for now. A robust implementation needs careful matrix math.
                    // pdf.js gives us the transform.
                    const tx = item.transform;

                    // Calculate visual position
                    // Standard PDF coordinate system: (0,0) is bottom-left. Canvas is top-left.
                    // Viewport handles coordinate conversion.

                    // We need a rect for the overlay
                    // item.width is in PDF units. item.height is roughly font size.

                    // Let's rely on pdf.js viewport conversion for the anchor point (tx[4], tx[5])
                    // Note: pdf.js text rendering is complex.

                    return {
                        ...item,
                        id: `text-${pageNumber}-${Number(tx[4]).toFixed(2)}-${Number(tx[5]).toFixed(2)}`, // unique-ish stable id
                        originalTransform: tx,
                        // Pre-calculate viewport coords here to simplify render loop
                        viewportCoords: viewport.convertToViewportPoint(tx[4], tx[5]),
                        viewportScale: viewport.scale
                    };
                }).filter(Boolean);

                setTextItems(processedItems);

            } catch (err) {
                console.error("Error loading text layer:", err);
            }
        };

        loadText();
    }, [pdfDocument, pageNumber, scale, pageState]);

    // Get edits for this page from pageState
    const nativeTextEdits = pageState?.nativeTextEdits || {};
    const pageEdits = Object.values(nativeTextEdits);

    // In view-only mode, only render if there are edits to show
    if (viewOnly) {
        if (pageEdits.length === 0) return null;

        // Render only the edited text overlays (read-only)
        return (
            <div className="absolute inset-0 z-20 overflow-hidden pointer-events-none">
                {pageEdits.map((edit) => {
                    // Need to find the original text item to get positioning
                    const originalItem = textItems.find(item => item.id === edit.id);
                    if (!originalItem) return null;

                    const [fontScaleX, , , fontScaleY] = originalItem.originalTransform;
                    const [vx, vy] = originalItem.viewportCoords;

                    // Use the LATEST font size for positioning if we want the box to fit
                    const currentFontSize = edit.fontSize * originalItem.viewportScale;
                    const originalFontSize = Math.sqrt(fontScaleY * fontScaleY) * originalItem.viewportScale;

                    // Width should accommodate either original or new text (approximate)
                    const width = (edit.text.length / originalItem.str.length) * originalItem.width * originalItem.viewportScale;
                    const minWidth = originalItem.width * originalItem.viewportScale;

                    // Baseline is vy. We position div so text baseline inside matches vy.
                    // If we use line-height: 1 and top: vy - capHeight...
                    const top = vy - (currentFontSize * 0.8);

                    return (
                        <div
                            key={edit.id}
                            className="absolute z-20 flex items-center whitespace-pre"
                            style={{
                                left: vx,
                                top: top,
                                minWidth: Math.max(width, minWidth),
                                height: currentFontSize * 1.2,
                                fontSize: currentFontSize,
                                fontFamily: edit.fontFamily || 'sans-serif',
                                color: edit.color || '#000000',
                                fontWeight: edit.fontWeight || 'normal',
                                fontStyle: edit.fontStyle || 'normal',
                                textDecoration: edit.textDecoration || 'none',
                                backgroundColor: '#ffffff', // Opaque background to redact original
                                padding: '0 4px',
                                lineHeight: 1,
                            }}
                        >
                            {edit.text}
                        </div>
                    );
                })}
            </div>
        );
    }

    // Full interactive mode - only when editing
    if (editingMode !== 'native-text') return null;

    return (
        <div
            ref={layerRef}
            className="absolute inset-0 z-20 overflow-hidden"
            style={{ pointerEvents: 'none' }} // Allow clicks to pass through unless on a text item
        >
            {textItems.map((item) => {
                // item.transform is [scaleX, skewY, skewX, scaleY, x, y]
                // Font size is roughly scaleY
                const [fontScaleX, , , fontScaleY] = item.originalTransform;

                // Use pre-calculated viewport coords
                const [vx, vy] = item.viewportCoords;

                // item.width is the width in PDF units
                const width = item.width * item.viewportScale;

                // Font size in pixels
                const fontSize = Math.sqrt(fontScaleY * fontScaleY) * item.viewportScale;

                // Adjust Y. PDF point (x,y) is usually the baseline. 
                // We need to position a div top-left or baseline based.
                // CSS positioning is top-left.
                // Baseline offset is tricky without font metrics. A rough guess is fontSize * 0.8

                const top = vy - (fontSize * 0.8);

                const isSelected = activeNativeTextItem?.id === item.id;
                // Check for live pending edits first, then page confirmed edits
                const pendingEdit = pendingNativeTextEdits[item.id];
                const pageEdit = nativeTextEdits[item.id];
                const activeEdit = pendingEdit || pageEdit;
                const isEdited = activeEdit !== undefined;

                // Use LATEST font size for current state
                const currentFontSize = isEdited && activeEdit ? activeEdit.fontSize * item.viewportScale : fontSize;
                const topOffset = vy - (currentFontSize * 0.8);

                // Adjust width if edited
                const currentWidth = isEdited && activeEdit
                    ? (activeEdit.text.length / item.str.length) * width
                    : width;

                // Check if this text item has any find/replace matches
                const matchIndices = findReplaceState.matches
                    .map((m, idx) => m.id === item.id ? idx : -1)
                    .filter(idx => idx !== -1);
                const hasMatch = matchIndices.length > 0;
                const isCurrentMatch = matchIndices.includes(findReplaceState.currentMatchIndex);

                return (
                    <div
                        key={item.id}
                        className={clsx(
                            "absolute cursor-text flex items-center whitespace-pre",
                            isSelected ? "ring-1 ring-blue-500 z-30" : "hover:bg-blue-200/20 z-10",
                            isEdited ? "bg-white z-20" : "", // Tailwinds bg-white
                            hasMatch && !isCurrentMatch ? "bg-yellow-200/60 z-15" : "",
                            isCurrentMatch ? "bg-orange-300/80 ring-2 ring-orange-500 z-25" : ""
                        )}
                        style={{
                            left: vx,
                            top: topOffset,
                            minWidth: Math.max(currentWidth, width),
                            height: currentFontSize * 1.2,
                            fontSize: currentFontSize,
                            fontFamily: activeEdit?.fontFamily || 'sans-serif',
                            pointerEvents: 'auto',
                            transformOrigin: '0% 0%',
                            color: isEdited && activeEdit?.color ? activeEdit.color : 'transparent', // Show text if edited
                            lineHeight: 1,
                            // If edited, we need to match the font size of the edit
                            ...(isEdited && activeEdit ? {
                                fontWeight: activeEdit.fontWeight || 'normal',
                                fontStyle: activeEdit.fontStyle || 'normal',
                                textDecoration: activeEdit.textDecoration || 'none',
                                backgroundColor: '#ffffff', // Force opaque white background
                            } : {})
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            // When clicking, we load the *current state* (edited or original)
                            // When clicking, we load the *current state* (edited or original)
                            const defaultData = {
                                id: item.id,
                                text: item.str,
                                x: item.originalTransform[4],
                                y: item.originalTransform[5],
                                width: item.width,
                                height: item.height || fontScaleY, // Use fontScaleY as fallback for height
                                fontSize: Math.sqrt(fontScaleY * fontScaleY),
                                fontFamily: item.fontName,
                                color: item.color || '#000000',
                                originalRef: item,
                                pageId: pageState!.id
                            };

                            const dataToSet = activeEdit ? { ...defaultData, ...activeEdit, originalRef: item, pageId: pageState!.id } : defaultData;
                            setActiveNativeTextItem(dataToSet);
                        }}
                    >
                        {isEdited && activeEdit ? activeEdit.text : item.str}
                    </div>
                );
            })}
        </div>
    );
};
