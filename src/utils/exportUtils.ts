
import { PDFDocument, PDFImage } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import type { PageState, NativeTextEdit, PDFObject } from '../store/pdfStore';
import { hexToRgba } from './colorUtils';

/**
 * Main function to save the document as a new PDF.
 */
export const saveDocument = async (pages: PageState[], originalPdfBytes: ArrayBuffer | null) => {
    if (pages.length === 0) return;

    try {
        const newPdf = await PDFDocument.create();
        let originalPdfDoc: PDFDocument | null = null;
        let pdfjsDoc: any = null;

        if (originalPdfBytes) {
            // Clone the buffer to prevent detachment issues
            const pdfBytes = originalPdfBytes.slice(0);
            originalPdfDoc = await PDFDocument.load(pdfBytes);

            // Also load with pdf.js to get viewport information for coordinate conversion
            const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) });
            pdfjsDoc = await loadingTask.promise;
        }

        for (const page of pages) {
            let pdfPage;
            let pageWidth = 595;
            let pageHeight = 842;
            let viewport: any = null;

            // 1. Get Base Page (PDF, Image, or Blank)
            if (page.source === 'pdf' && originalPdfDoc && page.originalPageIndex) {
                // Copy original page (pdf-lib uses 0-based index)
                const [copiedPage] = await newPdf.copyPages(originalPdfDoc, [page.originalPageIndex - 1]);
                pdfPage = newPdf.addPage(copiedPage);
                pageWidth = pdfPage.getWidth();
                pageHeight = pdfPage.getHeight();

                // Get pdf.js viewport for this page
                if (pdfjsDoc) {
                    const jsPage = await pdfjsDoc.getPage(page.originalPageIndex);
                    // We match the scale used for canvas rendering later (scale=2)
                    viewport = jsPage.getViewport({ scale: 2 });
                }

            } else if (page.source === 'image' && page.content) {
                // Embed image
                const imageBytes = await fetch(page.content).then(res => res.arrayBuffer());
                let embeddedImage: PDFImage;

                if (page.content.startsWith('data:image/png')) {
                    embeddedImage = await newPdf.embedPng(imageBytes);
                } else {
                    embeddedImage = await newPdf.embedJpg(imageBytes);
                }

                pageWidth = page.width || embeddedImage.width;
                pageHeight = page.height || embeddedImage.height;

                pdfPage = newPdf.addPage([pageWidth, pageHeight]);
                pdfPage.drawImage(embeddedImage, {
                    x: 0,
                    y: 0,
                    width: pageWidth,
                    height: pageHeight,
                });

                // Mock viewport for image pages? 
                // Image pages usually don't have Native Text Edits (which come from PDF text layer).
                // If they did, we'd assume standard scale.
                viewport = {
                    convertToViewportPoint: (x: number, y: number) => [x * 2, y * 2], // Simple scale=2
                    scale: 2
                };

            } else {
                // Blank page
                pageWidth = page.width || 595;
                pageHeight = page.height || 842;
                pdfPage = newPdf.addPage([pageWidth, pageHeight]);

                viewport = {
                    convertToViewportPoint: (x: number, y: number) => [x * 2, y * 2],
                    scale: 2
                };
            }

            // 2. Render Annotations to a Canvas (Rasterization)
            if (page.isEdited || (page.objects && page.objects.length > 0) || (page.nativeTextEdits && Object.keys(page.nativeTextEdits).length > 0)) {

                const scale = 2; // High DPI for crisp text/shapes
                const canvas = document.createElement('canvas');
                canvas.width = pageWidth * scale;
                canvas.height = pageHeight * scale;
                const ctx = canvas.getContext('2d');

                if (ctx) {
                    ctx.scale(scale, scale);

                    // A. Draw Native Text Edits FIRST (Bottom Layer)
                    if (page.nativeTextEdits && viewport) {
                        // Note: We pass viewport to handle coordinate conversion
                        drawNativeTextEdits(ctx, page.nativeTextEdits, viewport);
                    }

                    // B. Draw Annotations (Middle/Top Layer)
                    await drawPageAnnotationsToCanvas(ctx, page);
                }

                // 3. Embed this Annotation Layer into the PDF
                const annotationUrl = canvas.toDataURL('image/png');
                const annotationImageBytes = await fetch(annotationUrl).then(res => res.arrayBuffer());
                const embeddedAnnotation = await newPdf.embedPng(annotationImageBytes);

                pdfPage.drawImage(embeddedAnnotation, {
                    x: 0,
                    y: 0,
                    width: pageWidth,
                    height: pageHeight,
                });
            }
        }

        // Save and Download
        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `edited_document_${Date.now()}.pdf`;
        a.click();
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error('Export Error:', error);
        alert('Failed to save PDF. Check console for details.');
    }
};

/**
 * Unified function to render all PDF objects/annotations to a canvas context.
 * Used by both PDF Export (layer overlay) and Image Export (flattening).
 * Assumes context is SCALED to match logical coordinates.
 */
const drawPageAnnotationsToCanvas = async (ctx: CanvasRenderingContext2D, page: PageState) => {
    // 1. Draw Paths (Freehand Drawings)
    if (page.paths && page.paths.length > 0) {
        page.paths.forEach(path => {
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = path.stroke;
            ctx.lineWidth = path.strokeWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = path.opacity !== undefined ? path.opacity : 1;

            if (path.points && path.points.length > 0) {
                ctx.moveTo(path.points[0], path.points[1]);
                for (let i = 2; i < path.points.length; i += 2) {
                    ctx.lineTo(path.points[i], path.points[i + 1]);
                }
            }
            ctx.stroke();
            ctx.restore();
        });
    }

    // 2. Draw Objects
    if (page.objects && page.objects.length > 0) {
        for (const obj of page.objects) {
            await drawObjectToCanvas(ctx, obj);
        }
    }
};

/**
 * Draws a single PDFObject to the canvas.
 */
const drawObjectToCanvas = async (ctx: CanvasRenderingContext2D, obj: PDFObject) => {
    ctx.save();

    // Apply Global Opacity
    ctx.globalAlpha = obj.opacity ?? 1;

    const w = obj.width || 0;
    const h = obj.height || 0;
    const cx = obj.x + w / 2;
    const cy = obj.y + h / 2;

    if (obj.rotation) {
        ctx.translate(cx, cy);
        ctx.rotate((obj.rotation * Math.PI) / 180);
        ctx.translate(-cx, -cy);
    }

    // Draw based on Type
    if (obj.type === 'text') {
        const fontSize = obj.fontSize || 16;
        const fontFamily = obj.fontFamily || 'Inter';
        const fontWeight = obj.fontWeight || 'normal';
        const fontStyle = obj.fontStyle || 'normal';

        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${fontFamily}"`;
        ctx.textBaseline = 'top';
        ctx.textAlign = (obj.align || 'left') as CanvasTextAlign;
        ctx.fillStyle = obj.fill || 'black';

        // Handle alignment relative to X
        let drawX = obj.x;
        if (obj.align === 'center') drawX += w / 2;
        if (obj.align === 'right') drawX += w;

        ctx.fillText(obj.text || '', drawX, obj.y);

    } else if (obj.type === 'image' || obj.type === 'stamp') {
        const src = (obj as any).src || (obj as any).url || (obj.type === 'stamp' ? `data:image/svg+xml;utf8,${encodeURIComponent((obj as any).content)}` : null);
        if (src) {
            await new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, obj.x, obj.y, w, h);
                    resolve();
                };
                img.onerror = () => resolve();
                img.crossOrigin = "anonymous";
                img.src = src;
            });
        }

    } else if (['rectangle', 'circle', 'triangle', 'star', 'polygon', 'ellipse'].includes(obj.type)) {
        ctx.beginPath();

        // Shape Paths
        if (obj.type === 'rectangle') {
            if (obj.cornerRadius) {
                // @ts-ignore
                if (ctx.roundRect) ctx.roundRect(obj.x, obj.y, w, h, obj.cornerRadius);
                else ctx.rect(obj.x, obj.y, w, h);
            } else {
                ctx.rect(obj.x, obj.y, w, h);
            }
        } else if (obj.type === 'circle') {
            const r = w / 2;
            ctx.arc(obj.x + r, obj.y + r, r, 0, 2 * Math.PI);
        } else if (obj.type === 'ellipse') {
            const rx = w / 2;
            const ry = h / 2;
            ctx.ellipse(obj.x + rx, obj.y + ry, rx, ry, 0, 0, 2 * Math.PI);
        } else if (obj.type === 'triangle') {
            ctx.moveTo(obj.x + w / 2, obj.y);
            ctx.lineTo(obj.x + w, obj.y + h);
            ctx.lineTo(obj.x, obj.y + h);
            ctx.closePath();
        }

        // Fill properly using fillOpacity
        if (obj.fill && obj.fill !== 'transparent') {
            ctx.fillStyle = hexToRgba(obj.fill, obj.fillOpacity ?? 1);
            ctx.fill();
        }

        // Stroke
        if ((obj.strokeWidth ?? 0) > 0 && obj.stroke && obj.stroke !== 'transparent') {
            ctx.strokeStyle = obj.stroke;
            ctx.lineWidth = obj.strokeWidth || 2;
            if (obj.dash) ctx.setLineDash(obj.dash);
            ctx.stroke();
            ctx.setLineDash([]); // Reset
        }

    } else if (obj.type === 'line' || obj.type === 'arrow') {
        const sw = obj.strokeWidth || 2;
        ctx.beginPath();

        const points = obj.points || [0, 0, 100, 100];
        const startX = obj.x + points[0];
        const startY = obj.y + points[1];
        const endX = obj.x + points[2];
        const endY = obj.y + points[3];

        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);

        ctx.strokeStyle = obj.stroke || 'black';
        ctx.lineWidth = sw;
        if (obj.dash) ctx.setLineDash(obj.dash);
        ctx.stroke();
        ctx.setLineDash([]);

        if (obj.type === 'arrow') {
            const angle = Math.atan2(endY - startY, endX - startX);
            const headLen = sw * 3;
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX - headLen * Math.cos(angle - Math.PI / 6), endY - headLen * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX - headLen * Math.cos(angle + Math.PI / 6), endY - headLen * Math.sin(angle + Math.PI / 6));
            ctx.stroke();
        }

    } else if (obj.type === 'path' && obj.points) {
        ctx.beginPath();
        ctx.strokeStyle = obj.stroke || 'black';
        ctx.lineWidth = obj.strokeWidth || 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const pts = obj.points;
        if (pts.length > 0) {
            ctx.moveTo(obj.x + pts[0], obj.y + pts[1]);
            for (let i = 2; i < pts.length; i += 2) {
                ctx.lineTo(obj.x + pts[i], obj.y + pts[i + 1]);
            }
        }
        ctx.stroke();
    }
    else if (obj.type === 'group' && obj.children) {
        ctx.translate(obj.x, obj.y);
        for (const child of obj.children) {
            await drawObjectToCanvas(ctx, child);
        }
        ctx.translate(-obj.x, -obj.y);
    }

    ctx.restore();
};

/**
 * Draws Native Text Edits using Viewport Conversion
 */
const drawNativeTextEdits = (ctx: CanvasRenderingContext2D, edits: Record<string, NativeTextEdit>, viewport: any) => {
    Object.values(edits).forEach((edit) => {
        // Coords conversion from PDF to Viewport (Canvas)
        // Note: Viewport is already scaled (scale=2), so x,y are in canvas pixels.
        const [vx, vy] = viewport.convertToViewportPoint(edit.x, edit.y);

        // Font size scaling? edit.fontSize is likely PDF point size?
        // PDFTextLayer calculates: const fontSize = edit.fontSize * originalItem.viewportScale;
        // viewport.scale is 2. So we use that.
        // Wait, 'edit.fontSize' might be pre-scaled or not? 
        // In PDFTextLayer: `const fontSize = edit.fontSize * originalItem.viewportScale;`
        // where viewportScale comes from `page.getViewport({ scale })`.
        // So yes, we need to scale the font size by `viewport.scale`.

        // Important: Our `ctx` is ALREADY scaled by `ctx.scale(2,2)`.
        // If we draw at `vx` (which is scaled by 2), we are effectively drawing at `2*vx` (scaled by 4!)
        // NO. 
        // If `ctx` is scaled by 2, and we want to draw at 100 logical units:
        // We should supply 100.
        // But `viewport.convertToViewportPoint` returns SCALED pixels (scale=2).
        // e.g. if x=50, scale=2 -> returns 100.
        // If we draw at 100 on a ctx scaled by 2, it draws at 200 pixels.
        // This is DOUBLE SCALING.

        // Solution: Either don't scale ctx, OR downscale coordinates.
        // Since `drawPageAnnotationsToCanvas` relies on logical coords (width=595), and ctx.scale(2) renders high res.
        // `viewport` here uses scale=2 to get High Res coords.
        // We should use `viewport` with `scale=1` to get LOGICAL coords!
        // That matches our `ctx.scale(2,2)` expectations.

        // BUT `convertToViewportPoint` does Y-flipping based on height.
        // If we use scale=1, height is 842.
        // If we use scale=2, height is 1684.
        // Y-flipping depends on height.

        // Let's assume we want to work in LOGICAL coordinates (PDF Points essentially), 
        // and let ctx.scale(2,2) handle the high-res.
        // So we need a Viewport with scale=1.
        // Let's change the caller to pass `viewport = jsPage.getViewport({ scale: 1 });`!

        // ... Wait, `drawPageAnnotationsToCanvas` assumes `page.width` (Logical).
        // So `drawNativeTextEdits` should also use Logical coords.
        // So I must ensure `viewport` passed in uses Scale=1.

        // HOWEVER, inside `saveDocument`, I passed `scale: 2` to `getViewport`.
        // I should change that to `scale: 1` in `saveDocument`.
        // But wait, `renderPageToBlob` (Image Export) also sets `canvas.width` based on `viewport.width`.
        // If I change `viewport` to scale=1, `canvas.width` becomes Low Res.

        // Better fix: 
        // Keep `ctx.scale(2,2)` (High DPI context).
        // Keep `canvas.width` = High DPI.
        // Pass a `logicalViewport` (scale=1) for coordinate conversion.
        // OR: Unscale the coords returned by `convertToViewportPoint(scale=2)`.

        // Example: x=50. Scale=2. Viewport returns x=100.
        // We want to draw at x=50 (Logical).
        // So `drawX = vx / 2`.

        // Let's just adjust the `viewport` creation in `saveDocument` to be specifically for COORDINATE CONVERSION (Logic).
        // And separate it from Canvas Sizing.

        // Let's use `scale=1` for the viewport passed to `drawNativeTextEdits`. 
        // In `saveDocument`: `viewport = jsPage.getViewport({ scale: 1 });`
        // In `renderPageToBlob`: `viewport = ... scale=2`... wait.

        // In `renderPageToBlob`, we use `viewport` to RENDER the PDF page.
        // That viewport MUST be scale=2 for quality.
        // But for `drawNativeTextEdits`, we need scale=1 coords.

        // So:
        // const logicalViewport = page.getViewport({ scale: 1 });
        // drawNativeTextEdits(..., logicalViewport);

        // I will implement this adjustment in `drawNativeTextEdits`: 
        // Instead of changing callers, I can just effectively use `vx / viewport.scale`?
        // No, because Y-flip depends on height.
        // `(height - y*scale)` vs `(height*scale - y*scale) / scale` = `height - y`.
        // Yes, dividing by scale works linear.

        const scale = viewport.scale;
        const logicalVX = vx / scale;
        const logicalVY = vy / scale;

        const fontSize = edit.fontSize; // PDF units
        const width = edit.width; // PDF units

        ctx.save();

        // Draw background whiteout
        // PDFTextLayer calculates top = vy - fontSize*0.8
        // vy is the baseline-ish. 
        // We use logicalVY.

        ctx.fillStyle = 'white';
        // Adjust rectangle to cover text properly.
        const rectTop = logicalVY - (fontSize * 0.8);
        ctx.fillRect(logicalVX, rectTop, width, fontSize * 1.2);

        // Text
        ctx.fillStyle = edit.color || 'black';
        ctx.font = `${edit.fontSize}px ${edit.fontFamily || 'sans-serif'}`;
        // Note: Canvas coordinates are now logical. 
        // If we draw at logicalVY (baseline), we need standard baseline?
        // PDFTextLayer uses a DIV at `top`.
        // If `top` is top-left of div. 
        // And inside div, text is standard.
        // So we should draw text at `top` with `textBaseline = 'top'`.
        // So draw at `rectTop`.

        ctx.textBaseline = 'top';
        ctx.fillText(edit.text, logicalVX, rectTop);

        ctx.restore();
    });
}


// --- Flattened / Image Export Logic ---

export const saveDocumentFlattened = async (pages: PageState[], pdfDocSource: any, quality: number) => {
    // Flatten logic: Render each page to image, then embed
    const newPdf = await PDFDocument.create();

    for (const pageState of pages) {
        const { blob } = await renderPageToBlob(pageState, 'jpg', quality, pdfDocSource);
        if (!blob) continue;

        const arrayBuffer = await blob.arrayBuffer();
        const embeddedImage = await newPdf.embedJpg(arrayBuffer);

        const newPage = newPdf.addPage([embeddedImage.width, embeddedImage.height]);
        newPage.drawImage(embeddedImage, {
            x: 0,
            y: 0,
            width: embeddedImage.width,
            height: embeddedImage.height,
        });
    }

    const pdfBytes = await newPdf.save();
    downloadFile(new Blob([pdfBytes as any], { type: 'application/pdf' }), `flattened_export_${Date.now()}.pdf`);
};

export const exportPageAsImage = async (page: PageState, format: 'png' | 'jpg', quality: number, pdfDocSource: any) => {
    const { blob } = await renderPageToBlob(page, format, quality, pdfDocSource);
    if (blob) {
        downloadFile(blob, `page-${page.pageNumber}.${format}`);
    }
};

const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

const renderPageToBlob = async (page: PageState, format: 'png' | 'jpg', quality: number, pdfDocSource: any): Promise<{ blob: Blob | null }> => {
    const scale = 2; // High DPI export
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return { blob: null };

    // 1. Render Background (PDF or Image)
    let viewport: any = null;

    if (page.source === 'pdf' && page.originalPageIndex !== undefined && pdfDocSource) {
        try {
            const result = await getPdfPageViewport(pdfDocSource, page.originalPageIndex, scale);
            const pdfPage = result.page;
            viewport = result.viewport;

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const renderContext = {
                canvasContext: ctx,
                viewport: viewport,
            };
            await pdfPage.render(renderContext).promise;
        } catch (e) {
            console.error("PDF Render failed", e);
            canvas.width = (page.width || 595) * scale;
            canvas.height = (page.height || 842) * scale;
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    } else if (page.source === 'image' && page.content) {
        canvas.width = (page.width || 800) * scale;
        canvas.height = (page.height || 600) * scale;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve) => {
            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve();
            }
            img.src = page.content!;
        });

        viewport = {
            convertToViewportPoint: (x: number, y: number) => [x * scale, y * scale],
            scale: scale
        };
    } else {
        canvas.width = (page.width || 595) * scale;
        canvas.height = (page.height || 842) * scale;
        ctx.fillStyle = page.backgroundColor || 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        viewport = {
            convertToViewportPoint: (x: number, y: number) => [x * scale, y * scale],
            scale: scale
        };
    }

    // 2. Render Annotations using Unified Logic
    ctx.save();
    ctx.scale(scale, scale);

    // A. Draw Native Text Edits
    if (page.nativeTextEdits && viewport) {
        drawNativeTextEdits(ctx, page.nativeTextEdits, viewport);
    }

    // B. Draw Annotations
    await drawPageAnnotationsToCanvas(ctx, page);

    ctx.restore();

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve({ blob });
        }, format === 'jpg' ? 'image/jpeg' : 'image/png', quality);
    });
};

const getPdfPageViewport = async (pdfDoc: any, pageIndex: number, scale: number) => {
    const page = await pdfDoc.getPage(pageIndex);
    const viewport = page.getViewport({ scale });
    return { page, viewport };
};
