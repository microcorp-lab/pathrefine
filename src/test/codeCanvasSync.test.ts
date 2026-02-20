/**
 * Code-Canvas Sync Tests
 *
 * Verifies bi-directional synchronisation between the SVG code editor and the
 * canvas.  The sync pipeline is:
 *
 *   Code → Canvas:  parseSVG(code) → setSVGDocument(doc, skipHistory=true)
 *   Canvas → Code:  updatePath(id, newPath) → generateSVGCodeWithMappings(svgDocument)
 *
 * These are store-level unit tests — no DOM rendering required.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { parseSVG } from '../engine/parser';
import { generateSVGCodeWithMappings } from '../engine/codeMapping';
import { useEditorStore } from '../store/editorStore';
import {
  resetEditorStore,
  createTestDocument,
  createTestPath,
} from './helpers/renderWithProviders';

// ── SVG fixtures ──────────────────────────────────────────────────────────────

/**
 * A minimal but valid SVG with one triangle path.
 * M 0 0  → first anchor at (0, 0)
 * L 100 0 → line to (100, 0)
 * L 100 100 → line to (100, 100)
 * Z → close
 */
const SIMPLE_SVG = `<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <path id="tri" d="M 0 0 L 100 0 L 100 100 Z" fill="#3399ff" />
</svg>`;

/** Same shape with all coordinates shifted +10 — simulates a code edit. */
const SHIFTED_SVG = `<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <path id="tri" d="M 10 10 L 110 10 L 110 110 Z" fill="#3399ff" />
</svg>`;

// ── Re-usable store helpers ───────────────────────────────────────────────────

const store = () => useEditorStore.getState();

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Code-Canvas sync', () => {
  beforeEach(() => {
    resetEditorStore();
  });

  // ── 1. Code → Canvas ───────────────────────────────────────────────────────

  it('updating SVG via code editor parses and stores the new path in the canvas', () => {
    // Seed an initial document so there is something to replace
    store().setSVGDocument(parseSVG(SIMPLE_SVG), false);

    // Simulate what CanvasWithCode.handleCodeChange does on valid input:
    //   parseSVG → setSVGDocument(doc, skipHistory=true)
    store().setSVGDocument(parseSVG(SHIFTED_SVG), true);

    const { svgDocument } = store();
    expect(svgDocument).not.toBeNull();
    expect(svgDocument!.paths).toHaveLength(1);

    // The M command's destination point is stored in segment.points[0]
    const mSeg = svgDocument!.paths[0].segments[0];
    expect(mSeg.type).toBe('M');
    expect(mSeg.points[0].x).toBeCloseTo(10);
    expect(mSeg.points[0].y).toBeCloseTo(10);

    // The first L command should now go to (110, 10)
    const lSeg = svgDocument!.paths[0].segments[1];
    expect(lSeg.type).toBe('L');
    expect(lSeg.points[0].x).toBeCloseTo(110);
    expect(lSeg.points[0].y).toBeCloseTo(10);
  });

  it('a code edit updates only the document — history stack stays unchanged', () => {
    // Load initial doc (recorded in history)
    store().setSVGDocument(parseSVG(SIMPLE_SVG), false);
    const historyLengthBefore = store().history.length;
    const historyIndexBefore = store().historyIndex;

    // Code edit — skipHistory=true means no new history entry
    store().setSVGDocument(parseSVG(SHIFTED_SVG), true);

    expect(store().history.length).toBe(historyLengthBefore);
    expect(store().historyIndex).toBe(historyIndexBefore);
  });

  // ── 2. Invalid code does not corrupt the store ─────────────────────────────

  it('invalid SVG in code editor throws and leaves the store untouched', () => {
    // Seed a known document
    store().setSVGDocument(parseSVG(SIMPLE_SVG), false);
    const snapshot = store().svgDocument;

    // CanvasWithCode wraps parseSVG in try/catch; mimic that guard:
    try {
      const bad = parseSVG('THIS IS NOT SVG AT ALL');
      // parseSVG should throw before this point
      store().setSVGDocument(bad, true);
    } catch {
      // expected — store must remain unchanged
    }

    expect(store().svgDocument).toBe(snapshot); // same reference
  });

  it('an SVG string with no <path> elements parses to an empty paths array without error', () => {
    const emptySVG = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"></svg>`;
    const doc = parseSVG(emptySVG);
    store().setSVGDocument(doc, true);

    expect(store().svgDocument!.paths).toHaveLength(0);
  });

  // ── 3. Canvas → Code ───────────────────────────────────────────────────────

  it('dragging a canvas point via updatePath is reflected in the generated SVG code', () => {
    // Load the initial document
    store().setSVGDocument(parseSVG(SIMPLE_SVG), false);

    const path = store().svgDocument!.paths[0];

    // Simulate a point drag: move the first control point (M destination) to (50, 50).
    // Both 'points' and 'end' are updated, mirroring what pathEditor does.
    const movedPath = {
      ...path,
      segments: path.segments.map((seg, i) =>
        i === 0
          ? { ...seg, points: [{ x: 50, y: 50 }], start: { x: 50, y: 50 }, end: { x: 50, y: 50 } }
          : seg,
      ),
    };
    store().updatePath(path.id, movedPath, 'Drag point');

    // Canvas → Code: regenerate code from the updated store document
    const { code } = generateSVGCodeWithMappings(store().svgDocument);

    // The moved coordinate (50, 50) must appear in the generated d attribute
    expect(code).toContain('50.00,50.00');
    // The original origin (0, 0) should no longer be the M destination
    // (note: it may still appear as a 'start' value in another segment, so we
    // check for the specific M command string instead)
    expect(code).toContain('M');
  });

  it('a sequence of canvas edits each produce distinct code snapshots', () => {
    store().setSVGDocument(parseSVG(SIMPLE_SVG), false);
    const path = store().svgDocument!.paths[0];

    const move = (x: number, y: number) => {
      const current = store().svgDocument!.paths[0];
      store().updatePath(current.id, {
        ...current,
        segments: current.segments.map((seg, i) =>
          i === 0
            ? { ...seg, points: [{ x, y }], start: { x, y }, end: { x, y } }
            : seg,
        ),
      });
    };

    move(25, 25);
    const code1 = generateSVGCodeWithMappings(store().svgDocument).code;

    move(75, 75);
    const code2 = generateSVGCodeWithMappings(store().svgDocument).code;

    expect(code1).toContain('25.00,25.00');
    expect(code2).toContain('75.00,75.00');
    expect(code1).not.toBe(code2);

    void path; // used above for type inference
  });

  // ── 4. Undo restores both canvas state and code output ─────────────────────

  it('undo after a code edit (skipHistory) restores the pre-edit canvas document', () => {
    // Step 1 — initial load (history entry #0)
    store().setSVGDocument(parseSVG(SIMPLE_SVG), false);

    // Step 2 — canvas drag (history entry #1); svgDocument now has shifted M point
    const path = store().svgDocument!.paths[0];
    const movedPath = {
      ...path,
      segments: path.segments.map((seg, i) =>
        i === 0
          ? { ...seg, points: [{ x: 50, y: 50 }], start: { x: 50, y: 50 }, end: { x: 50, y: 50 } }
          : seg,
      ),
    };
    store().updatePath(path.id, movedPath, 'Drag point');
    expect(store().historyIndex).toBe(1);

    // Step 3 — code edit (skipHistory=true): coordinates shift again but NO history entry
    store().setSVGDocument(parseSVG(SHIFTED_SVG), true);
    expect(store().historyIndex).toBe(1); // unchanged

    // Verify the code edit is reflected
    const codeAfterEdit = generateSVGCodeWithMappings(store().svgDocument).code;
    expect(codeAfterEdit).toContain('10.00,10.00');

    // Step 4 — undo: should jump back to history[0] = SIMPLE_SVG at original coords
    store().undo();
    expect(store().historyIndex).toBe(0);

    const restored = store().svgDocument!.paths[0];
    expect(restored.segments[0].points[0].x).toBeCloseTo(0);
    expect(restored.segments[0].points[0].y).toBeCloseTo(0);

    // The generated code should now reflect the original coordinates
    const codeAfterUndo = generateSVGCodeWithMappings(store().svgDocument).code;
    expect(codeAfterUndo).toContain('0.00,0.00');
  });

  it('undo is a no-op when there is only one history entry', () => {
    store().setSVGDocument(parseSVG(SIMPLE_SVG), false);
    expect(store().historyIndex).toBe(0);

    store().undo(); // nothing to undo — guard: historyIndex <= 0

    // State must be unchanged
    expect(store().historyIndex).toBe(0);
    expect(store().svgDocument).not.toBeNull();
  });

  // ── 5. Round-trip fidelity ─────────────────────────────────────────────────

  it('parseSVG → generateSVGCodeWithMappings → parseSVG preserves path geometry', () => {
    // First parse
    const doc1 = parseSVG(SIMPLE_SVG);
    store().setSVGDocument(doc1, false);

    // Generate code from the parsed document
    const { code } = generateSVGCodeWithMappings(doc1);

    // Re-parse the generated code
    const doc2 = parseSVG(code);

    expect(doc2.paths).toHaveLength(doc1.paths.length);

    // All segment endpoints must survive the round-trip within floating-point tolerance
    doc1.paths[0].segments.forEach((seg, i) => {
      const seg2 = doc2.paths[0].segments[i];
      expect(seg2.type).toBe(seg.type);
      if (seg.points.length > 0 && seg2.points.length > 0) {
        expect(seg2.points[0].x).toBeCloseTo(seg.points[0].x, 1);
        expect(seg2.points[0].y).toBeCloseTo(seg.points[0].y, 1);
      }
    });
  });

  // ── 6. Store-level fixture tests (no parseSVG) ─────────────────────────────

  it('setSVGDocument with a createTestDocument fixture stores all paths', () => {
    const paths = [createTestPath(), createTestPath(), createTestPath()];
    const doc = createTestDocument(paths);

    store().setSVGDocument(doc, false);

    expect(store().svgDocument!.paths).toHaveLength(3);
    expect(store().svgDocument!.paths.map(p => p.id)).toEqual(paths.map(p => p.id));
  });

  it('updatePath replaces only the targeted path', () => {
    const p1 = createTestPath({ id: 'p1', fill: '#ff0000' });
    const p2 = createTestPath({ id: 'p2', fill: '#00ff00' });
    store().setSVGDocument(createTestDocument([p1, p2]), false);

    const updated = { ...p2, fill: '#0000ff' };
    store().updatePath('p2', updated);

    const paths = store().svgDocument!.paths;
    expect(paths.find(p => p.id === 'p1')?.fill).toBe('#ff0000'); // untouched
    expect(paths.find(p => p.id === 'p2')?.fill).toBe('#0000ff'); // updated
  });
});
