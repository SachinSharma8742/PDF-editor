# ANTI GRAVITY SYSTEM CONTRACT

> **Canonical safety contract for the PDF Editor project.**
> Every rule in this document is derived from actual implementation.
> All future changes MUST comply with these invariants.

---

## 1. Core System Invariants

### 1.1 PDF Coordinate Integrity

| Rule | Source |
|------|--------|
| `originalPageIndex` is **1-based** throughout the system (`pdfStore.ts` L189, L578). | pdf.js uses 1-based page indexing. |
| `pdf-lib` requires **0-based** indices; always subtract 1 before calling `copyPages` or `getPages` (`pdfOps.ts` L79, L122; `exportUtils.ts` L39). | Mismatch causes wrong page extraction or crash. |
| The PDF coordinate origin is **bottom-left**; the DOM/canvas origin is **top-left**. Conversion MUST go through `viewport.convertToViewportPoint()` (`textUtils.ts` L37; `PDFTextLayer.tsx` L58). | Direct use of raw `(tx, ty)` without viewport conversion will produce mirrored/shifted overlays. |
| `viewport.scale` is the single authoritative scaling factor between PDF user-space units and pixel units. It MUST be consistent between render and export (`exportUtils.ts` L48, L97; `PDFPage.tsx` L85). | Mismatched scale between rendering and export causes coordinate drift. |

**NEVER:**
- Use `originalPageIndex` directly as a 0-based index.
- Use raw PDF coordinates `(tx[4], tx[5])` without viewport conversion for DOM positioning.
- Mix viewport scales between render and export paths for the same page.

---

### 1.2 Overlay ↔ PDF Alignment Guarantees

The rendering stack in `PDFPage.tsx` (L161–304) defines a strict z-order:

```
z-0   BackgroundLayer     — Original PDF raster (canvas at scale=2) or image
z-20  PDFTextLayer        — Native text edit overlays (DOM positioned via viewport coords)
z-30  CanvasLayer         — Konva Stage with PDFObjects and AdjustmentGroups
z-6   Watermark overlay   — Non-interactive
z-7   Header/Footer       — Non-interactive structural overlay
```

**Rules:**
1. `BackgroundLayer` renders PDF at **scale=2** via a buffer canvas, then transfers to a final canvas to avoid detachment (`PDFPage.tsx` L86–107).
2. The `PDFTextLayer` positions spans using viewport-converted coordinates with a **0.8em baseline offset** heuristic (`PDFTextLayer.tsx` L102, L160`). This offset MUST NOT be changed without verifying against multiple font metrics.
3. When effects (`type === 'effect'`) exist on a page, the `BackgroundLayer` is suppressed and instead passed to `CanvasLayer` as a `bgImage` prop (`PDFPage.tsx` L182, L209). This prevents double-rendering the background.
4. `CanvasLayer` builds a **nested React tree** where each effect wraps all prior content in an `AdjustmentGroup`. The array order of `page.objects` IS the z-order.

**NEVER:**
- Render both `BackgroundLayer` AND pass `bgImage` to `CanvasLayer` simultaneously — this causes double-draw.
- Re-order the z-index layers without updating both `PDFPage.tsx` and `exportUtils.ts`.
- Position DOM overlays using PDF coordinates without viewport conversion and baseline adjustment.

---

### 1.3 Immutable State Guarantees

Both stores follow immutable update patterns via Zustand:

| Pattern | Location |
|---------|----------|
| `pages.map(p => p.id === pageId ? { ...p, ...updates } : p)` | `pdfStore.ts` throughout |
| `editorStore` uses `deepClone()` (structuredClone fallback to JSON parse/stringify) to isolate the working copy | `editorStore.ts` L290–295, L696 |
| History snapshots use `JSON.parse(JSON.stringify(pages))` to ensure full detachment | `pdfStore.ts` L504 |

**Rules:**
1. State mutations MUST use spread syntax or deep clone — never mutate `page.objects` or `page.nativeTextEdits` in place.
2. `editorStore.initEditor()` deep-clones the page from `pdfStore` to create an isolated working copy (`editorStore.ts` L693–696). Changes in the editor MUST NOT leak to `pdfStore` until `commit()` is called.
3. `commit()` writes the editor's `currentPage` back to `pdfStore.updatePage()` (`editorStore.ts` L709–717). `cancel()` discards the working copy.
4. `pdfStore` persists to IndexedDB via `idb-keyval` with partialize selecting only: `toolPreferences`, `theme`, `calibration`, `activeTool`, `pages` (`pdfStore.ts` L1131–1137).

**NEVER:**
- Mutate `state.pages[i]` directly — always produce a new array/object.
- Access `pdfStore` pages from `editorStore` during editing without going through `currentPage`.
- Persist `pdfDocument` or `originalPdfBytes` to IndexedDB (they are excluded from `partialize`).

---

### 1.4 Buffer Safety

| Operation | Safety Mechanism | Source |
|-----------|-----------------|--------|
| `PDFDocument.load()` | Always called with `originalPdfBytes.slice(0)` to clone the ArrayBuffer | `pdfOps.ts` L64; `exportUtils.ts` L21 |
| PDF rendering | Buffer canvas → final canvas copy to avoid reuse conflicts | `PDFPage.tsx` L86–107 |
| Clipboard | `deepClone()` all objects before storing | `editorStore.ts` L1187 |
| Paste | `deepClone()` + new UUID for each pasted object | `editorStore.ts` L1196–1204 |
| History | Full `JSON.parse(JSON.stringify())` snapshot before diffing | `pdfStore.ts` L504 |

**NEVER:**
- Pass `originalPdfBytes` directly to `PDFDocument.load()` without `.slice(0)`.
- Reuse a buffer canvas across multiple render calls without copying.
- Store object references (not clones) in clipboard or history.

---

## 2. Editing Pipeline Rules

### 2.1 Native Text Edit Lifecycle

```
Detect (PDFTextLayer) → Overlay (DOM span) → Mask (white background) → Stage (pendingNativeTextEdits) → Commit → Export
```

**Detailed Flow:**
1. **Detect**: `PDFTextLayer.tsx` loads text items via `page.getTextContent()` and converts positions with `viewport.convertToViewportPoint()`.
2. **Overlay**: Each text span is rendered as an absolutely-positioned DOM `<div>` at the viewport-converted coordinates.
3. **Mask**: Edited spans receive `backgroundColor: '#ffffff'` to redact the original PDF text beneath (`PDFTextLayer.tsx` L119, L211).
4. **Stage**: Edits are stored in `editorStore.pendingNativeTextEdits` as `NativeTextItem` records.
5. **Commit**: `commitNativeTextEdits()` writes each pending edit to `pdfStore.pages[].nativeTextEdits` via `updateNativeTextEdit()` (`editorStore.ts` L388–420).
6. **Export**: `drawNativeTextEdits()` in `exportUtils.ts` L493–526 converts PDF coordinates back to logical viewport coordinates and draws white rect + new text.

**Rules:**
- Text item IDs are deterministic: `text-${pageNumber}-${tx[4].toFixed(2)}-${tx[5].toFixed(2)}` (`PDFTextLayer.tsx` L55). Changing this format **breaks** edit mapping.
- Native text edits use PDF coordinate space for `x` and `y` (from `item.transform[4]` and `item.transform[5]`), NOT viewport coordinates.
- The masking rect in export uses `fontSize * 0.3` descent approximation and `1.2x` height factor (`pdfOps.ts` L143–146; `exportUtils.ts` L504–505).
- `commitNativeTextEdits()` also synchronizes the editor's `currentPage` if the edited page is currently open (`editorStore.ts` L403–416).

**NEVER:**
- Change text item ID format without migrating all existing `nativeTextEdits` keyed by those IDs.
- Apply viewport scaling to `NativeTextEdit.x` / `NativeTextEdit.y` — these must remain in PDF coordinate space.
- Remove the white background mask without providing an alternative redaction mechanism.
- Double-commit: calling `commitNativeTextEdits()` twice without clearing `pendingNativeTextEdits` in between.

---

### 2.2 Object Edit Lifecycle (EditorStore)

```
initEditor(page) → [addObject / updateObject / deleteObjects] → saveToHistory() → commit()
```

**Rules:**
1. `initEditor()` deep-clones the target page from `pdfStore` into `editorStore.currentPage`.
2. All object mutations operate on `editorStore.currentPage.objects` only.
3. `saveToHistory()` snapshots `currentPage` into `history.past` (capped at 50 entries, `editorStore.ts` L741).
4. `commit()` writes the final `currentPage` back to `pdfStore.updatePage()`.
5. Object array order IS z-order — the last element renders on top.

**NEVER:**
- Modify `pdfStore.pages` directly while the editor is active (except through `commitNativeTextEdits` which is a deliberate synchronization path).
- Call `saveToHistory()` after `set()` — it must be called BEFORE the mutation to capture the pre-change state.

---

### 2.3 Font Handling

The system uses **heuristic font mapping**, not exact PDF font embedding:

| Context | Font Strategy | Source |
|---------|--------------|--------|
| `PDFTextLayer` overlay (DOM) | Uses raw `item.fontName` or edit's `fontFamily` | `PDFTextLayer.tsx` L114, L201 |
| `textUtils.getFontStack()` | Maps PDF font names to web font stacks via keyword matching (times → serif, courier → monospace, helvetica → sans-serif, default → Inter) | `textUtils.ts` L191–206 |
| `pdfOps.applyNativeTextEdits()` | Embeds `StandardFonts.Helvetica` via pdf-lib | `pdfOps.ts` L113 |
| Export canvas rendering | Constructs CSS font string from object properties | `exportUtils.ts` L289 |

**Rules:**
- Font mismatch between screen and export is **expected** — screen uses CSS fonts, export uses canvas font rendering, and PDF reconstruction uses Helvetica.
- The `0.8em` baseline offset is a **universal heuristic** used across PDFTextLayer, textUtils, and export. Changing it in one place without the others will cause vertical drift.
- `fontSize` in `NativeTextEdit` is in **PDF units** (not pixels). It gets multiplied by `viewportScale` when rendering to DOM (`PDFTextLayer.tsx` L93, L153, L170).

**NEVER:**
- Assume exported PDF will use the same font as screen rendering.
- Change the `0.8em` baseline offset in isolation — it appears in `PDFTextLayer.tsx` L102/L160, `textUtils.ts` L113, and `exportUtils.ts` L504.

---

## 3. Export Safety Rules

### 3.1 Export Pipeline (saveDocument)

The `saveDocument()` function in `exportUtils.ts` L11–171 follows this exact order:

```
1. Create new PDFDocument
2. For each page:
   a. Copy/create base page (PDF source → copyPages, image → embedPng/Jpg, blank → addPage)
   b. Check for annotations (objects, nativeTextEdits, paths)
   c. If annotations exist:
      i.   Create overlay canvas at scale=2
      ii.  If effects exist: rasterize background onto overlay canvas (pdf.js render or image draw)
      iii. Draw native text edits (viewport-converted white rect + text)
      iv.  Draw annotations via drawPageAnnotationsToCanvas() — paths first, then objects in array order
      v.   Effects (type='effect') apply applyAdjustmentPipeline() to entire canvas at their position in z-order
   d. Convert overlay canvas to PNG data URL → embed as image → draw over base page
3. Save and download
```

**Rules:**
- The overlay canvas dimensions are `pageWidth * scale` × `pageHeight * scale` with `ctx.scale(scale, scale)` applied (`exportUtils.ts` L97–104). This means all drawing coordinates are in PDF-unit space, not pixel space.
- Effect objects (`type === 'effect'`) are interleaved with regular objects during `drawPageAnnotationsToCanvas()` — they apply `applyAdjustmentPipeline()` to the **entire current canvas context** at their z-position (`exportUtils.ts` L212–216). The order matters.
- The overlay is rasterized to PNG and embedded as a full-page image on top of the base PDF page. This is a **destructive flatten** — the overlay is not vector data in the output PDF.

**NEVER:**
- Change the annotation rendering order (paths → objects interleaved with effects) without updating both `drawPageAnnotationsToCanvas()` AND the Konva rendering in `CanvasLayer.tsx`.
- Skip the `scale=2` factor — it ensures export DPI matches screen rendering at 2x.
- Embed the overlay without checking `hasAnnotations` — empty overlays waste file size and may produce blank-white pages if the canvas has no content.

---

### 3.2 Flattened Export (saveDocumentFlattened)

`saveDocumentFlattened()` (`exportUtils.ts` L528–549) renders **each page fully to a JPEG blob** via `renderPageToBlob()`, then embeds each as a new page in a fresh PDF. This is a lossy, fully-rasterized export.

**Rules:**
- `renderPageToBlob()` applies the same layered rendering: PDF background → nativeTextEdits → annotations (`exportUtils.ts` L627–636).
- The `quality` parameter only affects JPEG compression, not rendering resolution (which is always `scale=2`).
- Uses `ctx.save()` / `ctx.scale(scale, scale)` / `ctx.restore()` to ensure annotation coordinates are in logical (non-scaled) space.

---

### 3.3 Error Handling & Fallback

| Scenario | Behavior | Source |
|----------|----------|--------|
| PDF render fails | Canvas filled with white, dimensions fall back to 595×842 | `exportUtils.ts` L590–596 |
| Image load fails in `drawObjectToCanvas` | Silently resolves (no hang), error logged | `exportUtils.ts` L328–332 |
| Object draw throws | Caught per-object, `ctx.restore()` called to prevent context corruption | `exportUtils.ts` L484–487 |
| PDF load fails | Alert shown to user, error logged | `pdfOps.ts` L95–98 |

**NEVER:**
- Let a single object failure abort the entire export — errors must be caught per-object.
- Forget `ctx.restore()` in error handlers — leaked canvas state corrupts all subsequent draws.

---

### 3.4 Memory Protection

- `URL.createObjectURL()` is always paired with `URL.revokeObjectURL()` after the download link is clicked (`pdfOps.ts` L44; `exportUtils.ts` L164–165).
- Buffer canvases are created per-page during export and are garbage-collected after the function scope ends.
- History is capped: `pdfStore` keeps last 100 patches (`pdfStore.ts` L527), `editorStore` keeps last 50 snapshots (`editorStore.ts` L741).

**NEVER:**
- Create `objectURL` without a corresponding `revokeObjectURL`.
- Remove the history cap without implementing a memory-safe alternative.

---

## 4. Rendering Safety Rules

### 4.1 Viewport Consistency

- `PDFPage.tsx` renders the background at `scale=2` (fixed) via a buffer canvas, then sizes the wrapper at `baseViewport.width * store.scale` (`PDFPage.tsx` L109–113).
- `PDFTextLayer` receives `scale` from props and uses it to calculate viewport (`PDFTextLayer.tsx` L27). This MUST match the store's `scale` value.
- `CanvasLayer` receives explicit `width`, `height`, `scale` and applies `scaleX={scale}` / `scaleY={scale}` to the Konva Stage (`CanvasLayer.tsx` L107–108).

**Rules:**
- All three layers (Background, TextLayer, CanvasLayer) must use the **same** `scale` value for a given page render. A mismatch causes visual desync.
- Internal Konva coordinates are in **unzoomed** (logical) space: `unzoomedWidth = width / scale` (`CanvasLayer.tsx` L28–29).

**NEVER:**
- Apply `scale` twice (e.g., scaling both the Stage and individual objects by the store scale).
- Use different scale values for different layers of the same page.

---

### 4.2 Transform Pipeline (Export)

Object transforms in `drawObjectToCanvas()` (`exportUtils.ts` L230–488) follow this exact sequence:

```
1. ctx.save()
2. Check visibility (skip if hidden)
3. Set globalAlpha
4. Translate to center (cx, cy)
5. Apply flip (scaleX/scaleY = -1)
6. Apply skew (tan-based transform)
7. Translate back (-cx, -cy)
8. Draw shape/text/image at (obj.x, obj.y)
9. ctx.restore()
```

**Rules:**
- Rotation is NOT currently applied in the export transform pipeline (the `rotation` property exists on objects but the `ctx.rotate()` call is absent in `drawObjectToCanvas`). This is a **known limitation** — do not assume rotation works in export.
- The center-translate pattern (`translate(cx, cy) → transform → translate(-cx, -cy)`) means all transforms are relative to the object's center.
- SVG path shapes (heart, cloud, etc.) use a **24×24 viewbox** convention — they are scaled by `width/24` and `height/24` (`exportUtils.ts` L444–446).

**NEVER:**
- Add rotation to the export transform without also verifying it matches Konva's rotation behavior.
- Change the path shape viewbox assumption (24×24) without updating both `PDFObjectRenderer.tsx` and `exportUtils.ts`.

---

### 4.3 DOM Overdraw Prevention

- `CanvasLayer` uses `pointer-events: none` so clicks pass through to underlying layers (`CanvasLayer.tsx` L101).
- `PDFTextLayer` selectively enables `pointer-events: auto` on individual text spans only when in `native-text` editing mode (`PDFTextLayer.tsx` L139, L202).
- `BackgroundLayer` is always `pointer-events: none` (`PDFPage.tsx` L51).

**NEVER:**
- Enable pointer-events on the CanvasLayer in the home panel — it would block text selection and page interaction.

---

## 5. Text Editing Integrity Rules

### 5.1 Span-Level Mapping

- Each text span is uniquely identified by its positional ID: `text-{pageNumber}-{tx[4].toFixed(2)}-{tx[5].toFixed(2)}`.
- `nativeTextEdits` is a `Record<string, NativeTextEdit>` keyed by this ID (`pdfStore.ts` L262).
- Edits store the **original** PDF coordinates (`x`, `y` from `transform[4]`, `transform[5]`), not viewport-transformed values.

**Rules:**
- The mapping between text item IDs and `nativeTextEdits` keys is the **single link** between rendered text and stored edits. Breaking this mapping orphans edits.
- `originalRef` stores the raw pdf.js text item for reference but MUST NOT be relied upon for positioning (use the stored `x`, `y` instead).

---

### 5.2 Non-Destructive Editing

- Original PDF bytes are stored in `pdfStore.originalPdfBytes` and NEVER modified.
- All edits are stored as overlays (`nativeTextEdits`, `objects`, `paths`) on the `PageState`.
- The original PDF structure is preserved until final export, which copies pages and overlays annotations.

**Rules:**
- Edits are reversible via `deleteNativeTextEdit()` or `clearNativeTextEdits()` at any time before export.
- `undo()` / `redo()` in pdfStore uses diff-based patches (microdiff) to restore previous states without needing the original bytes.
- Export is the only destructive operation — it flattens overlays into rasterized images on the output PDF.

**NEVER:**
- Modify `originalPdfBytes` in place.
- Remove `nativeTextEdits` from `PageState` without providing an alternative storage mechanism.
- Assume edits can be "un-exported" — once flattened, they cannot be separated from the base page.

---

## 6. Adjustment Pipeline Rules

### 6.1 Effect Architecture

Adjustment layers are `PDFObject` instances with `type: 'effect'` and `effectParams: Record<string, any>` (`pdfStore.ts` L124–126).

They participate in the object z-order: an effect applies to **everything below it** in the `objects` array.

### 6.2 Pipeline Stages

The unified adjustment pipeline in `effectUtils.ts` processes pixels in this **fixed order**:

```
1. Levels      → blackPoint/whitePoint normalization (0–255 range)
2. Gamma       → midtone curve (pow(level, 1/gamma), gamma clamped to ≥0.01)
3. Contrast    → expand/compress around 0.5 midpoint
4. Threshold   → optional binary mode
5. Invert      → optional color inversion
6. Grayscale   → optional luminance conversion (0.299R + 0.587G + 0.114B)
```

This pipeline is applied identically in:
- **Export**: via `applyAdjustmentPipeline()` on the 2D canvas context (`exportUtils.ts` L215)
- **Live preview**: via Konva custom filter using `processImageData()` (`effectUtils.ts` L95`)

**Rules:**
- A LUT (lookup table) is precomputed for all 256 input values to avoid per-pixel `pow()` calls (`effectUtils.ts` L39–73`).
- The `isNoop()` check (`effectUtils.ts` L133–141) short-circuits when all params are at defaults — this MUST be preserved for performance.
- `gamma` is clamped to `Math.max(gamma, 0.01)` to prevent `Infinity` from `pow(x, 1/0)` (`effectUtils.ts` L52`).
- The alpha channel (`data[i+3]`) is explicitly **untouched** (`effectUtils.ts` L112`).

**NEVER:**
- Change the pipeline stage order — it produces visually different results.
- Remove the gamma floor clamp (0.01) — it prevents `Infinity` and `NaN` propagation.
- Apply effects to the alpha channel.
- Skip the `isNoop()` check — it prevents unnecessary `getImageData()`/`putImageData()` calls on large canvases.

### 6.3 Effect Stacking in Rendering

In `CanvasLayer.tsx` (L61–97), effects are rendered as **nested wrappers**:

```
<AdjustmentGroup effect3>
  <AdjustmentGroup effect2>
    <Group>
      <Background />
      <Object1 />
    </Group>
    <Object2 />
  </AdjustmentGroup>
  <Object3 />
</AdjustmentGroup>
```

In export (`drawPageAnnotationsToCanvas`, `exportUtils.ts` L207–221), this is a **linear loop** where effects call `applyAdjustmentPipeline()` on the accumulated canvas. These two approaches MUST produce the same visual result.

**NEVER:**
- Add a new rendering path for effects without ensuring it matches both the Konva nesting and the export linear application.

---

## 7. Performance Safeguards

### 7.1 Canvas Limits

- Export canvas dimensions: `pageWidth * 2` × `pageHeight * 2` (scale=2). For a standard A4 page (595×842), this is **1190×1684 pixels**.
- Konva Stage in CanvasLayer uses the same logical dimensions scaled by the viewport scale.

**Rules:**
- Canvas `width` × `height` must not exceed browser limits (typically 16,384 × 16,384 or ~268 million pixels total). For pages larger than ~8000pt, consider reducing the export scale.

### 7.2 History Caps

| Store | Cap | Implementation |
|-------|-----|---------------|
| `pdfStore` | 100 history patches | `.slice(-100)` on `past` array (`pdfStore.ts` L527) |
| `editorStore` | 50 page snapshots | `.slice(-50)` on `past` array (`editorStore.ts` L741) |
| Recent colors | 9 entries | `.slice(0, 9)` (`editorStore.ts` L319) |
| Recent text styles | 3 entries | `.slice(0, 3)` (`editorStore.ts` L349) |

**NEVER:**
- Remove these caps without implementing memory-safe alternatives (e.g., LRU eviction, compression).

### 7.3 Batching Expectations

- Object mutations in `pdfStore` call `saveToHistory()` after EACH mutation (add, update, delete, reorder). This means rapid sequential edits create many history entries.
- `editorStore.updateObject()` does NOT call `saveToHistory()` — it is called on every drag/transform move for performance. History is saved on `mouseUp` / `transformEnd` events.

### 7.4 Thumbnail Caching

- Thumbnails are cached in IndexedDB via `thumbnailCache.ts` using keys: `pdf-thumb-{pdfName}-{pageIndex}-{width}`.
- `clear()` wipes the **entire** idb-keyval default store — this is destructive and will also clear PDF bytes and store state.

> [!CAUTION]
> `ThumbnailCache.clear()` calls `idb-keyval.clear()` which destroys ALL data in the default store, including persisted PDF bytes and state. Use only for full reset scenarios.

---

## 8. Extension Safety Rules

### 8.1 Safe Extension Points

| Extension | How to Add | Constraints |
|-----------|-----------|-------------|
| New PDFObject type | Add to `PDFObject.type` union (`pdfStore.ts` L29), add renderer branch in `PDFObjectRenderer.tsx`, add export branch in `drawObjectToCanvas()` | Must handle `visible`, `opacity`, `flipX/Y`, `skewX/Y`. Must call `ctx.save()`/`ctx.restore()` in export. |
| New tool | Add to `ToolType` union (`pdfStore.ts` L7), add to `DEFAULT_TOOL_PREFERENCES` in both stores, add handler in `EditorCanvas.tsx` | Must not conflict with existing keyboard shortcuts. |
| New adjustment param | Add to `AdjustmentParams` interface, update `DEFAULT_ADJUSTMENT_PARAMS`, `resolveParams()`, `buildLUT()`, and `isNoop()` in `effectUtils.ts` | Must go into the LUT if it's a per-channel operation. Must not modify alpha. |
| New page property | Add to `PageState` interface (`pdfStore.ts` L186–263) | Must be optional (backward-compatible). Must not break `partialize` or IndexedDB serialization. Must be JSON-serializable. |

### 8.2 Forbidden Modification Zones

> [!WARNING]
> The following areas are **critical infrastructure**. Modifications require extreme care and full regression testing.

| Zone | Files | Why |
|------|-------|-----|
| Buffer cloning logic | `pdfOps.ts` L64, `exportUtils.ts` L21 | Removing `.slice(0)` causes ArrayBuffer detachment errors |
| Coordinate conversion | `textUtils.ts` L26–161, `PDFTextLayer.tsx` L50–60, `exportUtils.ts` L493–526 | Three-way dependency: DOM overlay, export, and PDF reconstruction must stay aligned |
| History/diff system | `pdfStore.ts` L410–572 | Changing patch structure breaks undo/redo for all existing sessions |
| `partialize` config | `pdfStore.ts` L1131–1137 | Adding non-serializable fields (DOM nodes, functions, Promises) to partialize will crash IndexedDB persistence |
| Effect pipeline order | `effectUtils.ts` L39–73 | Reordering stages changes visual output globally |
| Text item ID format | `PDFTextLayer.tsx` L55 | Changing format orphans all existing native text edits |

### 8.3 Store Interaction Contract

```
editorStore ──(reads on init)──► pdfStore.pages
editorStore ──(writes on commit)──► pdfStore.updatePage()
editorStore.commitNativeTextEdits() ──► pdfStore.updateNativeTextEdit()
exportUtils ──(reads)──► pdfStore.pages, pdfStore.originalPdfBytes
```

**Rules:**
- `editorStore` MUST NOT subscribe to `pdfStore.pages` reactively while editing — it works on a detached clone.
- `pdfStore` knows nothing about `editorStore`. The dependency is one-directional.
- Export functions receive data as parameters — they do not import stores directly (except for types).

---

## 9. Assumptions & Known Limitations

These are documented explicitly because they may affect future development:

| Assumption | Impact |
|-----------|--------|
| Baseline offset is always `0.8em` | Works for most Latin fonts; may be wrong for CJK, Arabic, or fonts with unusual metrics |
| `applyNativeTextEdits()` always uses `StandardFonts.Helvetica` | Exported PDF text will not match the original font |
| Object rotation is NOT applied in export `drawObjectToCanvas()` | Rotated objects will appear un-rotated in exported PDFs |
| `ThumbnailCache.clear()` wipes entire idb-keyval store | Must be isolated if other data shares the store |
| Smart shape detection tolerance is hardcoded at 15px | May be too tight or loose at different zoom levels |
| Text item IDs depend on `toFixed(2)` of coordinates | Two text items at nearly identical positions could collide |

---

## 10. Validation Checklist

After any change, verify:

- [ ] Export pipeline produces correct output (test with multi-page PDF containing text edits, shapes, and effects)
- [ ] Native text edits appear at correct positions in both DOM overlay and exported PDF
- [ ] Undo/redo works for all object types and native text edits
- [ ] No ArrayBuffer detachment errors during export or PDF load
- [ ] Canvas `save()`/`restore()` calls are balanced in all export code paths
- [ ] Effect pipeline order matches between Konva preview and export
- [ ] Z-order is consistent between CanvasLayer and export rendering
- [ ] Memory: URL.createObjectURL paired with revokeObjectURL
- [ ] History caps are not exceeded
- [ ] IndexedDB persistence does not include non-serializable data
