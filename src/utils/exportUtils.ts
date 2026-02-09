
import { PDFDocument, PDFImage } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import type { PageState, NativeTextEdit, PDFObject } from '../store/pdfStore';
import { hexToRgba } from './colorUtils';
import { applyEffectStack } from './effectUtils';

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
            let pdfPage: any;
            let pageWidth = 595;
            let pageHeight = 842;
            let viewport: any = null;

            // 1. Get Base Page (PDF, Image, or Blank)
            if (page.source === 'pdf' && originalPdfDoc && page.originalPageIndex !== undefined) {
                // Copy original page (pdf-lib uses 0-based index)
                const [copiedPage] = await newPdf.copyPages(originalPdfDoc, [page.originalPageIndex]);
                pdfPage = newPdf.addPage(copiedPage);
                pageWidth = pdfPage.getWidth();
                pageHeight = pdfPage.getHeight();

                // Get pdf.js viewport for this page
                if (pdfjsDoc) {
                    const jsPage = await pdfjsDoc.getPage(page.originalPageIndex + 1); // pdf.js is 1-based
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

                    if (hasEffects && pdfjsDoc && page.source === 'pdf') {
                        const jsPage = await pdfjsDoc.getPage(page.originalPageIndex + 1);
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

    // 2. Interleaved Objects (Including Adjustment Layers)
    if (page.objects && page.objects.length > 0) {
        for (const obj of page.objects) {
            if (obj.type === 'effect') {
                if (obj.visible !== false) {
                    // Apply the effect to the ENTIRE current canvas context
                    const pageEffect = {
                        effect: obj.effectType!,
                        params: obj.effectParams || {},
                        opacity: obj.opacity ?? 1,
                        visible: true,
                        id: obj.id,
                        type: 'page-effect' as const
                    };
                    applyEffectStack(ctx, [pageEffect]);
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
const drawObjectToCanvas = async (ctx: CanvasRenderingContext2D, obj: PDFObject) => {
    if (!obj.visible) return;

    ctx.save();
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

        if (obj.fill && obj.fill !== 'transparent') {
            ctx.fillStyle = hexToRgba(obj.fill, obj.fillOpacity ?? 1);
            ctx.fill();
        }

        if ((obj.strokeWidth ?? 0) > 0 && obj.stroke && obj.stroke !== 'transparent') {
            ctx.strokeStyle = obj.stroke;
            ctx.lineWidth = obj.strokeWidth || 2;
            if (obj.dash) ctx.setLineDash(obj.dash);
            ctx.stroke();
            ctx.setLineDash([]);
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
    } else if (obj.type === 'group' && obj.children) {
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

export const saveDocumentFlattened = async (pages: PageState[], pdfDocSource: any, quality: number) => {
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

    let viewport: any = null;

    if (page.source === 'pdf' && page.originalPageIndex !== undefined && pdfDocSource) {
        try {
            const result = await getPdfPageViewport(pdfDocSource, page.originalPageIndex + 1, scale);
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

const getPdfPageViewport = async (pdfDoc: any, pageNum: number, scale: number) => {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    return { page, viewport };
};
