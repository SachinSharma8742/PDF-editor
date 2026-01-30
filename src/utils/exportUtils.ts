
import { PDFDocument, PDFImage } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import type { PageState } from '../store/pdfStore';

export const saveDocument = async (pages: PageState[], originalPdfBytes: ArrayBuffer | null) => {
    if (pages.length === 0) return;

    try {
        const newPdf = await PDFDocument.create();
        let originalPdfDoc: PDFDocument | null = null;

        if (originalPdfBytes) {
            originalPdfDoc = await PDFDocument.load(originalPdfBytes);
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
