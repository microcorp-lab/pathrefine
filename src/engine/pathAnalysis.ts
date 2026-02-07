import type { Path, SVGDocument } from '../types/svg';
import { calculatePathLength } from './pathMath';

/**
 * Analysis results for a single path
 */
export interface PathAnalysis {
  pointCount: number;          // Total anchor points
  pathLength: number;           // Total path length in units
  pointDensity: number;         // Points per 100 units
  complexity: 'optimal' | 'acceptable' | 'bloated' | 'disaster';
  estimatedSize: number;        // Estimated bytes for this path
  recommendations: string[];    // Actionable suggestions
}

/**
 * Analysis results for entire SVG document
 */
export interface DocumentAnalysis {
  totalPoints: number;
  totalPaths: number;
  estimatedFileSize: number;    // Total estimated size in bytes
  optimalFileSize: number;      // What it could be
  savingsPotential: number;     // Bytes that could be saved
  averageComplexity: number;    // 0-100 score
  pathAnalyses: Map<string, PathAnalysis>;
}

/**
 * Count anchor points in a path (M, L, C endpoints)
 * This is the standard "point count" shown to users
 */
export function countAnchorPoints(path: Path): number {
  return path.segments.filter(seg => 
    seg.type === 'M' || seg.type === 'L' || (seg.type === 'C' && seg.points.length > 0)
  ).length;
}

/**
 * Analyze a single path for optimization opportunities
 */
export function analyzePath(path: Path): PathAnalysis {
  // Count anchor points (excluding control points)
  const pointCount = countAnchorPoints(path);

  // Calculate path length
  const pathLength = calculatePathLength(path.segments);

  // Calculate point density (points per 100 units)
  const pointDensity = pathLength > 0 ? (pointCount / pathLength) * 100 : 0;

  // Determine complexity level
  // For very simple shapes (4-5 points), check if they're actually optimal
  const isClosed = path.d.trim().toUpperCase().endsWith('Z');
  const isSimpleShape = pointCount <= 5 && isClosed;
  
  let complexity: PathAnalysis['complexity'];
  if (isSimpleShape || pointDensity < 1.5) {
    complexity = 'optimal';
  } else if (pointDensity < 3) {
    complexity = 'acceptable';
  } else if (pointDensity < 5) {
    complexity = 'bloated';
  } else {
    complexity = 'disaster';
  }

  // Estimate size (rough calculation: ~20 bytes per point including coordinates)
  const estimatedSize = pointCount * 20 + path.d.length;

  // Generate recommendations
  const recommendations: string[] = [];
  
  if (complexity === 'bloated' || complexity === 'disaster') {
    // Calculate realistic reduction target
    // For closed paths, minimum is 4 points (for a rectangle)
    // For open paths, minimum is 2 points (start and end)
    const isClosed = path.d.trim().toUpperCase().endsWith('Z');
    const minPoints = isClosed ? 4 : 2;
    const targetPoints = Math.max(minPoints, Math.floor(pointCount * 0.3));
    
    if (pointCount > targetPoints) {
      recommendations.push(`Path has ${pointCount} points - could be reduced to ~${targetPoints}`);
    }
  }
  
  if (pointDensity > 3) {
    recommendations.push('Use Smart Heal to simplify over-dense segments');
  }
  
  if (path.segments.some(seg => seg.type === 'L' && pointDensity > 2)) {
    recommendations.push('Convert straight line segments to curves for smoother result');
  }

  return {
    pointCount,
    pathLength,
    pointDensity,
    complexity,
    estimatedSize,
    recommendations
  };
}

/**
 * Analyze entire SVG document
 */
export function analyzeDocument(document: SVGDocument): DocumentAnalysis {
  const pathAnalyses = new Map<string, PathAnalysis>();
  let totalPoints = 0;
  let totalEstimatedSize = 0;
  let complexitySum = 0;

  // Analyze each path
  document.paths.forEach(path => {
    const analysis = analyzePath(path);
    pathAnalyses.set(path.id, analysis);
    totalPoints += analysis.pointCount;
    totalEstimatedSize += analysis.estimatedSize;
    
    // Convert complexity to numeric score (0-100, where 0 is perfect)
    const complexityScore = {
      'optimal': 0,
      'acceptable': 33,
      'bloated': 67,
      'disaster': 100
    }[analysis.complexity];
    complexitySum += complexityScore;
  });

  // Calculate optimal file size (assume 30% reduction is achievable)
  const optimalFileSize = Math.floor(totalEstimatedSize * 0.7);
  const savingsPotential = totalEstimatedSize - optimalFileSize;

  // Calculate average complexity
  const averageComplexity = document.paths.length > 0 
    ? complexitySum / document.paths.length 
    : 0;

  return {
    totalPoints,
    totalPaths: document.paths.length,
    estimatedFileSize: totalEstimatedSize,
    optimalFileSize,
    savingsPotential,
    averageComplexity,
    pathAnalyses
  };
}

/**
 * Get color for complexity level
 */
export function getComplexityColor(complexity: PathAnalysis['complexity']): string {
  switch (complexity) {
    case 'optimal':
      return '#10b981'; // Green
    case 'acceptable':
      return '#f59e0b'; // Yellow
    case 'bloated':
      return '#f97316'; // Orange
    case 'disaster':
      return '#ef4444'; // Red
  }
}

/**
 * Get emoji indicator for complexity
 */
export function getComplexityEmoji(complexity: PathAnalysis['complexity']): string {
  switch (complexity) {
    case 'optimal':
      return '✨';
    case 'acceptable':
      return '⚡';
    case 'bloated':
      return '⚠️';
    case 'disaster':
      return '🚨';
  }
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

/**
 * Get health percentage (0-100, where 100 is perfect)
 */
export function getHealthPercentage(analysis: DocumentAnalysis): number {
  return Math.round(100 - analysis.averageComplexity);
}
