import { describe, it, expect } from 'vitest';
import {
  calculatePathLength,
  getPointAtLength,
  getTangentAtLength,
  getNormalAtLength,
  samplePath,
  distance,
  rotatePoint,
  translatePoint
} from '../engine/pathMath';
import type { BezierSegment, Point } from '../types/svg';

describe('pathMath', () => {
  describe('distance', () => {
    it('should calculate distance between two points', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 3, y: 4 };
      expect(distance(p1, p2)).toBeCloseTo(5, 5);
    });

    it('should return 0 for same point', () => {
      const p: Point = { x: 10, y: 20 };
      expect(distance(p, p)).toBe(0);
    });

    it('should handle negative coordinates', () => {
      const p1: Point = { x: -5, y: -5 };
      const p2: Point = { x: -2, y: -1 };
      expect(distance(p1, p2)).toBeCloseTo(5, 5);
    });
  });

  describe('rotatePoint', () => {
    it('should rotate point 90 degrees around origin', () => {
      const point: Point = { x: 1, y: 0 };
      const origin: Point = { x: 0, y: 0 };
      const rotated = rotatePoint(point, origin, 90);
      expect(rotated.x).toBeCloseTo(0, 5);
      expect(rotated.y).toBeCloseTo(1, 5);
    });

    it('should rotate point 180 degrees', () => {
      const point: Point = { x: 1, y: 0 };
      const origin: Point = { x: 0, y: 0 };
      const rotated = rotatePoint(point, origin, 180);
      expect(rotated.x).toBeCloseTo(-1, 5);
      expect(rotated.y).toBeCloseTo(0, 5);
    });

    it('should rotate around non-zero origin', () => {
      const point: Point = { x: 2, y: 1 };
      const origin: Point = { x: 1, y: 1 };
      const rotated = rotatePoint(point, origin, 90);
      expect(rotated.x).toBeCloseTo(1, 5);
      expect(rotated.y).toBeCloseTo(2, 5);
    });

    it('should handle 360 degree rotation (full circle)', () => {
      const point: Point = { x: 5, y: 3 };
      const origin: Point = { x: 0, y: 0 };
      const rotated = rotatePoint(point, origin, 360);
      expect(rotated.x).toBeCloseTo(5, 5);
      expect(rotated.y).toBeCloseTo(3, 5);
    });

    it('should handle negative angles', () => {
      const point: Point = { x: 1, y: 0 };
      const origin: Point = { x: 0, y: 0 };
      const rotated = rotatePoint(point, origin, -90);
      expect(rotated.x).toBeCloseTo(0, 5);
      expect(rotated.y).toBeCloseTo(-1, 5);
    });
  });

  describe('translatePoint', () => {
    it('should translate point by offset', () => {
      const point: Point = { x: 10, y: 20 };
      const offset: Point = { x: 5, y: 3 };
      const translated = translatePoint(point, offset);
      expect(translated).toEqual({ x: 15, y: 23 });
    });

    it('should handle zero offset', () => {
      const point: Point = { x: 10, y: 20 };
      const offset: Point = { x: 0, y: 0 };
      const translated = translatePoint(point, offset);
      expect(translated).toEqual(point);
    });

    it('should handle negative offsets', () => {
      const point: Point = { x: 10, y: 20 };
      const offset: Point = { x: -5, y: -10 };
      const translated = translatePoint(point, offset);
      expect(translated).toEqual({ x: 5, y: 10 });
    });
  });

  describe('calculatePathLength', () => {
    it('should calculate length for straight line', () => {
      const segments: BezierSegment[] = [
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 3, y: 4 },
          points: [{ x: 3, y: 4 }]
        }
      ];
      expect(calculatePathLength(segments)).toBeCloseTo(5, 1);
    });

    it('should return 0 for empty path', () => {
      expect(calculatePathLength([])).toBe(0);
    });

    it('should handle moveto commands (M)', () => {
      const segments: BezierSegment[] = [
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 10 },
          points: []
        }
      ];
      expect(calculatePathLength(segments)).toBe(0);
    });

    it('should handle closepath (Z)', () => {
      const segments: BezierSegment[] = [
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 3, y: 0 },
          points: [{ x: 3, y: 0 }]
        },
        {
          type: 'Z',
          start: { x: 3, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        }
      ];
      expect(calculatePathLength(segments)).toBeCloseTo(6, 1);
    });

    it('should calculate length for multiple line segments', () => {
      const segments: BezierSegment[] = [
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 0 },
          points: [{ x: 10, y: 0 }]
        },
        {
          type: 'L',
          start: { x: 10, y: 0 },
          end: { x: 10, y: 10 },
          points: [{ x: 10, y: 10 }]
        }
      ];
      expect(calculatePathLength(segments)).toBeCloseTo(20, 1);
    });
  });

  describe('getPointAtLength', () => {
    it('should get start point at t=0', () => {
      const segments: BezierSegment[] = [
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 0 },
          points: [{ x: 10, y: 0 }]
        }
      ];
      const point = getPointAtLength(segments, 0);
      expect(point.x).toBeCloseTo(0, 5);
      expect(point.y).toBeCloseTo(0, 5);
    });

    it('should get end point at t=1', () => {
      const segments: BezierSegment[] = [
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 0 },
          points: [{ x: 10, y: 0 }]
        }
      ];
      const point = getPointAtLength(segments, 1);
      expect(point.x).toBeCloseTo(10, 5);
      expect(point.y).toBeCloseTo(0, 5);
    });

    it('should get midpoint at t=0.5', () => {
      const segments: BezierSegment[] = [
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 0 },
          points: [{ x: 10, y: 0 }]
        }
      ];
      const point = getPointAtLength(segments, 0.5);
      expect(point.x).toBeCloseTo(5, 5);
      expect(point.y).toBeCloseTo(0, 5);
    });

    it('should handle empty segments', () => {
      // Empty segments should be handled gracefully
      // In production, this shouldn't happen with valid SVG
      const segments: BezierSegment[] = [];
      const point = getPointAtLength(segments, 0.5);
      expect(point).toEqual({ x: 0, y: 0 }); // Should return origin
    });
  });

  describe('getTangentAtLength', () => {
    it('should get tangent for horizontal line', () => {
      const segments: BezierSegment[] = [
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 0 },
          points: [{ x: 10, y: 0 }]
        }
      ];
      const tangent = getTangentAtLength(segments, 0.5);
      expect(tangent.x).toBeCloseTo(1, 5);
      expect(tangent.y).toBeCloseTo(0, 5);
    });

    it('should get tangent for vertical line', () => {
      const segments: BezierSegment[] = [
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 10 },
          points: [{ x: 0, y: 10 }]
        }
      ];
      const tangent = getTangentAtLength(segments, 0.5);
      expect(tangent.x).toBeCloseTo(0, 5);
      expect(tangent.y).toBeCloseTo(1, 5);
    });

    it('should return normalized tangent vector', () => {
      const segments: BezierSegment[] = [
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 3, y: 4 },
          points: [{ x: 3, y: 4 }]
        }
      ];
      const tangent = getTangentAtLength(segments, 0.5);
      const length = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y);
      expect(length).toBeCloseTo(1, 5);
    });
  });

  describe('getNormalAtLength', () => {
    it('should get normal perpendicular to tangent', () => {
      const segments: BezierSegment[] = [
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 0 },
          points: [{ x: 10, y: 0 }]
        }
      ];
      const normal = getNormalAtLength(segments, 0.5);
      expect(normal.x).toBeCloseTo(0, 5);
      expect(normal.y).toBeCloseTo(1, 5);
    });

    it('should be perpendicular to tangent', () => {
      const segments: BezierSegment[] = [
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 3, y: 4 },
          points: [{ x: 3, y: 4 }]
        }
      ];
      const tangent = getTangentAtLength(segments, 0.5);
      const normal = getNormalAtLength(segments, 0.5);
      // Dot product of perpendicular vectors should be 0
      const dotProduct = tangent.x * normal.x + tangent.y * normal.y;
      expect(dotProduct).toBeCloseTo(0, 5);
    });
  });

  describe('samplePath', () => {
    it('should sample path at regular intervals', () => {
      const segments: BezierSegment[] = [
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 0 },
          points: [{ x: 10, y: 0 }]
        }
      ];
      const samples = samplePath(segments, 5);
      expect(samples.length).toBeGreaterThan(0);
      expect(samples[0].x).toBeCloseTo(0, 5);
      expect(samples[samples.length - 1].x).toBeCloseTo(10, 5);
    });

    it('should handle single sample', () => {
      const segments: BezierSegment[] = [
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 0 },
          points: [{ x: 10, y: 0 }]
        }
      ];
      const samples = samplePath(segments, 1);
      expect(samples.length).toBeGreaterThan(0);
    });

    it('should handle empty path', () => {
      // Empty path should return empty samples or default points
      const samples = samplePath([], 10);
      expect(samples).toBeDefined();
      expect(Array.isArray(samples)).toBe(true);
    });
  });

  describe('cubic bezier calculations', () => {
    it('should calculate length for cubic bezier curve', () => {
      const segments: BezierSegment[] = [
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'C',
          start: { x: 0, y: 0 },
          end: { x: 100, y: 0 },
          points: [{ x: 33, y: 50 }, { x: 67, y: 50 }, { x: 100, y: 0 }]
        }
      ];
      const length = calculatePathLength(segments);
      expect(length).toBeGreaterThan(100); // Curve is longer than straight line
    });

    it('should get point on cubic bezier curve', () => {
      const segments: BezierSegment[] = [
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'C',
          start: { x: 0, y: 0 },
          end: { x: 100, y: 0 },
          points: [{ x: 33, y: 50 }, { x: 67, y: 50 }, { x: 100, y: 0 }]
        }
      ];
      const point = getPointAtLength(segments, 0.5);
      expect(point.x).toBeGreaterThan(0);
      expect(point.x).toBeLessThan(100);
    });
  });

  describe('quadratic bezier calculations', () => {
    it('should calculate length for quadratic bezier curve', () => {
      const segments: BezierSegment[] = [
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'Q',
          start: { x: 0, y: 0 },
          end: { x: 100, y: 0 },
          points: [{ x: 50, y: 50 }, { x: 100, y: 0 }]
        }
      ];
      const length = calculatePathLength(segments);
      expect(length).toBeGreaterThan(100); // Curve is longer than straight line
    });

    it('should get point on quadratic bezier curve', () => {
      const segments: BezierSegment[] = [
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'Q',
          start: { x: 0, y: 0 },
          end: { x: 100, y: 0 },
          points: [{ x: 50, y: 50 }, { x: 100, y: 0 }]
        }
      ];
      const point = getPointAtLength(segments, 0.5);
      expect(point.x).toBeGreaterThan(0);
      expect(point.x).toBeLessThan(100);
    });
  });
});
