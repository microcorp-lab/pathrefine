import type { Path, SVGDocument, BezierSegment } from '../types/svg';
import { calculatePathLength } from './pathMath';

// ─── Geometric helpers ────────────────────────────────────────────────────────

/**
 * Split path segments into individual sub-paths at each new M command.
 * Used to analyze compound (merged) paths correctly.
 */
function splitIntoSubpathSegments(segments: BezierSegment[]): BezierSegment[][] {
  const subpaths: BezierSegment[][] = [];
  let current: BezierSegment[] = [];
  for (const seg of segments) {
    if (seg.type === 'M' && current.length > 0) {
      subpaths.push(current);
      current = [];
    }
    current.push(seg);
  }
  if (current.length > 0) subpaths.push(current);
  return subpaths.length > 0 ? subpaths : [segments];
}

/** Count anchor points (M, L, C endpoints) in a segment array */
function countAnchorPointsInSegments(segs: BezierSegment[]): number {
  return segs.filter(seg =>
    seg.type === 'M' || seg.type === 'L' || (seg.type === 'C' && seg.points.length > 0)
  ).length;
}

/** Axis-aligned bounding box of a set of segments */
function computeBoundingBox(segs: BezierSegment[]): { w: number; h: number; diagonal: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const seg of segs) {
    const pts = [seg.start, seg.end, ...seg.points];
    for (const pt of pts) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
  }
  if (!isFinite(minX)) return { w: 0, h: 0, diagonal: 0 };
  const w = maxX - minX;
  const h = maxY - minY;
  return { w, h, diagonal: Math.sqrt(w * w + h * h) };
}

/**
 * Fraction of anchor points that are geometrically redundant — i.e. the
 * direction change at that point is < 5° (nearly collinear).  Returns 0–1.
 * These are "ghost points" that cost bytes but add nothing visually.
 */
function computeCollinearFraction(segs: BezierSegment[]): number {
  const anchors = segs.filter(
    s => s.type === 'M' || s.type === 'L' || s.type === 'C'
  );
  if (anchors.length < 3) return 0;

  let redundant = 0;
  for (let i = 1; i < anchors.length - 1; i++) {
    const ax = anchors[i].end.x - anchors[i - 1].end.x;
    const ay = anchors[i].end.y - anchors[i - 1].end.y;
    const bx = anchors[i + 1].end.x - anchors[i].end.x;
    const by = anchors[i + 1].end.y - anchors[i].end.y;
    const lenA = Math.sqrt(ax * ax + ay * ay);
    const lenB = Math.sqrt(bx * bx + by * by);
    if (lenA < 0.1 || lenB < 0.1) continue;
    const dot = (ax * bx + ay * by) / (lenA * lenB);
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    if (angle < 0.087) redundant++; // < 5° = redundant midpoint
  }
  return redundant / (anchors.length - 2);
}

/**
 * Fraction of numeric coordinate values in a path d-string that carry
 * more than 2 significant decimal places (e.g. 67.670000 or 10.9834521).
 * Returns 0–1.  Excess precision wastes bytes and signals unclean export.
 */
function computePrecisionWaste(d: string): number {
  const matches = d.match(/-?[0-9]*\.[0-9]+/g);
  if (!matches || matches.length === 0) return 0;
  const waste = matches.filter(v => {
    const decimals = v.split('.')[1]?.replace(/0+$/, '') ?? '';
    return decimals.length > 2;
  }).length;
  return waste / matches.length;
}

// ─── Per-sub-path health score (0 = disaster, 100 = perfect) ─────────────────

/**
 * Score a single sub-path on a 0–100 scale.
 *
 *  100 = optimal (nothing to improve)
 *    0 = disaster (should run Smart Heal)
 *
 * Logic:
 *  1. Small closed shapes (≤ 8 anchor pts) are inherently minimal — score = 100.
 *     Penalising a hexagon or small quad for "too many points per unit length"
 *     is a category error: they're already at the theoretical minimum.
 *
 *  2. Larger shapes get a scale-normalised density score.  A 500px hero path
 *     is expected to be leaner than a 30px detail.  We normalise by √(diagonal/80)
 *     so paths 80 units across are the reference and larger/smaller get leniency.
 *
 *  3. Collinear penalty: each "ghost point" reduces the score proportionally.
 *     This catches Figma exports full of nearly-straight redundant anchors.
 */
function scoreSubpath(segs: BezierSegment[]): number {
  const len = calculatePathLength(segs);
  if (len < 0.001) return 100; // degenerate / zero-length

  const pts = countAnchorPointsInSegments(segs);
  const isClosed = segs[segs.length - 1]?.type === 'Z';

  // Small closed shapes can't be simplified further — pentagon, hexagon etc.
  if (pts <= 8 && isClosed) return 100;
  // Open tiny paths with very few points
  if (pts <= 3) return 100;

  const { diagonal } = computeBoundingBox(segs);

  // Very small shapes: exempt from strict density scoring.
  // A 20-unit detail mark with 10 points is fine.
  if (diagonal < 25 && pts <= 12) return 90;

  // Scale-normalised density.
  // Reference size: 80 units diagonal.  Larger → stricter, smaller → more lenient.
  const scaleFactor = Math.max(1, Math.sqrt(diagonal / 80));
  const normalizedDensity = (pts / len) * 100 / scaleFactor;

  // Density penalty: 0 at density ≤ 2, 100 at density ≥ 8
  const densityPenalty = Math.min(100, Math.max(0, (normalizedDensity - 2) / 6 * 100));

  // Collinear penalty: ghost points that add zero visual value
  const collinearFrac = computeCollinearFraction(segs);
  const collinearPenalty = collinearFrac * 100;

  // Weighted combination: density is the primary signal; redundant points compound it
  const health = 100 - densityPenalty * 0.65 - collinearPenalty * 0.35;
  return Math.max(0, Math.min(100, health));
}

// ─── Public interface ─────────────────────────────────────────────────────────

/**
 * Analysis results for a single path
 */
export interface PathAnalysis {
  pointCount: number;
  pathLength: number;
  pointDensity: number;
  complexity: 'optimal' | 'acceptable' | 'bloated' | 'disaster';
  estimatedSize: number;
  recommendations: string[];
}

/**
 * Analysis results for entire SVG document
 */
export interface DocumentAnalysis {
  totalPoints: number;
  totalPaths: number;
  estimatedFileSize: number;
  optimalFileSize: number;
  savingsPotential: number;
  /** 0 = perfect health, 100 = disaster.  Health% = 100 − averageComplexity. */
  averageComplexity: number;
  pathAnalyses: Map<string, PathAnalysis>;
}

/**
 * Count anchor points in a path (M, L, C endpoints).
 * This is the standard "point count" shown to users.
 */
export function countAnchorPoints(path: Path): number {
  return countAnchorPointsInSegments(path.segments);
}

/**
 * Analyze a single path for per-path properties and recommendations.
 */
export function analyzePath(path: Path): PathAnalysis {
  const pointCount = countAnchorPoints(path);
  const pathLength = calculatePathLength(path.segments);
  const pointDensity = pathLength > 0 ? (pointCount / pathLength) * 100 : 0;

  // Complexity tier is derived from the worst sub-path score
  const subpaths = splitIntoSubpathSegments(path.segments);
  let worstHealth = 100;
  for (const sp of subpaths) {
    const spLen = calculatePathLength(sp);
    if (spLen === 0) continue;
    const h = scoreSubpath(sp);
    if (h < worstHealth) worstHealth = h;
  }

  const complexity: PathAnalysis['complexity'] =
    worstHealth >= 80 ? 'optimal' :
    worstHealth >= 55 ? 'acceptable' :
    worstHealth >= 30 ? 'bloated' :
    'disaster';

  const estimatedSize = path.d.length + 50;

  const recommendations: string[] = [];
  if (worstHealth < 55) {
    const isClosed = path.d.trim().toUpperCase().endsWith('Z');
    const minPoints = isClosed ? 4 : 2;
    const targetPoints = Math.max(minPoints, Math.floor(pointCount * 0.4));
    if (pointCount > targetPoints) {
      recommendations.push(`Path has ${pointCount} points – could be reduced to ~${targetPoints} with Smart Heal`);
    }
  }
  if (computePrecisionWaste(path.d) > 0.3) {
    recommendations.push('Coordinates have excessive decimal precision – rounding would save bytes');
  }

  return { pointCount, pathLength, pointDensity, complexity, estimatedSize, recommendations };
}

/**
 * Analyze the entire SVG document.
 *
 * @param document       The SVG document to analyse.
 * @param actualSvgBytes Optional real byte-length of the exported SVG string.
 *                       When provided, file-size display is exact instead of estimated.
 */
export function analyzeDocument(document: SVGDocument, actualSvgBytes?: number): DocumentAnalysis {
  const pathAnalyses = new Map<string, PathAnalysis>();
  let totalPoints = 0;
  let totalEstimatedSize = 0;

  // Health accumulation — per sub-path, so score is invariant to path-merge ops.
  let healthSum = 0;
  let scoringUnitCount = 0;

  // Track global collinear fraction for realistic savings estimate.
  let globalCollinearSum = 0;
  let globalCollinearUnits = 0;

  document.paths.forEach(path => {
    const analysis = analyzePath(path);
    pathAnalyses.set(path.id, analysis);
    totalPoints += analysis.pointCount;
    totalEstimatedSize += analysis.estimatedSize;

    const subpaths = splitIntoSubpathSegments(path.segments);
    for (const sp of subpaths) {
      const spLen = calculatePathLength(sp);
      if (spLen === 0) continue; // ignore degenerate sub-paths

      const h = scoreSubpath(sp);
      healthSum += h;
      scoringUnitCount++;

      // Accumulate collinear fraction for savings estimate
      const cf = computeCollinearFraction(sp);
      globalCollinearSum += cf;
      globalCollinearUnits++;
    }
  });

  const avgHealth = scoringUnitCount > 0 ? healthSum / scoringUnitCount : 100;
  // averageComplexity: 0 = perfect, 100 = disaster (inverted health)
  const averageComplexity = 100 - avgHealth;

  // ── Savings estimate ──────────────────────────────────────────────────────
  // We compute two independent buckets and sum them:
  //
  //   1. Lossless (always achievable): whitespace removal, coordinate rounding,
  //      stripping metadata.  Consistently ~12% regardless of complexity.
  //
  //   2. Smart Heal (redundant-point removal): proportional to how many "ghost
  //      points" exist across all sub-paths.  Capped at 40% (empirically, even
  //      bloated Figma exports don't reduce below 60% of original via point
  //      removal alone without visible change).
  //
  const losslessFrac = 0.12;
  const avgCollinear = globalCollinearUnits > 0 ? globalCollinearSum / globalCollinearUnits : 0;
  const healFrac = Math.min(0.40, avgCollinear * 0.50);
  const totalSavingsFrac = Math.min(0.52, losslessFrac + healFrac);

  const reportedFileSize = actualSvgBytes ?? totalEstimatedSize;
  const optimalFileSize = Math.round(reportedFileSize * (1 - totalSavingsFrac));
  const savingsPotential = reportedFileSize - optimalFileSize;

  return {
    totalPoints,
    totalPaths: document.paths.length,
    estimatedFileSize: reportedFileSize,
    optimalFileSize,
    savingsPotential,
    averageComplexity,
    pathAnalyses,
  };
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export function getComplexityColor(complexity: PathAnalysis['complexity']): string {
  switch (complexity) {
    case 'optimal':    return '#10b981';
    case 'acceptable': return '#f59e0b';
    case 'bloated':    return '#f97316';
    case 'disaster':   return '#ef4444';
  }
}

export function getComplexityEmoji(complexity: PathAnalysis['complexity']): string {
  switch (complexity) {
    case 'optimal':    return '✨';
    case 'acceptable': return '⚡';
    case 'bloated':    return '⚠️';
    case 'disaster':   return '🚨';
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Health percentage (0–100, where 100 is perfect). */
export function getHealthPercentage(analysis: DocumentAnalysis): number {
  return Math.round(100 - analysis.averageComplexity);
}
