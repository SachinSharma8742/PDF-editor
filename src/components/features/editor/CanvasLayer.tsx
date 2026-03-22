import React, { useEffect, useState } from 'react';
import { Stage, Layer, Rect, Image as KonvaImage, Group, Text } from 'react-konva';
import { usePDFStore, type PDFObject, type NativeTextEdit } from '../../../store/pdfStore'; // Import NativeTextEdit
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
    hideNativeTextEdits?: boolean;
}

/**
 * CanvasLayer - Purely for VIEWING objects in the Home Panel.
 * Supports adjustment layers via nested rendering.
 */
export const CanvasLayer: React.FC<CanvasLayerProps> = ({ pageId, width, height, scale, bgImage, pageOverride, hideNativeTextEdits = false }) => {
    const { pages, pdfDocument } = usePDFStore();
    const page = pageOverride || pages.find(p => p.id === pageId);

    // State for Native Text Edits (computed for Canvas)
    const [canvasTextEdits, setCanvasTextEdits] = useState<any[]>([]);
    const [pdfViewport, setPdfViewport] = useState<any>(null);

    // 1. Fetch Viewport (Once per page load)
    useEffect(() => {
        if (page?.source !== 'pdf' || page.originalPageIndex === undefined || !pdfDocument) return;

        // If we already have the correct viewport, skip
        // Note: We can't easily check equality, but this effect only runs on page/doc change

        let cancelled = false;
        const loadViewport = async () => {
            try {
                const pdfPage = await pdfDocument.getPage(page.originalPageIndex);
                if (cancelled) return;
                const vp = pdfPage.getViewport({ scale: 1 });
                setPdfViewport(vp);
            } catch (e) {
                console.error("Error loading viewport:", e);
            }
        };
        loadViewport();

        return () => { cancelled = true; };
    }, [pdfDocument, page?.originalPageIndex, page?.source]);

    // 2. Compute Edits (Sync when possible)
    useEffect(() => {
        if (!page || !page.nativeTextEdits || Object.keys(page.nativeTextEdits).length === 0) {
            if (canvasTextEdits.length > 0) setCanvasTextEdits([]);
            return;
        }

        if (page.source === 'pdf' && pdfViewport) {
            const edits = Object.values(page.nativeTextEdits).map((edit: any) => {
                const [vx, vy] = pdfViewport.convertToViewportPoint(edit.x, edit.y);
                return {
                    ...edit,
                    vx,
                    vy,
                    yPos: vy - (edit.fontSize * 0.8)
                };
            });
            setCanvasTextEdits(edits);
        } else if (page.source !== 'pdf') {
            // Non-PDF sources don't support native text edits usually, 
            // but if they did, we'd handle them here without viewport conversion
            setCanvasTextEdits([]);
        }
    }, [page?.nativeTextEdits, pdfViewport, page?.source]);


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

    // 1.5 Inject Native Text Edits directly on top of Background
    if (canvasTextEdits.length > 0 && !hideNativeTextEdits) {
        const textEditNodes = canvasTextEdits.map((edit) => (
            <Group key={edit.id}>
                {/* Redaction Rect (White Background) */}
                <Rect
                    x={edit.vx}
                    y={edit.yPos}
                    width={edit.width}
                    height={edit.fontSize * 1.2}
                    fill="#ffffff"
                    listening={false}
                />
                {/* New Text */}
                <Text
                    x={edit.vx}
                    y={edit.yPos}
                    text={edit.text}
                    fontSize={edit.fontSize}
                    fontFamily={edit.fontFamily || 'sans-serif'}
                    fill={edit.color || 'black'}
                    fontStyle={`${edit.fontStyle || 'normal'} ${edit.fontWeight || 'normal'}`}
                    textDecoration={edit.textDecoration || ''}
                    wrap="none" listening={false}
                />
            </Group>
        ));

        // Wrap current stack + text edits
        currentStack = (
            <Group key="content-stack">
                {currentStack}
                {textEditNodes}
            </Group>
        );
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
