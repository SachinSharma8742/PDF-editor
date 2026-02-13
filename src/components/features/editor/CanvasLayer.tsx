import React from 'react';
import { Stage, Layer, Rect, Image as KonvaImage, Group } from 'react-konva';
import { usePDFStore, type PDFObject } from '../../../store/pdfStore';
import { PDFObjectRenderer } from './PDFObjectRenderer';
import { AdjustmentGroup } from './shared/AdjustmentGroup';

interface CanvasLayerProps {
    pageId: string;
    pageNumber: number;
    width: number;
    height: number;
    scale: number;
    bgImage?: HTMLCanvasElement | HTMLImageElement | null;
    pageOverride?: any; // Allow passing a page state directly (for Editor Drafts)
}

/**
 * CanvasLayer - Purely for VIEWING objects in the Home Panel.
 * Supports adjustment layers via nested rendering.
 */
export const CanvasLayer: React.FC<CanvasLayerProps> = ({ pageId, width, height, scale, bgImage, pageOverride }) => {
    const { pages } = usePDFStore();
    const page = pageOverride || pages.find(p => p.id === pageId);

    if (!page) return null;

    // Unzoomed dimensions for internal logic
    const unzoomedWidth = width / scale;
    const unzoomedHeight = height / scale;

    // Build the nested stack (same logic as EditorCanvas)
    let currentStack: React.ReactNode = null;

    // 1. Start with the background
    if (bgImage) {
        currentStack = (
            <KonvaImage
                key="bg-layer"
                image={bgImage}
                width={unzoomedWidth}
                height={unzoomedHeight}
                listening={false}
            />
        );
    } else if (page.source === 'blank') {
        currentStack = (
            <Rect
                key="bg-layer"
                width={unzoomedWidth}
                height={unzoomedHeight}
                fill={page.backgroundColor || '#ffffff'}
                listening={false}
            />
        );
    } else {
        // Fallback transparent rectangle if no bgImage yet
        currentStack = <Rect key="bg-layer" width={unzoomedWidth} height={unzoomedHeight} fill="transparent" listening={false} />;
    }

    // 2. Iterate through objects and build the nested structure
    page.objects.forEach((obj: PDFObject) => {
        if (obj.type === 'effect') {
            const proObject = {
                ...obj,
                x: 0,
                y: 0,
                width: unzoomedWidth,
                height: unzoomedHeight,
                rotation: 0,
                isLocked: true
            };
            currentStack = (
                <AdjustmentGroup
                    key={obj.id}
                    object={proObject}
                    isSelected={false}
                >
                    {currentStack}
                </AdjustmentGroup>
            );
        } else {
            currentStack = (
                <Group key={obj.id}>
                    {currentStack}
                    <PDFObjectRenderer
                        object={{
                            ...obj,
                            visible: obj.visible !== false
                        } as PDFObject}
                        isSelected={false}
                        isSelectionEnabled={false}
                        isLocked={true}
                    />
                </Group>
            );
        }
    });

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
                listening={false}
            >
                <Layer>
                    {currentStack}
                </Layer>
            </Stage>
        </div>
    );
};
