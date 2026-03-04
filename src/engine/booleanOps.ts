/**
 * Boolean path operations engine
 *
 * Implements subtract (difference) for SVG paths using polygon clipping.
 * Paths are rasterised to dense polylines, the boolean op is applied on 
 * those polylines, and the result is converted back to an SVG path d-string
 * (straight-line segments). A simplification pass reduces the point count.
 *
 * Complexity stays O(n log n) in the number of sampled points.
 */

import polygonClipping from 'polygon-clipping';
import type { MultiPolygon, Polygon, Ring } from 'polygon-clipping';

const { difference } = polygonClipping;
import simplify from 'simplify-js';
import type { Path } from '../types/svg';
import { samplePathToDenseCloud } from './pathSmoothing';
import { parsePathData } from './parser';

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Dense-sample a Path into a closed polygon Ring */
function pathToRing(path: Path): Ring {
  const pts = samplePathToDenseCloud(path, 'adaptive');
  if (pts.length < 3) return [];
  const ring: Ring = pts.map(p => [p.x, p.y] as [number, number]);
  // Ensure closed
  const [fx, fy] = ring[0];
  const [lx, ly] = ring[ring.length - 1];
  if (fx !== lx || fy !== ly) ring.push([fx, fy]);
  return ring;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Convert a MultiPolygon back to an SVG `d` string.
 * Each Polygon becomes a separate sub-path (M … L … Z).
 * Holes (additional rings within a Polygon) are included – combine with
 * fill-rule="evenodd" for correct rendering.
 */
function multiPolygonToD(mp: MultiPolygon, simplifyTolerance: number): string {
  const parts: string[] = [];

  for (const polygon of mp) {
    for (let ri = 0; ri < polygon.length; ri++) {
      const raw = polygon[ri];
      if (raw.length < 3) continue;

      // Simplify to reduce output path complexity
      const pts = raw.map(([x, y]) => ({ x, y }));
      const simplified = simplify(pts, simplifyTolerance, true);
      if (simplified.length < 3) continue;

      parts.push(`M ${round2(simplified[0].x)} ${round2(simplified[0].y)}`);
      for (let i = 1; i < simplified.length; i++) {
        // Skip closing duplicate (simplify-js sometimes keeps it)
        const p = simplified[i];
        const prev = simplified[i - 1];
        if (round2(p.x) === round2(prev.x) && round2(p.y) === round2(prev.y)) continue;
        parts.push(`L ${round2(p.x)} ${round2(p.y)}`);
      }
      parts.push('Z');
    }
  }

  return parts.join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface BooleanOpResult {
  /** Original path id */
  pathId: string;
  /** New d string after the operation (empty string = path was fully cut away) */
  newD: string;
  /** True when the path was completely inside the cutter and should be deleted */
  deleted: boolean;
}

export interface SubtractOptions {
  /**
   * Simplification tolerance in user-units applied to the output rings.
   * Higher = fewer points, lower = more faithful shape. Default 0.3.
   */
  simplifyTolerance?: number;
}

/**
 * Subtract `cutterPathId` from each path in `targetPathIds`.
 *
 * @param allPaths      Full path list from the document
 * @param cutterPathId  The path that acts as the "cookie cutter"
 * @param targetPathIds Paths that will have the cutter subtracted from them
 * @param options       Optional tuning
 * @returns Array of per-path results (only for paths that were actually changed)
 */
export function subtractPaths(
  allPaths: Path[],
  cutterPathId: string,
  targetPathIds: string[],
  options: SubtractOptions = {}
): BooleanOpResult[] {
  const { simplifyTolerance = 0.3 } = options;

  const cutterPath = allPaths.find(p => p.id === cutterPathId);
  if (!cutterPath) return [];

  const cutterRing = pathToRing(cutterPath);
  if (cutterRing.length < 3) return [];

  // polygon-clipping expects Polygon | MultiPolygon
  const cutterPoly: Polygon = [cutterRing];

  const results: BooleanOpResult[] = [];

  for (const pathId of targetPathIds) {
    if (pathId === cutterPathId) continue;

    const path = allPaths.find(p => p.id === pathId);
    if (!path) continue;

    const targetRing = pathToRing(path);
    if (targetRing.length < 3) continue;

    const targetPoly: Polygon = [targetRing];

    try {
      const resultMP = difference(targetPoly, cutterPoly);

      if (resultMP.length === 0) {
        // Completely inside cutter → delete
        results.push({ pathId, newD: '', deleted: true });
      } else {
        const newD = multiPolygonToD(resultMP, simplifyTolerance);
        if (!newD) {
          results.push({ pathId, newD: '', deleted: true });
        } else {
          results.push({ pathId, newD, deleted: false });
        }
      }
    } catch (_err) {
      // If polygon clipping throws (degenerate geometry), leave path unchanged
    }
  }

  return results;
}

/**
 * Build a Path object from a boolean-op result.
 * Re-parses segments from the new d string so everything stays consistent.
 */
export function applyBooleanResult(
  original: Path,
  result: BooleanOpResult
): Path {
  if (result.deleted || !result.newD) {
    return { ...original, d: '', segments: [], visible: false };
  }
  const segments = parsePathData(result.newD);
  return {
    ...original,
    d: result.newD,
    segments,
    // Boolean-op outputs are polygons — evenodd works correctly for holes
    // We store a custom attribute via the existing fill fields; no need to
    // change fill since the stroke/fill come from the original path.
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: colour-based cutter detection
// ─────────────────────────────────────────────────────────────────────────────

/** Parse a CSS color string and return luminance (0 = black, 1 = white). */
function colorLuminance(colorStr: string | undefined): number {
  if (!colorStr) return 0.5;
  const s = colorStr.trim().toLowerCase();
  if (s === 'none' || s === 'transparent') return 1;
  if (s === 'black' || s === '#000' || s === '#000000') return 0;
  if (s === 'white' || s === '#fff' || s === '#ffffff') return 1;

  // Try #rrggbb or #rgb
  const hex6 = s.match(/^#([0-9a-f]{6})$/);
  if (hex6) {
    const n = parseInt(hex6[1], 16);
    const r = ((n >> 16) & 0xff) / 255;
    const g = ((n >> 8) & 0xff) / 255;
    const b = (n & 0xff) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const hex3 = s.match(/^#([0-9a-f]{3})$/);
  if (hex3) {
    const r = parseInt(hex3[1][0] + hex3[1][0], 16) / 255;
    const g = parseInt(hex3[1][1] + hex3[1][1], 16) / 255;
    const b = parseInt(hex3[1][2] + hex3[1][2], 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  // fallback
  return 0.5;
}

/**
 * Suggest the most likely cutter path by finding the darkest-filled path.
 * Ties are broken by z-order (topmost wins).
 */
export function suggestCutterPath(paths: Path[]): string | null {
  if (paths.length === 0) return null;

  let best: Path | null = null;
  let bestLum = Infinity;

  for (const p of [...paths].reverse()) { // iterate top-to-bottom z for tie-breaking
    const lum = colorLuminance(p.fill);
    if (lum < bestLum) {
      bestLum = lum;
      best = p;
    }
  }

  return best ? best.id : null;
}
