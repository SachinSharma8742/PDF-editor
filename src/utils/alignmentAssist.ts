/**
 * Intelligent Alignment & Snap Assist
 *
 * Provides precision alignment guidance when moving objects on the editor canvas.
 * Detects page center lines, object edges, spacing relationships, and grid alignment.
 *
 * Pure utility — no side effects. Returns guide data and snapped coordinates;
 * the caller decides when to apply.
 */

// ─── Types ─────────────────────────────────────────────────────

export interface SnapGuide {
    /** Orientation of the guide line */
    type: 'horizontal' | 'vertical';
    /** Position in canvas coordinates (y for horizontal, x for vertical) */
    position: number;
    /** Human-readable label for debugging / overlay text */
    label: string;
    /** Source of this guide (for filtering / styling) */
    source: 'page-center' | 'object-edge' | 'object-center' | 'spacing';
}

export interface AlignmentConfig {
    /** Pixel tolerance for snapping (default 5) */
    tolerance: number;
    /** Whether to detect page center guides */
    pageCenter: boolean;
    /** Whether to detect object edge / center guides */
    objectEdges: boolean;
    /** Whether to detect equal spacing */
    spacing: boolean;
}

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface SnapResult {
    /** Final x after snapping */
    x: number;
    /** Final y after snapping */
    y: number;
    /** Guides that were triggered (for visual display) */
    activeGuides: SnapGuide[];
}

// ─── Defaults ──────────────────────────────────────────────────

export const DEFAULT_ALIGNMENT_CONFIG: AlignmentConfig = {
    tolerance: 5,
    pageCenter: true,
    objectEdges: true,
    spacing: true,
};

// ─── Guide Computation ─────────────────────────────────────────

/**
 * Compute all candidate alignment guides based on the page and sibling objects.
 * Does NOT consider snap tolerance — returns every possible guide.
 */
export function computeAlignmentGuides(
    pageWidth: number,
    pageHeight: number,
    siblings: Rect[],
    config: AlignmentConfig = DEFAULT_ALIGNMENT_CONFIG
): SnapGuide[] {
    const guides: SnapGuide[] = [];

    // ── Page center lines ──────────────────────────────────────
    if (config.pageCenter) {
        guides.push({
            type: 'vertical',
            position: pageWidth / 2,
            label: 'Page center (V)',
            source: 'page-center',
        });
        guides.push({
            type: 'horizontal',
            position: pageHeight / 2,
            label: 'Page center (H)',
            source: 'page-center',
        });
    }

    // ── Object edges & centres ─────────────────────────────────
    if (config.objectEdges) {
        for (const sib of siblings) {
            const left = sib.x;
            const right = sib.x + sib.width;
            const top = sib.y;
            const bottom = sib.y + sib.height;
            const cx = sib.x + sib.width / 2;
            const cy = sib.y + sib.height / 2;

            guides.push({ type: 'vertical', position: left, label: 'Left edge', source: 'object-edge' });
            guides.push({ type: 'vertical', position: right, label: 'Right edge', source: 'object-edge' });
            guides.push({ type: 'vertical', position: cx, label: 'Center (V)', source: 'object-center' });

            guides.push({ type: 'horizontal', position: top, label: 'Top edge', source: 'object-edge' });
            guides.push({ type: 'horizontal', position: bottom, label: 'Bottom edge', source: 'object-edge' });
            guides.push({ type: 'horizontal', position: cy, label: 'Center (H)', source: 'object-center' });
        }
    }

    // ── Equal spacing detection ────────────────────────────────
    if (config.spacing && siblings.length >= 2) {
        // Horizontal spacing: sort siblings by x, find gaps
        const sortedX = [...siblings].sort((a, b) => a.x - b.x);
        for (let i = 0; i < sortedX.length - 1; i++) {
            const gap = sortedX[i + 1].x - (sortedX[i].x + sortedX[i].width);
            if (gap > 0) {
                // Suggest a guide at (right-of-previous + gap) for equal spacing
                const spacingPos = sortedX[i + 1].x + sortedX[i + 1].width + gap;
                guides.push({
                    type: 'vertical',
                    position: spacingPos,
                    label: `Equal gap ${Math.round(gap)}px`,
                    source: 'spacing',
                });
            }
        }

        // Vertical spacing
        const sortedY = [...siblings].sort((a, b) => a.y - b.y);
        for (let i = 0; i < sortedY.length - 1; i++) {
            const gap = sortedY[i + 1].y - (sortedY[i].y + sortedY[i].height);
            if (gap > 0) {
                const spacingPos = sortedY[i + 1].y + sortedY[i + 1].height + gap;
                guides.push({
                    type: 'horizontal',
                    position: spacingPos,
                    label: `Equal gap ${Math.round(gap)}px`,
                    source: 'spacing',
                });
            }
        }
    }

    return guides;
}

// ─── Snap Application ──────────────────────────────────────────

/**
 * Given the proposed position of a moving object and all candidate guides,
 * compute the snapped position and the set of active guides.
 *
 * Does NOT mutate state — returns a new SnapResult.
 */
export function applySnap(
    movingRect: Rect,
    guides: SnapGuide[],
    tolerance: number = DEFAULT_ALIGNMENT_CONFIG.tolerance
): SnapResult {
    let snappedX = movingRect.x;
    let snappedY = movingRect.y;
    const activeGuides: SnapGuide[] = [];

    const movingLeft = movingRect.x;
    const movingRight = movingRect.x + movingRect.width;
    const movingCx = movingRect.x + movingRect.width / 2;
    const movingTop = movingRect.y;
    const movingBottom = movingRect.y + movingRect.height;
    const movingCy = movingRect.y + movingRect.height / 2;

    let bestDx = tolerance + 1;
    let bestDy = tolerance + 1;

    for (const guide of guides) {
        if (guide.type === 'vertical') {
            // Check left edge, right edge, and center against guide
            const dLeft = Math.abs(movingLeft - guide.position);
            const dRight = Math.abs(movingRight - guide.position);
            const dCenter = Math.abs(movingCx - guide.position);

            let d: number;
            let offset: number;

            if (dLeft <= dRight && dLeft <= dCenter) {
                d = dLeft;
                offset = guide.position - movingLeft;
            } else if (dRight <= dLeft && dRight <= dCenter) {
                d = dRight;
                offset = guide.position - movingRight;
            } else {
                d = dCenter;
                offset = guide.position - movingCx;
            }

            if (d <= tolerance && d < bestDx) {
                bestDx = d;
                snappedX = movingRect.x + offset;
            }

            if (d <= tolerance) {
                activeGuides.push(guide);
            }
        } else {
            // Horizontal guide — check top, bottom, center
            const dTop = Math.abs(movingTop - guide.position);
            const dBottom = Math.abs(movingBottom - guide.position);
            const dCenter = Math.abs(movingCy - guide.position);

            let d: number;
            let offset: number;

            if (dTop <= dBottom && dTop <= dCenter) {
                d = dTop;
                offset = guide.position - movingTop;
            } else if (dBottom <= dTop && dBottom <= dCenter) {
                d = dBottom;
                offset = guide.position - movingBottom;
            } else {
                d = dCenter;
                offset = guide.position - movingCy;
            }

            if (d <= tolerance && d < bestDy) {
                bestDy = d;
                snappedY = movingRect.y + offset;
            }

            if (d <= tolerance) {
                activeGuides.push(guide);
            }
        }
    }

    // Deduplicate guides by position+type
    const seen = new Set<string>();
    const dedupedGuides = activeGuides.filter(g => {
        const key = `${g.type}:${g.position}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    return { x: snappedX, y: snappedY, activeGuides: dedupedGuides };
}
