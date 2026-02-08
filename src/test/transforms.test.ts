import { describe, it, expect } from 'vitest';
import {
  applyTransform,
  applyInverseTransform,
  getTransformMatrix,
  parseTransform,
  serializeTransform,
  composeTransforms
} from '../engine/transforms';
import type { Point, Transform } from '../types/svg';

describe('transforms', () => {
  describe('applyTransform', () => {
    it('should return original point when no transform', () => {
      const point: Point = { x: 10, y: 20 };
      const result = applyTransform(point, undefined);
      expect(result).toEqual(point);
    });

    it('should apply translate transform', () => {
      const point: Point = { x: 10, y: 20 };
      const result = applyTransform(point, 'translate(100,200)');
      expect(result.x).toBeCloseTo(110);
      expect(result.y).toBeCloseTo(220);
    });

    it('should apply translate with single value (x only)', () => {
      const point: Point = { x: 10, y: 20 };
      const result = applyTransform(point, 'translate(50)');
      expect(result.x).toBeCloseTo(60);
      expect(result.y).toBeCloseTo(20);
    });

    it('should apply scale transform', () => {
      const point: Point = { x: 10, y: 20 };
      const result = applyTransform(point, 'scale(2)');
      expect(result.x).toBeCloseTo(20);
      expect(result.y).toBeCloseTo(40);
    });

    it('should apply non-uniform scale', () => {
      const point: Point = { x: 10, y: 20 };
      const result = applyTransform(point, 'scale(2,3)');
      expect(result.x).toBeCloseTo(20);
      expect(result.y).toBeCloseTo(60);
    });

    it('should apply rotate transform', () => {
      const point: Point = { x: 10, y: 0 };
      const result = applyTransform(point, 'rotate(90)');
      expect(result.x).toBeCloseTo(0, 0);
      expect(result.y).toBeCloseTo(10, 0);
    });

    it('should apply composite transforms', () => {
      const point: Point = { x: 10, y: 20 };
      const result = applyTransform(point, 'translate(100,200) scale(2)');
      expect(result.x).toBeCloseTo(120); // (10 * 2) + 100
      expect(result.y).toBeCloseTo(240); // (20 * 2) + 200
    });

    it('should handle matrix transform', () => {
      const point: Point = { x: 10, y: 20 };
      // matrix(a,b,c,d,e,f) where x' = ax + cy + e, y' = bx + dy + f
      const result = applyTransform(point, 'matrix(1,0,0,1,100,200)');
      expect(result.x).toBeCloseTo(110);
      expect(result.y).toBeCloseTo(220);
    });

    it('should handle negative values', () => {
      const point: Point = { x: 10, y: 20 };
      const result = applyTransform(point, 'translate(-5,-10)');
      expect(result.x).toBeCloseTo(5);
      expect(result.y).toBeCloseTo(10);
    });

    it('should handle decimal values', () => {
      const point: Point = { x: 10.5, y: 20.3 };
      const result = applyTransform(point, 'translate(0.5,0.7)');
      expect(result.x).toBeCloseTo(11.0);
      expect(result.y).toBeCloseTo(21.0);
    });
  });

  describe('applyInverseTransform', () => {
    it('should return original point when no transform', () => {
      const point: Point = { x: 10, y: 20 };
      const result = applyInverseTransform(point, undefined);
      expect(result).toEqual(point);
    });

    it('should invert translate transform', () => {
      const point: Point = { x: 110, y: 220 };
      const result = applyInverseTransform(point, 'translate(100,200)');
      expect(result.x).toBeCloseTo(10);
      expect(result.y).toBeCloseTo(20);
    });

    it('should invert scale transform', () => {
      const point: Point = { x: 20, y: 40 };
      const result = applyInverseTransform(point, 'scale(2)');
      expect(result.x).toBeCloseTo(10);
      expect(result.y).toBeCloseTo(20);
    });

    it('should invert rotate transform', () => {
      const point: Point = { x: 0, y: 10 };
      const result = applyInverseTransform(point, 'rotate(90)');
      expect(result.x).toBeCloseTo(10, 0);
      expect(result.y).toBeCloseTo(0, 0);
    });

    it('should be inverse of applyTransform', () => {
      const original: Point = { x: 10, y: 20 };
      const transform = 'translate(100,200) scale(2) rotate(45)';
      
      const transformed = applyTransform(original, transform);
      const inverted = applyInverseTransform(transformed, transform);
      
      expect(inverted.x).toBeCloseTo(original.x, 1);
      expect(inverted.y).toBeCloseTo(original.y, 1);
    });
  });

  describe('getTransformMatrix', () => {
    it('should return null for empty transform', () => {
      const result = getTransformMatrix('');
      expect(result).toBeNull();
    });

    it('should return matrix for translate', () => {
      const matrix = getTransformMatrix('translate(100,200)');
      expect(matrix).not.toBeNull();
      expect(matrix!.e).toBeCloseTo(100);
      expect(matrix!.f).toBeCloseTo(200);
    });

    it('should return matrix for scale', () => {
      const matrix = getTransformMatrix('scale(2)');
      expect(matrix).not.toBeNull();
      expect(matrix!.a).toBeCloseTo(2);
      expect(matrix!.d).toBeCloseTo(2);
    });

    it('should return consolidated matrix for composite transform', () => {
      const matrix = getTransformMatrix('translate(10,20) scale(2)');
      expect(matrix).not.toBeNull();
      // Should have scale and translate combined
      expect(matrix!.a).toBeCloseTo(2); // scale x
      expect(matrix!.d).toBeCloseTo(2); // scale y
      expect(matrix!.e).toBeCloseTo(10); // translate x
      expect(matrix!.f).toBeCloseTo(20); // translate y
    });
  });

  describe('parseTransform', () => {
    it('should return empty object for no transform', () => {
      const result = parseTransform('');
      expect(result).toEqual({});
    });

    it('should parse translate', () => {
      const result = parseTransform('translate(100,200)');
      expect(result.translate).toEqual({ x: 100, y: 200 });
    });

    it('should parse translate with single value', () => {
      const result = parseTransform('translate(100)');
      expect(result.translate).toEqual({ x: 100, y: 0 });
    });

    it('should parse rotate', () => {
      const result = parseTransform('rotate(45)');
      expect(result.rotate).toBe(45);
    });

    it('should parse scale with two values', () => {
      const result = parseTransform('scale(2,3)');
      expect(result.scale).toEqual({ x: 2, y: 3 });
    });

    it('should parse scale with single value', () => {
      const result = parseTransform('scale(2)');
      expect(result.scale).toEqual({ x: 2, y: 2 });
    });

    it('should parse matrix', () => {
      const result = parseTransform('matrix(1,0,0,1,100,200)');
      expect(result.matrix).toEqual([1, 0, 0, 1, 100, 200]);
    });

    it('should parse composite transform', () => {
      const result = parseTransform('translate(10,20) rotate(45) scale(2)');
      expect(result.translate).toEqual({ x: 10, y: 20 });
      expect(result.rotate).toBe(45);
      expect(result.scale).toEqual({ x: 2, y: 2 });
    });

    it('should handle negative values', () => {
      const result = parseTransform('translate(-10,-20) rotate(-45) scale(-2)');
      expect(result.translate).toEqual({ x: -10, y: -20 });
      expect(result.rotate).toBe(-45);
      expect(result.scale).toEqual({ x: -2, y: -2 });
    });

    it('should handle decimal values', () => {
      const result = parseTransform('translate(10.5,20.3) scale(1.5)');
      expect(result.translate).toEqual({ x: 10.5, y: 20.3 });
      expect(result.scale).toEqual({ x: 1.5, y: 1.5 });
    });
  });

  describe('serializeTransform', () => {
    it('should serialize translate', () => {
      const transform: Transform = {
        translate: { x: 100, y: 200 }
      };
      const result = serializeTransform(transform);
      expect(result).toBe('translate(100,200)');
    });

    it('should serialize rotate', () => {
      const transform: Transform = {
        rotate: 45
      };
      const result = serializeTransform(transform);
      expect(result).toBe('rotate(45)');
    });

    it('should serialize uniform scale', () => {
      const transform: Transform = {
        scale: { x: 2, y: 2 }
      };
      const result = serializeTransform(transform);
      expect(result).toBe('scale(2)');
    });

    it('should serialize non-uniform scale', () => {
      const transform: Transform = {
        scale: { x: 2, y: 3 }
      };
      const result = serializeTransform(transform);
      expect(result).toBe('scale(2,3)');
    });

    it('should serialize composite transform', () => {
      const transform: Transform = {
        translate: { x: 10, y: 20 },
        rotate: 45,
        scale: { x: 2, y: 2 }
      };
      const result = serializeTransform(transform);
      expect(result).toBe('translate(10,20) rotate(45) scale(2)');
    });

    it('should handle empty transform', () => {
      const transform: Transform = {};
      const result = serializeTransform(transform);
      expect(result).toBe('');
    });
  });

  describe('composeTransforms', () => {
    it('should compose multiple transforms', () => {
      const transforms = ['translate(10,20)', 'rotate(45)', 'scale(2)'];
      const result = composeTransforms(transforms);
      expect(result).toBe('translate(10,20) rotate(45) scale(2)');
    });

    it('should filter out empty strings', () => {
      const transforms = ['translate(10,20)', '', 'scale(2)'];
      const result = composeTransforms(transforms);
      expect(result).toBe('translate(10,20) scale(2)');
    });

    it('should handle empty array', () => {
      const result = composeTransforms([]);
      expect(result).toBe('');
    });

    it('should handle single transform', () => {
      const result = composeTransforms(['translate(10,20)']);
      expect(result).toBe('translate(10,20)');
    });
  });

  describe('integration tests', () => {
    it('should round-trip through parse and serialize', () => {
      const original = 'translate(10,20) rotate(45) scale(2)';
      const parsed = parseTransform(original);
      const serialized = serializeTransform(parsed);
      
      // Parse both to compare (order might differ)
      const parsedOriginal = parseTransform(original);
      const parsedSerialized = parseTransform(serialized);
      
      expect(parsedSerialized).toEqual(parsedOriginal);
    });

    it('should correctly transform points through complex pipeline', () => {
      const point: Point = { x: 10, y: 20 };
      const transform = 'translate(190,228)';
      
      // Apply transform
      const worldPoint = applyTransform(point, transform);
      expect(worldPoint.x).toBeCloseTo(200);
      expect(worldPoint.y).toBeCloseTo(248);
      
      // Apply inverse
      const localPoint = applyInverseTransform(worldPoint, transform);
      expect(localPoint.x).toBeCloseTo(point.x);
      expect(localPoint.y).toBeCloseTo(point.y);
    });
  });
});
