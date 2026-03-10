
import { PDFDocument, PDFImage, PDFPage } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import type { PageState, NativeTextEdit, PDFObject, PDFDocumentProxy, PDFViewport } from '../store/pdfStore';
import { hexToRgba } from './colorUtils';

import { applyAdjustmentPipeline } from './effectUtils';

/**
 * Main function to save the document as a new PDF.
 */
export const saveDocument = async (pages: PageState[], originalPdfBytes: ArrayBuffer | null) => {
    if (pages.length === 0) return;

    try {
        const newPdf = await PDFDocument.create();
        let originalPdfDoc: PDFDocument | null = null;
        let pdfjsDoc: PDFDocumentProxy | null = null;

        if (originalPdfBytes) {
            // Clone the buffer to prevent detachment issues
            const pdfBytes = originalPdfBytes.slice(0);
            originalPdfDoc = await PDFDocument.load(pdfBytes);

            // Also load with pdf.js to get viewport information for coordinate conversion
            const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) });
            pdfjsDoc = await loadingTask.promise;
        }

        for (const page of pages) {
            let pdfPage: PDFPage;
            let pageWidth = 595;
            let pageHeight = 842;
            let viewport: PDFViewport | null = null;

            // 1. Get Base Page (PDF, Image, or Blank)
            if (page.source === 'pdf' && originalPdfDoc && page.originalPageIndex !== undefined) {
                // Copy original page (pdf-lib uses 0-based index)
                // page.originalPageIndex is 1-based from our store.
                const [copiedPage] = await newPdf.copyPages(originalPdfDoc, [page.originalPageIndex - 1]);
                pdfPage = newPdf.addPage(copiedPage);
                pageWidth = pdfPage.getWidth();
                pageHeight = pdfPage.getHeight();

                // Get pdf.js viewport for this page
                if (pdfjsDoc) {
                    const jsPage = await pdfjsDoc.getPage(page.originalPageIndex); // pdf.js is 1-based
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

                viewport = {
                    width: pageWidth,
                    height: pageHeight,
                    convertToViewportPoint: (x: number, y: number) => [x * 2, y * 2], // Simple scale=2
                    scale: 2
                };

            } else {
                // Blank page
                pageWidth = page.width || 595;
                pageHeight = page.height || 842;
                pdfPage = newPdf.addPage([pageWidth, pageHeight]);

                viewport = {
                    width: pageWidth,
                    height: pageHeight,
                    convertToViewportPoint: (x: number, y: number) => [x * 2, y * 2],
                    scale: 2
                };
            }

            // 2. Render Annotations to a Canvas (Rasterization)
            // If the page is edited or has objects (including adjustment layers), we create an overlay
            const hasAnnotations = (page.objects && page.objects.length > 0) ||
                (page.nativeTextEdits && Object.keys(page.nativeTextEdits).length > 0) ||
                (page.paths && page.paths.length > 0);

            if (hasAnnotations) {
                const scale = 2; // High DPI for crisp text/shapes
                const canvas = document.createElement('canvas');
                canvas.width = pageWidth * scale;
                canvas.height = pageHeight * scale;
                const ctx = canvas.getContext('2d');

                if (ctx) {
                    ctx.scale(scale, scale);

                    // A. If there are effects applied early in the stack, we might need to rasterize the background
                    // Check if there are any effect objects
                    const hasEffects = page.objects.some(obj => obj.type === 'effect' && obj.visible !== false);

                    if (hasEffects && pdfjsDoc && page.source === 'pdf' && page.originalPageIndex !== undefined) {
                        const jsPage = await pdfjsDoc.getPage(page.originalPageIndex);
                        const bgViewport = jsPage.getViewport({ scale });
                        const bgCanvas = document.createElement('canvas');
                        bgCanvas.width = canvas.width;
                        bgCanvas.height = canvas.height;
                        const bgCtx = bgCanvas.getContext('2d');
                        if (bgCtx) {
                            await jsPage.render({ canvasContext: bgCtx, viewport: bgViewport }).promise;
                            ctx.drawImage(bgCanvas, 0, 0, pageWidth, pageHeight);
                        }
                    } else if (hasEffects && page.source === 'image' && page.content) {
                        const img = new Image();
                        img.crossOrigin = 'anonymous';
                        await new Promise<void>((resolve) => {
                            img.onload = () => {
                                ctx.drawImage(img, 0, 0, pageWidth, pageHeight);
                                resolve();
                            }
                            img.src = page.content!;
                        });
                    }

                    // B. Draw Native Text Edits
                    if (page.nativeTextEdits && viewport) {
                        drawNativeTextEdits(ctx, page.nativeTextEdits, viewport);
                    }

                    // C. Draw Annotations & Adjustment Layers Interleaved
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
        const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
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
 */
/**
 * Unified function to render all PDF objects/annotations to a canvas context.
 */
async function drawPageAnnotationsToCanvas(ctx: CanvasRenderingContext2D, page: PageState) {
    if (page.paths && page.paths.length > 0) {
        page.paths.forEach(path => {
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = path.stroke || 'black';
            ctx.lineWidth = path.strokeWidth || 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = path.opacity !== undefined ? path.opacity : 1;

            const offsetX = path.x || 0;
            const offsetY = path.y || 0;

            if (path.points && path.points.length > 0) {
                ctx.moveTo(offsetX + path.points[0], offsetY + path.points[1]);
                for (let i = 2; i < path.points.length; i += 2) {
                    ctx.lineTo(offsetX + path.points[i], offsetY + path.points[i + 1]);
                }
            }
            ctx.stroke();
            ctx.restore();
        });
    } else {
        console.log('[Export] No freehand paths found on this page.');
    }

    // 2. Draw Objects (Shapes, Text, Images)
    if (page.objects && page.objects.length > 0) {
        console.log(`[Export] Processing ${page.objects.length} objects...`);
        // Sort objects by z-index if needed (currently array order)
        for (const obj of page.objects) {
            console.log(`[Export] Drawing Object: ${obj.id} (${obj.type}) at (${obj.x}, ${obj.y}) Size: ${obj.width}x${obj.height}`);
            if (obj.type === 'effect') {
                if (obj.visible !== false) {
                    // Apply the unified adjustment pipeline to the ENTIRE current canvas context
                    applyAdjustmentPipeline(ctx, obj.effectParams || {});
                }
            } else {
                await drawObjectToCanvas(ctx, obj);
            }
        }
    }
};

/**
 * Draws a single PDFObject to the canvas.
 */
/**
 * Draws a single PDFObject to the canvas.
 */
async function drawObjectToCanvas(ctx: CanvasRenderingContext2D, obj: PDFObject) {
    try {
        ctx.save();

        // Debug visibility
        if (obj.visible === false) {
            console.log(`[Export] Skipping hidden object: ${obj.id}`);
            ctx.restore();
            return;
        }

        const x = obj.x;
        const y = obj.y;
        const width = obj.width || 0;
        const height = obj.height || 0;

        // Variables for transforms
        const w = width;
        const h = height;
        const cx = x + width / 2;
        const cy = y + height / 2;

        // Apply Transparency
        ctx.globalAlpha = obj.opacity ?? 1;

        console.log(`[Export] Rendering ${obj.type}: cx=${cx}, cy=${cy}, w=${width}, h=${height}, rot=${obj.rotation}`);

        // Apply Transforms: Translate to center -> Rotate -> Scale/Flip -> Skew -> Translate back
        ctx.translate(cx, cy);


        // Flip is just negative scale
        const scaleX = obj.flipX ? -1 : 1;
        const scaleY = obj.flipY ? -1 : 1;
        if (scaleX !== 1 || scaleY !== 1) {
            ctx.scale(scaleX, scaleY);
        }

        // Skew
        if (obj.skewX || obj.skewY) {
            // defined as: x' = x + tan(skewX)*y, y' = y + tan(skewY)*x
            // setTransform(a, b, c, d, e, f) -> [a c e]
            //                                   [b d f]
            //                                   [0 0 1]
            // a=1, b=tan(skewY), c=tan(skewX), d=1
            // context.transform(a, b, c, d, e, f)
            const tanX = Math.tan(((obj.skewX || 0) * Math.PI) / 180);
            const tanY = Math.tan(((obj.skewY || 0) * Math.PI) / 180);
            ctx.transform(1, tanY, tanX, 1, 0, 0);
        }

        ctx.translate(-cx, -cy);

        if (obj.type === 'text') {
            const fontSize = obj.fontSize || 16;
            const fontFamily = obj.fontFamily || 'Inter';
            const fontWeight = obj.fontWeight || 'normal';
            const fontStyle = obj.fontStyle || 'normal';

            ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${fontFamily}"`;
            ctx.textBaseline = 'top';
            ctx.textAlign = (obj.align || 'left') as CanvasTextAlign;
            ctx.fillStyle = obj.fill || 'black';

            let drawX = obj.x;
            if (obj.align === 'center') drawX += w / 2;
            if (obj.align === 'right') drawX += w;

            ctx.fillText(obj.text || '', drawX, obj.y);

        } else if (obj.type === 'image' || obj.type === 'stamp') {
            // Resolve the source URL
            const src = (obj as { src?: string; url?: string; content?: string }).src ||
                (obj as { url?: string }).url ||
                (obj.type === 'stamp' ? `data:image/svg+xml;utf8,${encodeURIComponent((obj as { content?: string }).content || '')}` : null);

            if (src) {
                await new Promise<void>((resolve) => {
                    const img = new Image();

                    // For blob URLs, crossOrigin might cause issues if set to anonymous? 
                    // Actually, for Blobs it doesn't matter, but for CORS enabled external URLs it does.
                    // Safest is usually anonymous.
                    img.crossOrigin = "anonymous";

                    img.onload = () => {
                        try {
                            // Ensure we have valid dimensions
                            const drawW = w || img.naturalWidth;
                            const drawH = h || img.naturalHeight;

                            if (drawW > 0 && drawH > 0) {
                                if ((obj as any).crop) {
                                    const crop = (obj as any).crop;
                                    ctx.drawImage(
                                        img,
                                        crop.x, crop.y, crop.width, crop.height, // Source: Crop Rect
                                        obj.x, obj.y, drawW, drawH               // Dest: Canvas Position & Size
                                    );
                                } else {
                                    ctx.drawImage(img, obj.x, obj.y, drawW, drawH);
                                }
                            }
                        } catch (e) {
                            console.warn("Retrying image draw without crossOrigin", e);
                            // Retry without crossOrigin? (Only if needed, complexity...)
                        }
                        resolve();
                    };

                    img.onerror = (err) => {
                        console.error("Failed to load image for export:", src, err);
                        // Silently fail but resolve so providing doesn't hang
                        resolve();
                    };

                    img.src = src;
                });
            }

        } else if (['rectangle', 'circle', 'triangle', 'star', 'polygon', 'ellipse'].includes(obj.type)) {
            ctx.beginPath();
            if (obj.type === 'rectangle') {
                if (obj.cornerRadius) {
                    if ('roundRect' in ctx) {
                        ctx.roundRect(obj.x, obj.y, w, h, obj.cornerRadius);
                    } else {
                        (ctx as CanvasRenderingContext2D).rect(obj.x, obj.y, w, h);
                    }
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

            if (obj.fill && obj.fill !== 'transparent') {
                ctx.fillStyle = hexToRgba(obj.fill, obj.fillOpacity ?? 1);
                ctx.fill();
            }

            const strokeWidth = obj.strokeWidth ?? 2;
            const strokeColor = obj.stroke || 'black';

            if (strokeWidth > 0 && strokeColor !== 'transparent') {
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = strokeWidth;
                if (obj.dash) ctx.setLineDash(obj.dash);
                ctx.stroke();
                ctx.setLineDash([]);
            }

        } else if (obj.type === 'line' || obj.type === 'arrow') {
            const sw = obj.strokeWidth ?? 2;
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

        } else if (['path', 'heart', 'cloud', 'lightning', 'drop', 'callout-bubble'].includes(obj.type)) {
            if (obj.type === 'path' && obj.points) {
                // Freehand Path
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
            } else {
                // SVG Path Shapes (Heart, Cloud, etc.)
                // Need to import SHAPE_PATHS or define them here. 
                // For now, let's hardcode the few we have or mapping.
                // PRO TIP: In a real app, importing SHAPE_PATHS is better. 
                // I'll define a local map to avoid import errors if the file is moved/missing in this context, 
                // but ideally we import it. 

                const SHAPE_PATHS_LOCAL: Record<string, string> = {
                    heart: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
                    cloud: "M25 38c-3.31 0-6-2.69-6-6 0-3.31 2.69-6 6-6 1.49 0 2.85.55 3.9 1.48.33-4.27 3.9-7.64 8.23-7.64 3.03 0 5.76 1.62 7.23 4.09 1.5-3.08 4.67-5.18 8.3-5.18 5.22 0 9.49 4.22 9.55 9.44.08.01.16.01.24.01 4.42 0 8 3.58 8 8s-3.58 8-8 8H25z",
                    lightning: "M7 2v11h3v9l7-12h-4l4-8z",
                    drop: "M12 2C6 10 3 14 3 17a9 9 0 0018 0c0-3-3-7-9-15z",
                    "callout-bubble": "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
                };

                const pathData = SHAPE_PATHS_LOCAL[obj.type] || "";
                if (pathData) {
                    const p = new Path2D(pathData);
                    ctx.save();
                    ctx.translate(obj.x, obj.y);
                    // Scale based on 24x24 viewbox as seen in PDFObjectRenderer (scaleX = width/24)
                    const scaleX = w / 24;
                    const scaleY = h / 24;
                    ctx.scale(scaleX, scaleY);

                    if (obj.fill && obj.fill !== 'transparent') {
                        ctx.fillStyle = hexToRgba(obj.fill, obj.fillOpacity ?? 1);
                        ctx.fill(p);
                    }

                    const strokeWidth = obj.strokeWidth ?? 2;
                    if (strokeWidth > 0 && obj.stroke && obj.stroke !== 'transparent') {
                        // Stroke width also needs to be manipulated if we scaled the context?
                        // If we scale context, stroke width scales too.
                        // Konva handles this by applying scale to the shape, but stroke is usually defined in local units?
                        // In PDFObjectRenderer: scaleX={width/24}, strokeWidth={object.strokeWidth ?? 2}
                        // Wait, Konva strokeWidth is affected by scale ONLY if not vector-effect non-scaling-stroke (which Konva doesn't do by default for Paths easily).
                        // Actually Konva's default is that stroke scales.
                        // So if we scale context x10, stroke x1 becomes x10.
                        // But we want the stroke to look like '2px' on screen.
                        // If we scale by `w/24` (e.g. 100/24 = 4), a 2px stroke becomes 8px.
                        // So we must divide strokeWidth by scale.
                        ctx.lineWidth = strokeWidth / Math.max(scaleX, scaleY);
                        ctx.strokeStyle = obj.stroke;
                        ctx.stroke(p);
                    }
                    ctx.restore();
                }
            }
        } // Close else if (path/shape)

        if (obj.type === 'group' && obj.children) {
            ctx.translate(obj.x, obj.y);
            for (const child of obj.children) {
                await drawObjectToCanvas(ctx, child);
            }
            ctx.translate(-obj.x, -obj.y);
        }

        ctx.restore();

    } catch (e) {
        console.error(`[Export] Error drawing object ${obj.id}`, e);
        ctx.restore();
    }
}

/**
 * Draws Native Text Edits using Viewport Conversion
 */
function drawNativeTextEdits(ctx: CanvasRenderingContext2D, edits: Record<string, NativeTextEdit>, viewport: PDFViewport) {
    Object.values(edits).forEach((edit) => {
        const [vx, vy] = viewport.convertToViewportPoint(edit.x, edit.y);
        const scale = viewport.scale;
        const logicalVX = vx / scale;
        const logicalVY = vy / scale;
        const fontSize = edit.fontSize;
        const width = edit.width;

        ctx.save();
        ctx.fillStyle = 'white';
        const rectTop = logicalVY - (fontSize * 0.8);
        ctx.fillRect(logicalVX, rectTop, width, fontSize * 1.2);

        ctx.fillStyle = edit.color || 'black';
        const fontWeight = edit.fontWeight || 'normal';
        const fontStyle = edit.fontStyle || 'normal';
        ctx.font = `${fontStyle} ${fontWeight} ${edit.fontSize}px ${edit.fontFamily || 'sans-serif'}`;
        ctx.textBaseline = 'top';
        ctx.fillText(edit.text, logicalVX, rectTop);

        if (edit.textDecoration && edit.textDecoration.includes('underline')) {
            const textWidth = ctx.measureText(edit.text).width;
            const lineY = rectTop + (edit.fontSize * 1.05);
            ctx.beginPath();
            ctx.moveTo(logicalVX, lineY);
            ctx.lineTo(logicalVX + textWidth, lineY);
            ctx.strokeStyle = ctx.fillStyle;
            ctx.lineWidth = edit.fontSize * 0.05;
            ctx.stroke();
        }
        ctx.restore();
    });
};

export const saveDocumentFlattened = async (pages: PageState[], pdfDocSource: PDFDocumentProxy | null, quality: number) => {
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
    downloadFile(new Blob([pdfBytes as BlobPart], { type: 'application/pdf' }), `flattened_export_${Date.now()}.pdf`);
};

export const exportPageAsImage = async (page: PageState, format: 'png' | 'jpg', quality: number, pdfDocSource: PDFDocumentProxy | null) => {
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

// Exported for PrintModal previews
export const renderPageToBlob = async (page: PageState, format: 'png' | 'jpg', quality: number, pdfDocSource: PDFDocumentProxy | null): Promise<{ blob: Blob | null }> => {
    const scale = 2; // High DPI export
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return { blob: null };

    let viewport: PDFViewport | null = null;

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
            width: canvas.width / scale,
            height: canvas.height / scale,
            convertToViewportPoint: (x: number, y: number) => [x * scale, y * scale],
            scale: scale
        };
    } else {
        canvas.width = (page.width || 595) * scale;
        canvas.height = (page.height || 842) * scale;
        ctx.fillStyle = page.backgroundColor || 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        viewport = {
            width: canvas.width / scale,
            height: canvas.height / scale,
            convertToViewportPoint: (x: number, y: number) => [x * scale, y * scale],
            scale: scale
        };
    }

    // 2. Render Annotations using Unified Logic
    ctx.save();
    ctx.scale(scale, scale);

    if (page.nativeTextEdits && viewport) {
        drawNativeTextEdits(ctx, page.nativeTextEdits, viewport);
    }

    await drawPageAnnotationsToCanvas(ctx, page);

    ctx.restore();

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve({ blob });
        }, format === 'jpg' ? 'image/jpeg' : 'image/png', quality);
    });
};

const getPdfPageViewport = async (pdfDoc: PDFDocumentProxy, pageNum: number, scale: number) => {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    return { page, viewport };
};

export const printBlobs = async (blobUrls: string[]) => {
    if (blobUrls.length === 0) return;

    try {
        // Create a hidden iframe for printing
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (!doc) {
            document.body.removeChild(iframe);
            throw new Error("Could not create print iframe");
        }

        // Add basic print styles
        // FIX: Added margin: 0 to @page and body to prevent extra blank pages.
        // FIX: Removed margin from images and ensured block display.
        doc.write(`
            <html>
                <head>
                    <title>Print Document</title>
                    <style>
                        @media print {
                            @page { margin: 0; size: auto; }
                            body { margin: 0; padding: 0; }
                            img { 
                                max-width: 100%; 
                                height: auto; 
                                display: block; 
                                page-break-after: always; 
                                page-break-inside: avoid;
                            }
                            img:last-child { page-break-after: auto; }
                            /* Hide header/footer if possible using size: auto, varies by browser */
                        }
                        body { 
                            margin: 0; 
                            padding: 0; 
                            display: flex; 
                            flex-direction: column; 
                            align-items: center; 
                            background: white; 
                        }
                        img { 
                            display: block;
                            max-width: 100%;
                        }
                    </style>
                </head>
                <body>
        `);

        blobUrls.forEach(url => {
            doc.write(`<img src="${url}" />`);
        });

        doc.write(`
                <script>
                    window.onload = () => {
                        window.focus();
                        setTimeout(() => {
                            window.print();
                        }, 500);
                    };
                </script>
                </body>
            </html>
        `);
        doc.close();

        // Cleanup
        setTimeout(() => {
            if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
            }
            // Revoke URLs is caller's responsibility usually, but if we created them here we would.
            // Since we receive URLs, we assume caller manages them OR we don't touch them.
            // However, typical pattern handling:
            // logic moved to caller or utility that generated them.
        }, 5000);

    } catch (e) {
        console.error("Print failed", e);
        alert("Failed to print.");
    }
};

/**
 * @deprecated Use openPrintModal from editorStore to trigger the UI instead.
 * Keeping this for backward compatibility or direct calls if needed.
 */
export const printPages = async (pages: PageState[], pdfDocSource: PDFDocumentProxy | null) => {
    const objectUrls: string[] = [];
    try {
        for (const page of pages) {
            const { blob } = await renderPageToBlob(page, 'png', 1.0, pdfDocSource);
            if (blob) {
                const url = URL.createObjectURL(blob);
                objectUrls.push(url);
            }
        }
        await printBlobs(objectUrls);
    } finally {
        // Cleanup generated URLs locally since we created them
        setTimeout(() => {
            objectUrls.forEach(url => URL.revokeObjectURL(url));
        }, 10000);
    }
};
