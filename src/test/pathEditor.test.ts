import { describe, it, expect } from 'vitest';
import {
  extractControlPoints,
  findNearestPoint,
  updateControlPoint,
  addPointToSegment,
  removePoint,
  findClosestPointOnSegment
} from '../engine/pathEditor';
import type { Path, BezierSegment, Point } from '../types/svg';

describe('pathEditor', () => {
  // Helper to create a simple test path
  const createTestPath = (segments: BezierSegment[]): Path => ({
    id: 'test-path',
    d: 'M 0 0 L 10 10',
    segments,
    fill: 'black'
  });

  describe('extractControlPoints', () => {
    it('should extract control points from linear path', () => {
      const path = createTestPath([
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 10 },
          points: [{ x: 10, y: 10 }]
        }
      ]);

      const controlPoints = extractControlPoints(path);
      
      expect(controlPoints.length).toBeGreaterThan(0);
      expect(controlPoints[0].type).toBe('anchor');
      expect(controlPoints[0].point).toEqual({ x: 0, y: 0 });
    });

    it('should extract control points from cubic bezier curve', () => {
      const path = createTestPath([
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'C',
          start: { x: 0, y: 0 },
          end: { x: 30, y: 30 },
          points: [{ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 30 }]
        }
      ]);

      const controlPoints = extractControlPoints(path);
      
      // Should have start anchor, 2 control points, and end anchor
      expect(controlPoints.length).toBeGreaterThanOrEqual(4);
      
      const controlPointTypes = controlPoints.filter(cp => cp.type === 'control');
      expect(controlPointTypes.length).toBeGreaterThanOrEqual(2);
    });

    it('should extract control points from quadratic bezier curve', () => {
      const path = createTestPath([
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'Q',
          start: { x: 0, y: 0 },
          end: { x: 20, y: 20 },
          points: [{ x: 10, y: 10 }, { x: 20, y: 20 }]
        }
      ]);

      const controlPoints = extractControlPoints(path);
      
      const controlPointTypes = controlPoints.filter(cp => cp.type === 'control');
      expect(controlPointTypes.length).toBeGreaterThanOrEqual(1);
    });

    it('should include path ID in control points', () => {
      const path = createTestPath([
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 10 },
          points: [{ x: 10, y: 10 }]
        }
      ]);

      const controlPoints = extractControlPoints(path);
      
      expect(controlPoints[0].pathId).toBe('test-path');
    });

    it('should include segment indices', () => {
      const path = createTestPath([
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 10 },
          points: [{ x: 10, y: 10 }]
        }
      ]);

      const controlPoints = extractControlPoints(path);
      
      expect(controlPoints[0].segmentIndex).toBe(0);
    });
  });

  describe('findNearestPoint', () => {
    const controlPoints = [
      {
        pathId: 'test',
        segmentIndex: 0,
        pointIndex: 0,
        point: { x: 0, y: 0 },
        type: 'anchor' as const
      },
      {
        pathId: 'test',
        segmentIndex: 1,
        pointIndex: 0,
        point: { x: 10, y: 10 },
        type: 'anchor' as const
      },
      {
        pathId: 'test',
        segmentIndex: 2,
        pointIndex: 0,
        point: { x: 20, y: 20 },
        type: 'anchor' as const
      }
    ];

    it('should find nearest control point within threshold', () => {
      const position: Point = { x: 1, y: 1 };
      const nearest = findNearestPoint(controlPoints, position, 5);
      
      expect(nearest).not.toBeNull();
      expect(nearest?.point).toEqual({ x: 0, y: 0 });
    });

    it('should return null if no point within threshold', () => {
      const position: Point = { x: 100, y: 100 };
      const nearest = findNearestPoint(controlPoints, position, 5);
      
      expect(nearest).toBeNull();
    });

    it('should find closest point when multiple within threshold', () => {
      const position: Point = { x: 5, y: 5 };
      const nearest = findNearestPoint(controlPoints, position, 10);
      
      expect(nearest).not.toBeNull();
      // Should be closer to (0,0) or (10,10) than (20,20)
      expect(nearest?.point.x).toBeLessThan(15);
    });

    it('should handle empty control points array', () => {
      const position: Point = { x: 5, y: 5 };
      const nearest = findNearestPoint([], position, 10);
      
      expect(nearest).toBeNull();
    });

    it('should use default threshold if not provided', () => {
      const position: Point = { x: 1, y: 1 };
      const nearest = findNearestPoint(controlPoints, position);
      
      expect(nearest).not.toBeNull();
    });
  });

  describe('updateControlPoint', () => {
    it('should update anchor point position', () => {
      const path = createTestPath([
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 10 },
          points: [{ x: 10, y: 10 }]
        }
      ]);

      const newPosition: Point = { x: 5, y: 5 };
      const updated = updateControlPoint(path, 0, 0, newPosition);
      
      expect(updated.segments[0].start).toEqual(newPosition);
    });

    it('should update control point in cubic bezier', () => {
      const path = createTestPath([
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'C',
          start: { x: 0, y: 0 },
          end: { x: 30, y: 30 },
          points: [{ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 30 }]
        }
      ]);

      const newPosition: Point = { x: 15, y: 15 };
      const updated = updateControlPoint(path, 1, 1, newPosition);
      
      expect(updated.segments[1].points[0]).toEqual(newPosition);
    });

    it('should regenerate path data after update', () => {
      const path = createTestPath([
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 10 },
          points: [{ x: 10, y: 10 }]
        }
      ]);

      const updated = updateControlPoint(path, 0, 0, { x: 5, y: 5 });
      
      expect(updated.d).toBeDefined();
      expect(updated.d).not.toBe(path.d);
    });

    it('should not modify original path', () => {
      const path = createTestPath([
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 10 },
          points: [{ x: 10, y: 10 }]
        }
      ]);

      const originalStart = { ...path.segments[0].start };
      updateControlPoint(path, 0, 0, { x: 5, y: 5 });
      
      expect(path.segments[0].start).toEqual(originalStart);
    });
  });

  describe('addPointToSegment', () => {
    it('should split line segment at t=0.5', () => {
      const path = createTestPath([
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 10 },
          points: [{ x: 10, y: 10 }]
        }
      ]);

      const updated = addPointToSegment(path, 1, 0.5);
      
      // Should now have 3 segments (M + 2 lines)
      expect(updated.segments.length).toBe(3);
      expect(updated.segments[1].type).toBe('L');
      expect(updated.segments[2].type).toBe('L');
      
      // New point should be at midpoint
      expect(updated.segments[1].end.x).toBeCloseTo(5, 5);
      expect(updated.segments[1].end.y).toBeCloseTo(5, 5);
    });

    it('should split line segment at custom t value', () => {
      const path = createTestPath([
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
      ]);

      const updated = addPointToSegment(path, 1, 0.25);
      
      expect(updated.segments[1].end.x).toBeCloseTo(2.5, 5);
    });

    it('should split cubic bezier curve', () => {
      const path = createTestPath([
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'C',
          start: { x: 0, y: 0 },
          end: { x: 30, y: 30 },
          points: [{ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 30 }]
        }
      ]);

      const updated = addPointToSegment(path, 1, 0.5);
      
      // Should now have 3 segments (M + 2 cubic beziers)
      expect(updated.segments.length).toBe(3);
      expect(updated.segments[1].type).toBe('C');
      expect(updated.segments[2].type).toBe('C');
    });

    it('should regenerate path data', () => {
      const path = createTestPath([
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 10 },
          points: []  // L segments have no control points
        }
      ]);

      const updated = addPointToSegment(path, 1);
      
      expect(updated.d).toBeDefined();
      expect(updated.d).not.toBe(path.d);
    });

    it('should handle Z segments by converting to L segments', () => {
      const path = createTestPath([
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'Z',
          start: { x: 10, y: 10 },
          end: { x: 0, y: 0 },
          points: []
        }
      ]);

      const updated = addPointToSegment(path, 1);
      
      // Z segment should be converted to 2 L segments
      expect(updated.segments.length).toBe(3);  // M + 2 L segments
      expect(updated.segments[1].type).toBe('L');
      expect(updated.segments[2].type).toBe('L');
    });
  });

  describe('removePoint', () => {
    it('should remove middle segment', () => {
      const path = createTestPath([
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 10 },
          points: [{ x: 10, y: 10 }]
        },
        {
          type: 'L',
          start: { x: 10, y: 10 },
          end: { x: 20, y: 20 },
          points: [{ x: 20, y: 20 }]
        }
      ]);

      const updated = removePoint(path, 1);
      
      expect(updated.segments.length).toBe(2);
    });

    it('should not remove if path would have less than 2 segments', () => {
      const path = createTestPath([
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 10 },
          points: [{ x: 10, y: 10 }]
        }
      ]);

      const updated = removePoint(path, 1);
      
      expect(updated.segments.length).toBe(path.segments.length);
    });

    it('should handle removing first segment', () => {
      const path = createTestPath([
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 10 },
          points: [{ x: 10, y: 10 }]
        },
        {
          type: 'L',
          start: { x: 10, y: 10 },
          end: { x: 20, y: 20 },
          points: [{ x: 20, y: 20 }]
        }
      ]);

      const updated = removePoint(path, 0);
      
      expect(updated.segments.length).toBe(2);
    });

    it('should handle removing last segment', () => {
      const path = createTestPath([
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 10 },
          points: [{ x: 10, y: 10 }]
        },
        {
          type: 'L',
          start: { x: 10, y: 10 },
          end: { x: 20, y: 20 },
          points: [{ x: 20, y: 20 }]
        }
      ]);

      const updated = removePoint(path, 2);
      
      expect(updated.segments.length).toBe(2);
    });

    it('should regenerate path data', () => {
      const path = createTestPath([
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'L',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 10 },
          points: [{ x: 10, y: 10 }]
        },
        {
          type: 'L',
          start: { x: 10, y: 10 },
          end: { x: 20, y: 20 },
          points: [{ x: 20, y: 20 }]
        }
      ]);

      const updated = removePoint(path, 1);
      
      expect(updated.d).toBeDefined();
      expect(updated.d).not.toBe(path.d);
    });
  });

  describe('findClosestPointOnSegment', () => {
    it('should find closest point on line segment', () => {
      const segment: BezierSegment = {
        type: 'L',
        start: { x: 0, y: 0 },
        end: { x: 10, y: 0 },
        points: [{ x: 10, y: 0 }]
      };

      const point: Point = { x: 5, y: 5 };
      const result = findClosestPointOnSegment(segment, point);
      
      expect(result).toBeDefined();
      expect(result.point.x).toBeCloseTo(5, 1);
      expect(result.point.y).toBeCloseTo(0, 1);
      expect(result.t).toBeGreaterThanOrEqual(0);
      expect(result.t).toBeLessThanOrEqual(1);
    });

    it('should return point on segment, not beyond endpoints', () => {
      const segment: BezierSegment = {
        type: 'L',
        start: { x: 0, y: 0 },
        end: { x: 10, y: 0 },
        points: [{ x: 10, y: 0 }]
      };

      const point: Point = { x: 20, y: 0 };
      const result = findClosestPointOnSegment(segment, point);
      
      expect(result.point.x).toBeLessThanOrEqual(10);
    });

    it('should handle cubic bezier segment', () => {
      const segment: BezierSegment = {
        type: 'C',
        start: { x: 0, y: 0 },
        end: { x: 30, y: 30 },
        points: [{ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 30 }]
      };

      const point: Point = { x: 15, y: 15 };
      const result = findClosestPointOnSegment(segment, point);
      
      expect(result).toBeDefined();
      expect(result.t).toBeGreaterThanOrEqual(0);
      expect(result.t).toBeLessThanOrEqual(1);
    });

    it('should return reasonable t value', () => {
      const segment: BezierSegment = {
        type: 'L',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 },
        points: [{ x: 100, y: 0 }]
      };

      const point: Point = { x: 25, y: 0 };
      const result = findClosestPointOnSegment(segment, point);
      
      expect(result.t).toBeCloseTo(0.25, 1);
    });
  });

  describe('edge cases', () => {
    it('should handle path with single segment', () => {
      const path = createTestPath([
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        }
      ]);

      const controlPoints = extractControlPoints(path);
      expect(controlPoints).toBeDefined();
    });

    it('should handle path with malformed segments', () => {
      const path = createTestPath([
        {
          type: 'M',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          points: []
        },
        {
          type: 'C',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 10 },
          points: [] // Missing control points
        }
      ]);

      const controlPoints = extractControlPoints(path);
      expect(controlPoints).toBeDefined();
    });

    it('should preserve path properties during modifications', () => {
      const path: Path = {
        id: 'test-path',
        d: 'M 0 0 L 10 10',
        fill: 'red',
        stroke: 'blue',
        strokeWidth: 2,
        opacity: 0.8,
        segments: [
          {
            type: 'M',
            start: { x: 0, y: 0 },
            end: { x: 0, y: 0 },
            points: []
          },
          {
            type: 'L',
            start: { x: 0, y: 0 },
            end: { x: 10, y: 10 },
            points: [{ x: 10, y: 10 }]
          }
        ]
      };

      const updated = updateControlPoint(path, 0, 0, { x: 5, y: 5 });
      
      expect(updated.id).toBe(path.id);
      expect(updated.fill).toBe(path.fill);
      expect(updated.stroke).toBe(path.stroke);
      expect(updated.strokeWidth).toBe(path.strokeWidth);
      expect(updated.opacity).toBe(path.opacity);
    });
  });
});
