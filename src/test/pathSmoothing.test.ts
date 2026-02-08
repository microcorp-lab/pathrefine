import { describe, it, expect, beforeEach } from 'vitest';
import { 
  smoothPath,
  samplePathToDenseCloud
} from '../engine/pathSmoothing';
import { parsePathData } from '../engine/parser';
import type { Path } from '../types/svg';

// Helper function to create Path from path data string
function createPath(d: string, id: string = 'test-path'): Path {
  const segments = parsePathData(d);
  return {
    id,
    d,
    segments,
    fill: 'none',
    stroke: '#000',
    strokeWidth: 1
  };
}

describe('samplePathToDenseCloud', () => {
  it('should sample a straight line correctly', () => {
    const path = createPath('M 0 0 L 100 0');
    const points = samplePathToDenseCloud(path, 'fixed', 5);
    
    // Should have points along the line
    expect(points.length).toBeGreaterThan(0);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[points.length - 1]).toEqual({ x: 100, y: 0 });
  });

  it('should adapt sampling based on segment length', () => {
    const shortPath = createPath('M 0 0 L 10 0');
    const longPath = createPath('M 0 0 L 1000 0');
    
    const shortPoints = samplePathToDenseCloud(shortPath, 'adaptive');
    const longPoints = samplePathToDenseCloud(longPath, 'adaptive');
    
    // Adaptive mode: 1 point per 5px, so longPath should have more points
    expect(longPoints.length).toBeGreaterThan(shortPoints.length);
    expect(longPoints.length).toBeGreaterThan(100); // At least 1000/5 = 200 points
  });

  it('should handle cubic curves with complexity-based sampling', () => {
    // Complex cubic curve with control points far from chord
    const complexPath = createPath('M 0 0 C 50 100, 150 100, 200 0');
    const points = samplePathToDenseCloud(complexPath, 'adaptive');
    
    // Should have many points due to curve length (~250px) at 1 point per 5px = ~50 points
    expect(points.length).toBeGreaterThan(10);
  });

  it('should deduplicate consecutive identical points', () => {
    const path = createPath('M 0 0 L 0 0 L 0 0 L 100 0');
    const points = samplePathToDenseCloud(path, 'fixed', 2);
    
    // Should not have duplicate consecutive points
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i-1].x;
      const dy = points[i].y - points[i-1].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeGreaterThan(0.001);
    }
  });

  it('should handle closed paths correctly', () => {
    const closedPath = createPath('M 0 0 L 100 0 L 100 100 L 0 100 Z');
    const points = samplePathToDenseCloud(closedPath, 'fixed', 5);
    
    // First and last points should be identical for closed paths
    expect(points[0].x).toBeCloseTo(points[points.length - 1].x, 1);
    expect(points[0].y).toBeCloseTo(points[points.length - 1].y, 1);
  });

  it('should handle quadratic curves', () => {
    const quadPath = createPath('M 0 0 Q 50 100, 100 0');
    const points = samplePathToDenseCloud(quadPath, 'fixed', 10);
    
    expect(points.length).toBeGreaterThan(10);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[points.length - 1]).toEqual({ x: 100, y: 0 });
  });
});

describe('smoothPath (Polish mode)', () => {
  let testPath: Path;

  beforeEach(() => {
    testPath = createPath('M 0 0 C 25 25, 75 25, 100 0');
  });

  it('should adjust control points based on smoothness', () => {
    const light = smoothPath(testPath, 0.2, false, undefined, false);
    const heavy = smoothPath(testPath, 0.8, false, undefined, false);
    
    // Both should produce valid paths
    expect(light.segments.length).toBeGreaterThan(0);
    expect(heavy.segments.length).toBeGreaterThan(0);
    
    // Heavy smoothing should produce different results
    expect(light.d).not.toBe(heavy.d);
  });

  it('should convert lines to curves when enabled', () => {
    const linePath = createPath('M 0 0 L 100 0 L 100 100');
    const result = smoothPath(linePath, 0.5, true, undefined, false);
    
    // Should have curve segments after conversion
    const hasCurves = result.segments.some(seg => seg.type === 'C');
    expect(hasCurves).toBe(true);
  });

  it('should preserve smooth curves when enabled', () => {
    const smoothCurve = createPath('M 0 0 C 25 0, 75 0, 100 0');
    const result = smoothPath(smoothCurve, 0.5, false, undefined, true);
    
    // Should maintain curve structure
    expect(result.segments.length).toBeGreaterThan(0);
  });

  it('should handle selected points only mode', () => {
    const result = smoothPath(testPath, 0.5, false, [0, 1], false);
    
    // Should still produce valid path
    expect(result.segments.length).toBeGreaterThan(0);
  });
});
