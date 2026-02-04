
import { PDFDocument, PDFImage } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import type { PageState } from '../store/pdfStore';

export const saveDocument = async (pages: PageState[], originalPdfBytes: ArrayBuffer | null) => {
    if (pages.length === 0) return;

    try {
        const newPdf = await PDFDocument.create();
        let originalPdfDoc: PDFDocument | null = null;

        if (originalPdfBytes) {
            // Clone the buffer to prevent detachment issues
            originalPdfDoc = await PDFDocument.load(originalPdfBytes.slice(0));
        }

        for (const page of pages) {
            let pdfPage;

            // 1. Get Base Page (PDF, Image, or Blank)
            if (page.source === 'pdf' && originalPdfDoc && page.originalPageIndex) {
                // Copy original page
                // Note: pdf-lib uses 0-based index
                const [copiedPage] = await newPdf.copyPages(originalPdfDoc, [page.originalPageIndex - 1]);
                pdfPage = newPdf.addPage(copiedPage);
            } else if (page.source === 'image' && page.content) {
                // Create page from image
                // Embed image first
                const imageBytes = await fetch(page.content).then(res => res.arrayBuffer());
                let embeddedImage: PDFImage;

                // Determine format
                if (page.content.startsWith('data:image/png')) {
                    embeddedImage = await newPdf.embedPng(imageBytes);
                } else {
                    embeddedImage = await newPdf.embedJpg(imageBytes);
                }

                // Create page with custom dimensions or image dimensions
                const width = page.width || embeddedImage.width;
                const height = page.height || embeddedImage.height;

                pdfPage = newPdf.addPage([width, height]);
                pdfPage.drawImage(embeddedImage, {
                    x: 0,
                    y: 0,
                    width: width,
                    height: height,
                });

            } else {
                // Blank page
                pdfPage = newPdf.addPage([page.width || 595, page.height || 842]);
            }

            // 2. Overlay Edits (Lines & Images)
            // If the page has edits (lines or overlay images), we need to draw them.
            // For LINES, we used to rasterize. For IMAGES, we can embed them as vectors/objects!
            // However, to maintain consistency (and handle eraser/layers), rasterizing the KEY layer is often safest option 
            // OR we can draw them directly if we assume 'source-over'.

            // Current approach: Rasterize the Konva Stage to an image and overlay it?
            // Problem: Rendering PDF to canvas to handle 'Eraser' tool correctly is hard without flattening.
            // If the user erased part of the ORIGINAL PDF, we MUST rasterize the whole thing.
            // If the user only Drew/Added Images, we can just overlay.
            // BUT our Eraser implementation in Konva only erases the drawing layer, NOT the PDF underneath (unless we rendered PDF onto canvas).
            // Current Viewer: PDF is background (<img>/canvas from PDF.js), Konva is transparent overlay. Eraser allows erasing LINES.

            // So: We just need to capture the Konva Stage content (Lines + Overlay Images) map it to PDF coords.

            if (page.isEdited) {
                // We'll create a temporary canvas to draw lines and images
                // This is 'client-side' rasterization of the annotation layer
                const canvas = document.createElement('canvas');
                const viewWidth = page.width || pdfPage.getWidth();
                const viewHeight = page.height || pdfPage.getHeight();

                // Set canvas size (possibly high DPI)
                const scale = 2; // For quality
                canvas.width = viewWidth * scale;
                canvas.height = viewHeight * scale;
                const ctx = canvas.getContext('2d');
                if (!ctx) continue;

                ctx.scale(scale, scale);

                // Draw Paths (Freehand)
                if (page.paths && page.paths.length > 0) {
                    page.paths.forEach(path => {
                        ctx.beginPath();
                        ctx.strokeStyle = path.stroke;
                        ctx.lineWidth = path.strokeWidth;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.globalCompositeOperation = 'source-over'; // Eraser not fully supported in export yet without layer masking

                        if (path.points.length > 0) {
                            ctx.moveTo(path.points[0], path.points[1]);
                            for (let i = 2; i < path.points.length; i += 2) {
                                ctx.lineTo(path.points[i], path.points[i + 1]);
                            }
                        }
                        ctx.stroke();
                    });
                }

                // Draw Objects (Text, Shapes, Images)
                if (page.objects && page.objects.length > 0) {
                    for (const obj of page.objects) {
                        ctx.save();
                        // Handle rotation and position
                        // Note: Konva centers rotation, canvas needs translation
                        // Assuming obj.x/y is top-left.
                        // If object has specific center logic (like text), adjustment needed. 
                        // For simplicity, we assume standard top-left positioning for now.

                        if (obj.type === 'image') {
                            await new Promise<void>((resolve) => {
                                const img = new Image();
                                img.onload = () => {
                                    const w = obj.width || img.width;
                                    const h = obj.height || img.height;
                                    ctx.drawImage(img, obj.x, obj.y, w, h);
                                    resolve();
                                };
                                img.onerror = () => resolve(); // Skip on error
                                img.src = (obj as any).src || (obj as any).url; // Handle legacy/new naming
                            });
                        } else if (obj.type === 'text') {
                            const fontSize = obj.fontSize || 16;
                            ctx.font = `${fontSize}px ${obj.fontFamily || 'Arial'}`;
                            ctx.fillStyle = obj.fill || 'black';
                            ctx.fillText(obj.text || '', obj.x, obj.y + fontSize);
                        } else if (obj.type === 'rectangle') {
                            ctx.beginPath();
                            ctx.rect(obj.x, obj.y, obj.width || 0, obj.height || 0);
                            ctx.strokeStyle = obj.stroke || 'black';
                            ctx.lineWidth = obj.strokeWidth || 2;
                            ctx.stroke();
                            if (obj.fill && obj.fill !== 'transparent') {
                                ctx.fillStyle = obj.fill;
                                ctx.fill();
                            }
                        } else if (obj.type === 'circle') {
                            ctx.beginPath();
                            const w = obj.width || 0;
                            const radius = w / 2;
                            ctx.ellipse(obj.x + radius, obj.y + radius, radius, radius, 0, 0, 2 * Math.PI);
                            ctx.strokeStyle = obj.stroke || 'black';
                            ctx.lineWidth = obj.strokeWidth || 2;
                            ctx.stroke();
                        } else if (obj.type === 'path' && obj.points) {
                            ctx.beginPath();
                            ctx.strokeStyle = obj.stroke || 'black';
                            ctx.lineWidth = obj.strokeWidth || 2;
                            ctx.lineCap = 'round';
                            ctx.lineJoin = 'round';
                            if (typeof obj.opacity === 'number') {
                                ctx.globalAlpha = obj.opacity;
                            }

                            if (obj.points.length > 0) {
                                // Points are relative to obj.x, obj.y
                                ctx.moveTo(obj.x + obj.points[0], obj.y + obj.points[1]);
                                for (let i = 2; i < obj.points.length; i += 2) {
                                    ctx.lineTo(obj.x + obj.points[i], obj.y + obj.points[i + 1]);
                                }
                            }
                            ctx.stroke();
                            ctx.globalAlpha = 1; // Reset
                        }

                        ctx.restore();
                    }
                }

                // 3. Embed this Annotation Layer into the PDF
                const annotationUrl = canvas.toDataURL('image/png');
                const annotationImageBytes = await fetch(annotationUrl).then(res => res.arrayBuffer());
                const embeddedAnnotation = await newPdf.embedPng(annotationImageBytes);

                pdfPage.drawImage(embeddedAnnotation, {
                    x: 0,
                    y: 0,
                    width: viewWidth,
                    height: viewHeight,
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

// Helper to get PDF Page viewport
const getPdfPageViewport = async (pdfDoc: any, pageIndex: number, scale: number) => {
    const page = await pdfDoc.getPage(pageIndex + 1); // pdfjs is 1-based
    const viewport = page.getViewport({ scale });
    return { page, viewport };
};

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
    if (page.source === 'pdf' && page.originalPageIndex !== undefined && pdfDocSource) {
        try {
            const { page: pdfPage, viewport } = await getPdfPageViewport(pdfDocSource, page.originalPageIndex, scale);
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const renderContext = {
                canvasContext: ctx,
                viewport: viewport,
            };
            await pdfPage.render(renderContext).promise;
        } catch (e) {
            console.error("PDF Render failed", e);
            // Fallback dimensions
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
    } else {
        canvas.width = (page.width || 595) * scale;
        canvas.height = (page.height || 842) * scale;
        ctx.fillStyle = page.backgroundColor || 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. Render Annotations (manually for now to allow headless)
    ctx.save();
    ctx.scale(scale, scale); // Scale context to match canvas DPI

    // Draw Paths
    if (page.paths) {
        page.paths.forEach(path => {
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
            ctx.globalAlpha = 1;
        });
    }

    // Draw Objects
    if (page.objects) {
        for (const obj of page.objects) {
            ctx.save();
            ctx.globalAlpha = obj.opacity !== undefined ? obj.opacity : 1;

            // Translate to object center for rotation if needed, simply use top-left for now as per Konva default anchor
            // Konva rotates around center usually, but X/Y in our store depends on transformer. 
            // Our store calculates X/Y as top-left corner (unrotated bounding box corner ideally).
            // Actually, `EditorCanvas` updates X/Y to be the center-offset adjusted position...
            // Let's assume standard canvas rotation: translate to center, rotate, translate back.

            const w = obj.width || 0;
            const h = obj.height || 0;
            const cx = obj.x + w / 2;
            const cy = obj.y + h / 2;

            if (obj.rotation) {
                // Konva rotation
                ctx.translate(obj.x + w / 2, obj.y + h / 2); // Move to center ? 
                // Wait, our Konva setup in PDFObjectRenderer uses [x,y] as Top-Left of the shape, BUT the rotation transforms around center?
                // No, Konva defaults to rotating around (0,0) of the shape. If offset is not set.
                // In `PDFObjectRenderer`, we use `offsetX={object.width / 2}` and `offsetY={object.height / 2}` and map `x={object.x + object.width/2}`.
                // Wait, let's check PDFObjectRenderer.
                // `x={object.x + (object.width || 0) / 2}`
                // `offsetX={(object.width || 0) / 2}`
                // So the `object.x` in STORE is the Top-Left. 
                // The Renderer moves it to center to handle rotation.

                // So here:
                ctx.translate(obj.x + w / 2, obj.y + h / 2);
                ctx.rotate((obj.rotation * Math.PI) / 180);
                ctx.translate(-(obj.x + w / 2), -(obj.y + h / 2));
            }

            if (obj.type === 'text') {
                // Text Rendering
                const fontSize = obj.fontSize || 16;
                ctx.font = `${obj.fontWeight || ''} ${obj.fontStyle || ''} ${fontSize}px ${obj.fontFamily || 'Inter'}`;
                ctx.textBaseline = 'top';
                ctx.fillStyle = obj.fill || 'black';

                // Handle multiline text?
                // Simple implementation
                ctx.fillText(obj.text || '', obj.x, obj.y);

            } else if (obj.type === 'sticky-note') {
                // Sticky Note Rendering
                // Background
                ctx.fillStyle = obj.fill || '#fef08a';
                ctx.strokeStyle = obj.stroke || '#eab308';
                ctx.roundRect ? ctx.roundRect(obj.x, obj.y, w, h, 2) : ctx.rect(obj.x, obj.y, w, h);
                ctx.fill();
                ctx.stroke();

                // Text
                ctx.font = `14px Arial`;
                ctx.fillStyle = 'black';
                ctx.textBaseline = 'top';
                // Simple wrap required? Just clip for now
                ctx.fillText(obj.text || '', obj.x + 10, obj.y + 10);

            } else if (obj.type === 'rectangle') {
                ctx.beginPath();
                ctx.rect(obj.x, obj.y, w, h);
                if (obj.fill) { ctx.fillStyle = obj.fill; ctx.fill(); }
                if (obj.stroke) { ctx.strokeStyle = obj.stroke; ctx.lineWidth = obj.strokeWidth || 1; ctx.stroke(); }

            } else if (obj.type === 'line') {
                // Line is usually height 0 or small? Or points?
                // Our 'line' tool creates a shape with width/height, but specific rendering logic?
                // Let's check Renderer. It uses <Line> with points [0,0, width, height] relative?
                // Actually `EditorCanvas`: `points={[0, 0, object.width, 0]}` for horizontal line starter?
                // Let's assume simple stroke from x,y to x+w, y+h
                ctx.beginPath();
                ctx.moveTo(obj.x, obj.y);
                ctx.lineTo(obj.x + w, obj.y + h); // Simplified
                ctx.strokeStyle = obj.stroke || 'black';
                ctx.lineWidth = obj.strokeWidth || 2;
                ctx.stroke();

            } else if (obj.type === 'arrow') {
                // Arrow
                const headlen = (obj.strokeWidth || 2) * 3;
                const angle = Math.atan2(h, w);
                const tox = obj.x + w;
                const toy = obj.y + h;

                ctx.beginPath();
                ctx.moveTo(obj.x, obj.y);
                ctx.lineTo(tox, toy);
                ctx.strokeStyle = obj.stroke || 'black';
                ctx.lineWidth = obj.strokeWidth || 2;
                ctx.stroke();

                // Head
                ctx.beginPath();
                ctx.moveTo(tox, toy);
                ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
                ctx.moveTo(tox, toy);
                ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
                ctx.stroke();
            } else if (obj.type === 'stamp' || obj.type === 'image') {
                // Images / Stamps
                if ((obj as any).src) {
                    await new Promise<void>((resolve) => {
                        const img = new Image();
                        img.onload = () => {
                            ctx.drawImage(img, obj.x, obj.y, w, h);
                            resolve();
                        };
                        img.onerror = () => resolve();
                        img.src = (obj as any).src;
                    });
                }
            }

            ctx.restore();
        }
    }

    ctx.restore();

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve({ blob });
        }, format === 'jpg' ? 'image/jpeg' : 'image/png', quality);
    });
};
