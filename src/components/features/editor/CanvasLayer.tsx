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

    // Compute pure base unscaled dimensions to guarantee perfectly stable geometry 
    // across varying zoom levels preventing adjustment layer rapid cache invalidation
    let baseWidth = page.width || 800;
    let baseHeight = page.height || 1100;

    // Handle rotation swapping first for the standard values for PDFs
    const rotation = Math.abs(page.rotation || 0) % 360;
    const isSwapped = (rotation === 90 || rotation === 270);
    
    if (isSwapped && page.source === 'pdf') {
        const temp = baseWidth;
        baseWidth = baseHeight;
        baseHeight = temp;
    }

    // If metadata is still loading (width is 0 or 800) but we have a background, 
    // extract true unscaled dimensions from the 2x buffer canvas
    if (bgImage && (page.width === 0 || page.width === 800)) {
        baseWidth = (bgImage as any).width / 2;
        baseHeight = (bgImage as any).height / 2;
    }

    // Build the nested stack (same logic as EditorCanvas)
    let currentStack: React.ReactNode[] = [];

    // 1. Start with the background
    if (bgImage) {
        currentStack.push(
            <KonvaImage
                key="bg-layer"
                image={bgImage}
                width={baseWidth}
                height={baseHeight}
                listening={false}
            />
        );
    } else if (page.source === 'blank') {
        currentStack.push(
            <Rect
                key="bg-layer"
                width={baseWidth}
                height={baseHeight}
                fill={page.backgroundColor || '#ffffff'}
                listening={false}
            />
        );
    } else {
        // Fallback transparent rectangle if no bgImage yet
        currentStack.push(<Rect key="bg-layer" width={baseWidth} height={baseHeight} fill="transparent" listening={false} />);
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

        // Wrap current stack + text edits - Since currentStack is an array now, we just push!
        currentStack.push(<Group key="content-stack-edits">{textEditNodes}</Group>);
    }

    const contentVersion = React.useMemo(() => {
        const objHash = page.objects
            .filter((o: PDFObject) => o.type !== 'effect')
            .map((o: PDFObject) => `${o.id}_${Math.round(o.x)}_${Math.round(o.y)}_${Math.round(o.width || 0)}_${Math.round(o.height || 0)}_${o.opacity}_${o.text || ''}_${o.src || ''}`)
            .join('|');
        return `${objHash}|${bgImage ? 'bg' : 'nobg'}|${baseWidth}x${baseHeight}`;
    }, [page.objects, bgImage, baseWidth, baseHeight]);

    // 2. Iterate through objects and build the nested structure
    page.objects.forEach((obj: PDFObject) => {
        if (obj.type === 'effect') {
            const proObject = {
                ...obj,
                x: 0,
                y: 0,
                width: baseWidth,
                height: baseHeight,
                rotation: 0,
                isLocked: true
            };
            currentStack = [
                <AdjustmentGroup
                    key={obj.id}
                    object={proObject}
                    isSelected={false}
                    contentVersion={contentVersion}
                >
                    {currentStack}
                </AdjustmentGroup>
            ];
        } else {
            currentStack.push(
                <PDFObjectRenderer
                    key={obj.id}
                    object={{
                        ...obj,
                        visible: obj.visible !== false
                    } as PDFObject}
                    isSelected={false}
                    isSelectionEnabled={false}
                    isLocked={true}
                />
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
