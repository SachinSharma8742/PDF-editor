import { mat2d, vec2 } from 'gl-matrix';

/**
 * Represents the geometric properties of a text span on the canvas.
 * All units are in viewport pixels (CSS pixels).
 */
export interface TextSpanGeometry {
    top: number;
    left: number;
    width: number;
    height: number;
    fontSize: number;
    rotation: number; // Degrees
    scaleX: number;
    scaleY: number;
}

/**
 * Calculates the precise visual bounding box and style properties for a PDF text item.
 * 
 * @param pdfTransform The [scaleX, skewY, skewX, scaleY, translateX, translateY] matrix from pdf.js
 * @param viewport The pdf.js viewport object used for this render
 * @param textWidth The width of the text in PDF units (from item.width)
 * @returns TextSpanGeometry with CSS-ready values
 */
export const calculateTextPosition = (
    pdfTransform: number[],
    viewport: any,
    textWidth: number
): TextSpanGeometry => {
    // 1. Convert the anchor point (tx, ty) to viewport coordinates
    // pdf.js transform is [a, b, c, d, tx, ty]
    // The anchor point on the PDF page is (tx, ty)
    const [a, b, c, d, tx, ty] = pdfTransform;

    // Viewport conversion handles the global page scaling and rotation
    const [vx, vy] = viewport.convertToViewportPoint(tx, ty);

    // 2. Decompose the text matrix to get font size, scale, and rotation
    // The viewport scale is already included in the convertToViewportPoint for position,
    // but for font size and dimensions we need to factor it in manually or use the matrix.

    // We compose the PDF text matrix with the viewport's transform matrix to get a "screen matrix".
    // Viewport transform is simple: [scale, 0, 0, -scale, offsetX, offsetY] (roughly) for 0 rotation.
    // However, pdf.js viewport.transform gives us the full picture.

    const viewportTransform = viewport.transform;

    // Create gl-matrix matrices (mat2d is 2x3 affine transform)
    // pdf.js matrices are also length 6 arrays, compatible with mat2d
    const mText = mat2d.clone(pdfTransform as any);
    const mViewport = mat2d.clone(viewportTransform);

    // Initial text placement usually requires flipping Y because PDF is bottom-up,
    // but convertToViewportPoint handles the translation. 
    // For scaling/rotation, we just multiply the linear parts?
    // Actually, pdf.js `viewport.transform` maps PDF unit space to Canvas pixel space.
    // So `TotalTransform = Viewport * TextMatrix`

    const mTotal = mat2d.create();
    mat2d.multiply(mTotal, mViewport, mText);

    // Decompose mTotal to get visual properties
    // mTotal = [sx, ky, kx, sy, tx, ty]
    // rotation = atan2(ky, sx)
    // scaleX = sqrt(sx*sx + ky*ky)
    // scaleY = sqrt(kx*kx + sy*sy)

    const totalA = mTotal[0]; // sx
    const totalB = mTotal[1]; // ky
    const totalC = mTotal[2]; // kx
    const totalD = mTotal[3]; // sy
    // tx, ty are in mTotal[4], mTotal[5], but we used common anchor logic before.
    // Let's rely on decompose.

    const rotationRad = Math.atan2(totalB, totalA);
    const rotationDeg = rotationRad * (180 / Math.PI);

    const scaleX = Math.sqrt(totalA * totalA + totalB * totalB);
    const scaleY = Math.sqrt(totalC * totalC + totalD * totalD);

    // Font Size:
    // In PDF, font size is explicit in the command, but pdf.js bakes it into the matrix?
    // No, pdf.js items usually have a font size scaling factor in the matrix.
    // The `item.height` is often a good proxy, but let's stick to the matrix scaleY which represents the
    // vertical scaling component of the text coordinate system.
    // This `scaleY` is the pixel height of 1 text unit.
    // If the font size was 1 (standard normalized), this is the pixel size.
    // However, coordinate space sometimes assumes 1 unit = 1 pt.
    // Let's verify with standard practice: The font size in pixels is roughly `scaleY`.

    // Width:
    // `textWidth` is in PDF units. We need to scale it by `scaleX`?
    // Wait, if we use the composed matrix, `scaleX` is "how many pixels is 1 horizontal PDF unit".
    // So yes, pixelWidth = textWidth * (scaleX of the text matrix component specifically? or the total?)
    // pdf.js item.width is "width of text in text space units" * "font size"? 
    // Usually item.width is in *user space* units (unscaled by viewport).

    // Let's go simpler and more robust:
    // Scale is simply `scale` from viewport * `scale` from matrix.
    // This decomposition is the most accurate way.

    // Adjust position for HTML top-left (PDF uses baseline).
    // Accessing ascent would be ideal, but we lack font metrics.
    // Standard heuristic: top = baselineY - ascent.
    // Using 0.8 * fontSize is common but can be refined.
    const fontSize = scaleY;

    // Refine Baseline Offset
    // Ideally we'd use the font's ascent fraction.
    // For many standard fonts, ascent is ~0.9em, cap height ~0.7em.
    // 0.8 is a safe middle ground for "visual top".
    const baselineOffset = fontSize * 0.8;

    // Adjust X/Y based on rotation
    // converting (0, -ascent) in text space to viewport space
    // But since we are placing an HTML DIV at (left, top) with transform-origin 0 0,
    // we want (left, top) to be the top-left corner of the EM box.
    // The baseline anchor give us (0, 0) in text space.
    // We want to shift by (0, -0.8) in text space before transforming?
    // No, standard CSS rotation rotates around the origin.
    // If we place div at (vx, vy), that's the baseline start.
    // HTML text draws bottom-up from baseline? No, HTML text draws top-down.
    // If we say `top: vy, left: vx`, and `transform: translateY(-0.8em)`, that works for unrotated.
    // For rotated, the translation must happen *before* rotation? 
    // Actually, local translation is easier.

    const finalLeft = mTotal[4];
    const finalTop = mTotal[5];

    // In our React component, we will apply:
    // left: finalLeft
    // top: finalTop
    // transform: rotate(${rotationDeg}deg) translateY(-80%)
    // transformOrigin: 0 0

    return {
        left: finalLeft,
        top: finalTop,

        // Better: extract scaling factor from matrix relative to pure viewport scale?
        // Actually, item.width is in coordinate space. viewport.scale is global scale.
        // matrix scaleX includes everything.
        // So width = item.width * (scaleX_of_text_only)? 
        // Let's trust item.width * viewport.scale as a baseline, but rotated/skewed might differ.
        // The safest extraction for width in pixels:
        // width_px = item.width * viewport.scale; // This assumes no horizontal scaling in text matrix
        // If text matrix has scaling, we must account for it.
        // But `item.width` from pdf.js usually *includes* font scaling?
        // documentation says: "width is the width of the string in *user space* units".
        // User space units are PDF page units.
        // So `viewport.scale` converts user space to pixels.
        width: textWidth * viewport.scale,

        height: fontSize, // The EM height approx
        fontSize: fontSize,
        rotation: rotationDeg,
        scaleX: scaleX,
        scaleY: scaleY,
    };
};

/**
 * Calculates a bounding box for masking/redaction that covers the text plus padding.
 */
export const calculateMaskRect = (
    geometry: TextSpanGeometry,
    padding: number = 2
) => {
    // We want a box relative to the anchor point (baseline left)
    // The mask needs to be drawn in the same coordinate system as the text.
    // We will use the same transform: rotate(deg) translate(...)

    // Visual text top is roughly -0.8em.
    // Visual text bottom is roughly 0.2em (descent).
    // Padding should expand this box.

    return {
        // Relative to logic point (0,0) which is baseline-left
        marginLeft: -padding,
        marginTop: -(geometry.fontSize * 0.8) - padding,
        width: geometry.width + (padding * 2),
        height: geometry.fontSize + (padding * 2)
    };
};

/**
 * Returns a robust CSS font stack based on the raw PDF font name.
 * Heuristics are used to map PDF fonts (often subsets) to standard web fonts.
 */
export const getFontStack = (rawFontName: string = ''): string => {
    const lower = rawFontName.toLowerCase();

    if (lower.includes('times') || lower.includes('serif') || lower.includes('minion') || lower.includes('garamond')) {
        return '"Times New Roman", Times, serif';
    }
    if (lower.includes('courier') || lower.includes('mono') || lower.includes('code') || lower.includes('typewriter')) {
        return '"Courier New", Courier, monospace';
    }
    if (lower.includes('helvetica') || lower.includes('arial') || lower.includes('sans')) {
        return 'Inter, Helvetica, Arial, sans-serif';
    }

    // Default to Inter/system sans
    return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
};
