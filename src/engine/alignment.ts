import type { Path, PathAlignment, Point } from '../types/svg';
import { 
  getPointAtLength, 
  getTangentAtLength, 
  getNormalAtLength,
  rotatePoint,
  calculatePathLength
} from './pathMath';
import { parsePathData, segmentsToPathData } from './parser';
import { bakePathTransform } from './transforms';

/**
 * Seeded random number generator for reproducible randomness
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    // Simple LCG algorithm
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

/**
 * Scale a path uniformly
 */
export function scalePath(path: Path, scale: number, center?: Point): Path {
  if (scale === 1) return path;

  // Use (0,0) as default center if not provided
  const cx = center?.x || 0;
  const cy = center?.y || 0;

  const scalePt = (p: Point) => ({
    x: cx + (p.x - cx) * scale,
    y: cy + (p.y - cy) * scale,
  });

  const segments = path.segments.map(segment => ({
    ...segment,
    start: scalePt(segment.start),
    end: scalePt(segment.end),
    points: segment.points.map(scalePt),
  }));

  const newD = segmentsToPathData(segments);

  return {
    ...path,
    d: newD,
    segments,
  };
}

/**
 * Align multiple copies of a source path along a target path
 */
export function alignPathsToPath(
  sourcePath: Path,
  targetPath: Path,
  alignment: PathAlignment
): Path[] {
  // Bake transforms first so we work with world coordinates
  const bakedSource = bakePathTransform(sourcePath) as Path;
  const bakedTarget = bakePathTransform(targetPath) as Path;
  
  // Pre-calculate source center to avoid re-calculating in every iteration
  const sourceBounds = getPathBounds(bakedSource);
  const sourceCenter = {
    x: sourceBounds.centerX,
    y: sourceBounds.centerY,
  };

  const {
    repeatCount,
    scale,
    pathRangeStart,
    pathRangeEnd,
    randomRotation,
    randomScale,
    randomOffset,
    randomSeed,
  } = alignment;

  // Scale baked source path first (relative to its center)
  const scaledSource = scalePath(bakedSource, scale, sourceCenter);

  // Initialize seeded random for reproducible results
  const rng = randomSeed !== undefined ? new SeededRandom(randomSeed) : null;

  const results: Path[] = [];

  for (let i = 0; i < repeatCount; i++) {
    // Calculate position along target path (normalized 0-1)
    const t = repeatCount === 1 ? 0 : i / (repeatCount - 1);
    
    // The base position is determined by range and distribution
    let distOffset = pathRangeStart + t * (pathRangeEnd - pathRangeStart) + (alignment.offset || 0);
    
    // Clamp to 0-1 range (TODO: Wrap if target path is closed)
    distOffset = Math.max(0, Math.min(1, distOffset));

    // Apply randomization
    const rotationVariation = rng ? rng.range(-randomRotation, randomRotation) : 0;
    const scaleVariation = rng ? 1 + rng.range(-randomScale / 100, randomScale / 100) : 1;
    const offsetVariation = rng ? rng.range(-randomOffset, randomOffset) : 0;

    // Create modified alignment for this copy
    const copyAlignment: PathAlignment = {
      ...alignment,
      offset: distOffset,
      rotation: alignment.rotation + rotationVariation,
      perpOffset: alignment.perpOffset + offsetVariation,
    };

    // Apply scale variation if any (expensive for every copy, but necessary if randomized)
    let currentSource = scaledSource;
    if (scaleVariation !== 1) {
      currentSource = scalePath(scaledSource, scaleVariation, sourceCenter);
    }

    // Align this copy - passing sourceCenter to avoid recalculation
    const alignedPath = alignPathToPathInternal(currentSource, bakedTarget, copyAlignment, sourceCenter);

    // Generate unique ID for the new path
    alignedPath.id = `${sourcePath.id}-aligned-${i}`;

    results.push(alignedPath);
  }

  return results;
}

/**
 * Internal version that takes pre-calculated source center
 */
function alignPathToPathInternal(
  sourcePath: Path,
  targetPath: Path,
  alignment: PathAlignment,
  sourceCenter: Point
): Path {
  // 1. Get position and tangent on target path
  const offsetPoint = getPointAtLength(targetPath.segments, alignment.offset);
  const tangent = getTangentAtLength(targetPath.segments, alignment.offset);
  
  // Angle of the path tangent (in degrees)
  const angle = (Math.atan2(tangent.y, tangent.x) * 180) / Math.PI;

  // 2. Calculate perpendicular vector for offset
  const perp = { x: -tangent.y, y: tangent.x };
  const finalOffsetPoint = {
    x: offsetPoint.x + perp.x * alignment.perpOffset,
    y: offsetPoint.y + perp.y * alignment.perpOffset,
  };

  // 3. Apply rotation & translation
  const totalRotation = angle + alignment.rotation;
  
  // Calculate translation: Move source center to finalOffsetPoint
  const translation = {
    x: finalOffsetPoint.x - sourceCenter.x,
    y: finalOffsetPoint.y - sourceCenter.y,
  };

  const transformedSegments = sourcePath.segments.map((segment) => {
    const transformPt = (p: Point) => {
      // First rotate around source center
      const rotated = rotatePoint(p, sourceCenter, totalRotation);
      // Then translate to target point
      return {
        x: rotated.x + translation.x,
        y: rotated.y + translation.y,
      };
    };

    return {
      ...segment,
      start: transformPt(segment.start),
      end: transformPt(segment.end),
      points: segment.points.map(transformPt),
    };
  });

  return {
    ...sourcePath,
    segments: transformedSegments,
    d: segmentsToPathData(transformedSegments),
    transform: undefined, // Clear transform as it is baked
  };
}

/**
 * Align a source path to follow a target path
 */
export function alignPathToPath(
  sourcePath: Path,
  targetPath: Path,
  alignment: PathAlignment
): Path {
  if (alignment.preserveShape) {
    // Get bounding box of source to center it
    const sourceBounds = getPathBounds(sourcePath);
    const sourceCenter = {
      x: sourceBounds.centerX,
      y: sourceBounds.centerY,
    };

    return alignPathToPathInternal(sourcePath, targetPath, alignment, sourceCenter);
  } else {
    // Deformation: map each point of the path to the target path curve
    return deformPathAlongPath(sourcePath, targetPath, alignment);
  }
}

/**
 * Deform source path to follow the curvature of target path
 * This is more complex - samples the source path and redistributes points
 * along the target path while maintaining relative positions
 */
function deformPathAlongPath(
  sourcePath: Path,
  targetPath: Path,
  alignment: PathAlignment
): Path {
  const { offset, perpOffset } = alignment;
  
  // Calculate bounds of source path to determine its "length"
  const sourceBounds = getPathBounds(sourcePath);
  const sourceWidth = sourceBounds.width;
  
  // Sample source path
  const numSamples = 50;
  const sourceSegments = sourcePath.segments;
  const targetSegments = targetPath.segments;
  
  const targetLength = calculatePathLength(targetSegments);
  const samples: Point[] = [];

  for (let i = 0; i <= numSamples; i++) {
    const t = i / numSamples;
    const sourcePoint = getPointAtLength(sourceSegments, t);
    
    // Map this point to target path
    // Calculate relative position along source (normalized)
    const relativeX = (sourcePoint.x - sourceBounds.x) / sourceWidth;
    const relativeY = sourcePoint.y - sourceBounds.centerY;
    
    // Find corresponding position on target (normalized 0-1)
    const sourceWidthOnTarget = targetLength > 0 ? sourceWidth / targetLength : 0;
    const targetT = offset + (relativeX - 0.5) * sourceWidthOnTarget;
    
    // Clamp targetT to [0, 1] to avoid artifacts at ends
    const clampedT = Math.max(0, Math.min(1, targetT));

    const targetPoint = getPointAtLength(targetSegments, clampedT);
    const targetNormal = getNormalAtLength(targetSegments, clampedT);
    
    // Position point perpendicular to target path
    const newPoint: Point = {
      x: targetPoint.x + targetNormal.x * (perpOffset + relativeY),
      y: targetPoint.y + targetNormal.y * (perpOffset + relativeY),
    };
    
    samples.push(newPoint);
  }

  // Convert samples back to path data (simplified to lines for now)
  const newD = samplesToPathData(samples);
  
  return {
    ...sourcePath,
    d: newD,
    segments: parsePathData(newD),
  };
}

/**
 * Get bounding box of a path
 */
function getPathBounds(path: Path) {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const segment of path.segments) {
    const points = [segment.start, ...segment.points, segment.end];
    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

/**
 * Convert segments back to path data string
 */
/**
 * Convert sample points to path data
 */
function samplesToPathData(samples: Point[]): string {
  if (samples.length === 0) return '';

  let d = `M ${samples[0].x} ${samples[0].y}`;
  
  for (let i = 1; i < samples.length; i++) {
    d += ` L ${samples[i].x} ${samples[i].y}`;
  }

  return d;
}
