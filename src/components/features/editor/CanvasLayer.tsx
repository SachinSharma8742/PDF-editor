import React from 'react';
import { Stage, Layer } from 'react-konva';
import { usePDFStore, type PDFObject } from '../../../store/pdfStore';
import { PDFObjectRenderer } from './PDFObjectRenderer';

interface CanvasLayerProps {
    pageId: string;
    pageNumber: number;
    width: number;
    height: number;
    scale: number;
}

/**
 * CanvasLayer - Purely for VIEWING objects in the Home Panel.
 * All editing logic has been removed as this view is now strictly read-only.
 * Editing occurs in the separate EditorCanvas component.
 */
export const CanvasLayer: React.FC<CanvasLayerProps> = ({ pageId, width, height, scale }) => {
    const { pages } = usePDFStore();
    const page = pages.find(p => p.id === pageId);

    if (!page) return null;

    return (
        <div
            className="absolute inset-0 z-30 pointer-events-none"
            style={{ cursor: 'default' }}
        >
            <Stage
                width={width}
                height={height}
                scaleX={scale}
                scaleY={scale}
                listening={false} // Force disable all hit detection and events
            >
                <Layer>
                    {/* Render Objects in Read-Only Mode */}
                    {page.objects.map((obj) => (
                        <PDFObjectRenderer
                            key={obj.id}
                            object={{
                                ...obj,
                                visible: obj.visible !== false
                            } as PDFObject}
                            isSelected={false}
                            isSelectionEnabled={false}
                            isLocked={true}
                            onSelect={() => { }}
                            onChange={() => { }}
                        />
                    ))}
                </Layer>
            </Stage>
        </div>
    );
};
