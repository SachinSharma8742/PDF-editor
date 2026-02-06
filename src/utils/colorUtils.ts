/**
 * Converts a hex color string and an alpha value to an RGBA string.
 * @param hex - Hex color string (e.g., "#000000" or "#000")
 * @param alpha - Alpha value between 0 and 1
 * @returns RGBA string (e.g., "rgba(0,0,0,0.5)")
 */
export const hexToRgba = (hex: string | undefined, alpha: number | undefined): string => {
    if (!hex || hex === 'transparent') return 'transparent';
    let c = hex.substring(1).split('');
    if (c.length === 3) {
        c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    const val = parseInt(c.join(''), 16);
    const r = (val >> 16) & 255;
    const g = (val >> 8) & 255;
    const b = val & 255;
    const a = alpha !== undefined ? alpha : 1;
    return `rgba(${r},${g},${b},${a})`;
};
