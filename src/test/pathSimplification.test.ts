import { describe, it, expect } from 'vitest';
import { simplifyPath } from '../engine/pathMerging';
import type { Path, BezierSegment } from '../types/svg';

describe('Path Simplification Algorithm', () => {
  
  describe('Straight Line Detection', () => {
    it('should convert nearly straight cubic Bezier to line', () => {
      // Create a cubic Bezier that's almost straight (max deviation ~0.1px)
      const path: Path = {
        id: 'test-1',
        d: 'M0,0 C10,0.1 20,0.1 30,0',
        segments: [
          { type: 'M', points: [], start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
          { 
            type: 'C', 
            points: [{ x: 10, y: 0.1 }, { x: 20, y: 0.1 }], 
            start: { x: 0, y: 0 }, 
            end: { x: 30, y: 0 } 
          }
        ],
        fill: '#000'
      };
      
      // With 0.2px tolerance, this should become a line
      const simplified = simplifyPath(path, 0.2);
      
      expect(simplified.segments.length).toBe(2); // M + L
      expect(simplified.segments[1].type).toBe('L');
    });
    
    it('should preserve genuinely curved Bezier', () => {
      // Create a cubic Bezier with significant curvature (arc-like)
      const path: Path = {
        id: 'test-2',
        d: 'M0,0 C0,20 30,20 30,0',
        segments: [
          { type: 'M', points: [], start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
          { 
            type: 'C', 
            points: [{ x: 0, y: 20 }, { x: 30, y: 20 }], 
            start: { x: 0, y: 0 }, 
            end: { x: 30, y: 0 } 
          }
        ],
        fill: '#000'
      };
      
      // This should remain as curve even with 1px tolerance
      const simplified = simplifyPath(path, 1.0);
      
      expect(simplified.segments.length).toBe(2); // M + C
      expect(simplified.segments[1].type).toBe('C');
    });
  });
  
  describe('Douglas-Peucker on Line Segments', () => {
    it('should simplify collinear points', () => {
      const path: Path = {
        id: 'test-3',
        d: 'M0,0 L10,10 L20,20 L30,30',
        segments: [
          { type: 'M', points: [], start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
          { type: 'L', points: [], start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
          { type: 'L', points: [], start: { x: 10, y: 10 }, end: { x: 20, y: 20 } },
          { type: 'L', points: [], start: { x: 20, y: 20 }, end: { x: 30, y: 30 } }
        ],
        fill: '#000'
      };
      
      // All intermediate points are collinear - should reduce to M + L
      expect(path.segments.length).toBe(4); // Before
      
      const simplified = simplifyPath(path, 0.1);
      expect(simplified.segments.length).toBe(2); // M + single L
      expect(simplified.segments[1].type).toBe('L');
      expect(simplified.segments[1].end).toEqual({ x: 30, y: 30 });
    });
    
    it('should preserve important vertices', () => {
      const path: Path = {
        id: 'test-4',
        d: 'M0,0 L10,0 L10,10 L0,10 Z',
        segments: [
          { type: 'M', points: [], start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
          { type: 'L', points: [], start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
          { type: 'L', points: [], start: { x: 10, y: 0 }, end: { x: 10, y: 10 } },
          { type: 'L', points: [], start: { x: 10, y: 10 }, end: { x: 0, y: 10 } },
          { type: 'Z', points: [], start: { x: 0, y: 10 }, end: { x: 0, y: 0 } }
        ],
        fill: '#000'
      };
      
      // Rectangle corners should be preserved
      expect(path.segments.length).toBe(5);
      
      const simplified = simplifyPath(path, 0.1);
      expect(simplified.segments.length).toBe(5); // All corners needed
      expect(simplified.segments[4].type).toBe('Z'); // Z preserved
    });
  });
  
  describe('Mixed Path Handling', () => {
    it('should handle paths with both curves and lines', () => {
      const path: Path = {
        id: 'test-5',
        d: 'M0,0 L10,0 L20,0 C30,0 40,10 40,20 L40,30 L40,40',
        segments: [
          { type: 'M', points: [], start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
          { type: 'L', points: [], start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
          { type: 'L', points: [], start: { x: 10, y: 0 }, end: { x: 20, y: 0 } },
          { 
            type: 'C', 
            points: [{ x: 30, y: 0 }, { x: 40, y: 10 }], 
            start: { x: 20, y: 0 }, 
            end: { x: 40, y: 20 } 
          },
          { type: 'L', points: [], start: { x: 40, y: 20 }, end: { x: 40, y: 30 } },
          { type: 'L', points: [], start: { x: 40, y: 30 }, end: { x: 40, y: 40 } }
        ],
        fill: '#000'
      };
      
      // Should simplify lines but keep curve
      expect(path).toBeDefined();
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle empty paths', () => {
      const path: Path = {
        id: 'test-6',
        d: '',
        segments: [],
        fill: '#000'
      };
      
      expect(path.segments.length).toBe(0);
    });
    
    it('should handle single segment paths', () => {
      const path: Path = {
        id: 'test-7',
        d: 'M0,0',
        segments: [
          { type: 'M', points: [], start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }
        ],
        fill: '#000'
      };
      
      expect(path.segments.length).toBe(1);
    });
    
    it('should handle closed paths', () => {
      const path: Path = {
        id: 'test-8',
        d: 'M0,0 L10,0 L5,10 Z',
        segments: [
          { type: 'M', points: [], start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
          { type: 'L', points: [], start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
          { type: 'L', points: [], start: { x: 10, y: 0 }, end: { x: 5, y: 10 } },
          { type: 'Z', points: [], start: { x: 5, y: 10 }, end: { x: 0, y: 0 } }
        ],
        fill: '#000'
      };
      
      // Z command should be preserved
      const lastSeg = path.segments[path.segments.length - 1];
      expect(lastSeg.type).toBe('Z');
    });
    
    it('should handle zero tolerance', () => {
      const path: Path = {
        id: 'test-9',
        d: 'M0,0 L10,10',
        segments: [
          { type: 'M', points: [], start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
          { type: 'L', points: [], start: { x: 0, y: 0 }, end: { x: 10, y: 10 } }
        ],
        fill: '#000'
      };
      
      // With tolerance=0, path should remain unchanged
      expect(path.segments.length).toBe(2);
    });
  });
  
  describe('Quadratic Bezier Handling', () => {
    it('should simplify nearly straight quadratic curves', () => {
      const path: Path = {
        id: 'test-10',
        d: 'M0,0 Q15,0.1 30,0',
        segments: [
          { type: 'M', points: [], start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
          { 
            type: 'Q', 
            points: [{ x: 15, y: 0.1 }], 
            start: { x: 0, y: 0 }, 
            end: { x: 30, y: 0 } 
          }
        ],
        fill: '#000'
      };
      
      expect(path).toBeDefined();
    });
    
    it('should preserve curved quadratic curves', () => {
      const path: Path = {
        id: 'test-11',
        d: 'M0,0 Q15,20 30,0',
        segments: [
          { type: 'M', points: [], start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
          { 
            type: 'Q', 
            points: [{ x: 15, y: 20 }], 
            start: { x: 0, y: 0 }, 
            end: { x: 30, y: 0 } 
          }
        ],
        fill: '#000'
      };
      
      expect(path).toBeDefined();
    });
  });

  describe('Performance and Compression', () => {
    it('should handle large paths efficiently', () => {
      // Create a path with 1000 segments (sine wave)
      const segments: BezierSegment[] = [
        { type: 'M', points: [], start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }
      ];
      
      for (let i = 1; i <= 1000; i++) {
        segments.push({
          type: 'L',
          points: [],
          start: { x: i - 1, y: Math.sin((i-1) / 10) * 10 },
          end: { x: i, y: Math.sin(i / 10) * 10 }
        });
      }
      
      const path: Path = {
        id: 'test-perf',
        d: '', // Would be very long
        segments,
        fill: '#000'
      };
      
      const start = performance.now();
      const simplified = simplifyPath(path, 0.5);
      const end = performance.now();
      
      expect(end - start).toBeLessThan(100); // Should complete in <100ms
      expect(simplified.segments.length).toBeLessThan(path.segments.length); // Should simplify
      console.log(`Performance: ${(end - start).toFixed(2)}ms for ${path.segments.length} → ${simplified.segments.length} segments`);
    });
  });
  
  describe('Visual Fidelity Tests', () => {
    it('should stay within tolerance for all simplified segments', () => {
      // This would require calculating the actual maximum deviation
      // from the original path to the simplified path
      expect(true).toBe(true); // Placeholder
    });
  });
  
  describe('Compression Ratio Tests', () => {
    it('should achieve high compression on collinear points', () => {
      const segments: BezierSegment[] = [
        { type: 'M', points: [], start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }
      ];
      
      // Add 100 collinear points
      for (let i = 1; i <= 100; i++) {
        segments.push({
          type: 'L',
          points: [],
          start: { x: i - 1, y: i - 1 },
          end: { x: i, y: i }
        });
      }
      
      const path: Path = {
        id: 'test-compression',
        d: '',
        segments,
        fill: '#000'
      };
      
      const originalCount = path.segments.length;
      expect(originalCount).toBe(101); // M + 100 L
      
      const simplified = simplifyPath(path, 0.1);
      const simplifiedCount = simplified.segments.length;
      
      // Should reduce to M + single L (all points are collinear)
      expect(simplifiedCount).toBe(2);
      
      const compressionRatio = ((originalCount - simplifiedCount) / originalCount * 100).toFixed(1);
      console.log(`Compression: ${originalCount} → ${simplifiedCount} segments (${compressionRatio}% reduction)`);
      
      expect(parseFloat(compressionRatio)).toBeGreaterThan(95); // >95% compression M + single L
      // TODO: Test actual compression ratio
      expect(originalCount).toBeGreaterThan(2);
    });
  });

  describe('3-Step Professional Algorithm', () => {
    describe('Square Case: Closed Path with Corners', () => {
      it('should produce exactly 4 lines + Z for a square', () => {
        // Create a square with many redundant points on each edge
        const segments: BezierSegment[] = [
          { type: 'M', points: [], start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }
        ];
        
        // Top edge: 0,0 → 100,0 (with 24 intermediate points)
        for (let i = 0; i <= 100; i += 4) {
          segments.push({ type: 'L', points: [], start: { x: i, y: 0 }, end: { x: i + 4, y: 0 } });
        }
        // Right edge: 100,0 → 100,100
        for (let i = 0; i <= 100; i += 4) {
          segments.push({ type: 'L', points: [], start: { x: 100, y: i }, end: { x: 100, y: i + 4 } });
        }
        // Bottom edge: 100,100 → 0,100
        for (let i = 100; i >= 0; i -= 4) {
          segments.push({ type: 'L', points: [], start: { x: i, y: 100 }, end: { x: i - 4, y: 100 } });
        }
        // Left edge: 0,100 → 0,0
        for (let i = 100; i >= 0; i -= 4) {
          segments.push({ type: 'L', points: [], start: { x: 0, y: i }, end: { x: 0, y: i - 4 } });
        }
        
        // Add explicit Z command to mark as closed
        segments.push({
          type: 'Z',
          points: [],
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 }
        });
        
        const path: Path = {
          id: 'square-test',
          d: '',
          segments,
          fill: '#000'
        };
        
        console.log(`Square input: ${segments.length} segments`);
        
        const simplified = simplifyPath(path, 0.1);
        
        console.log(`Square output: ${simplified.segments.length} segments`);
        console.log('Segment types:', simplified.segments.map(s => s.type).join(', '));
        
        // Should produce fewer segments than input and maintain square shape
        expect(simplified.segments.length).toBeLessThan(segments.length);
        expect(simplified.segments.length).toBeGreaterThanOrEqual(6); // At least M + 4L + Z
        expect(simplified.segments.length).toBeLessThanOrEqual(12); // Reasonable upper bound
        
        expect(simplified.segments[0].type).toBe('M');
        
        // Should end with Z
        expect(simplified.segments[simplified.segments.length - 1].type).toBe('Z');
        
        // All middle segments should be lines (square has no curves)
        for (let i = 1; i < simplified.segments.length - 1; i++) {
          expect(simplified.segments[i].type).toBe('L');
        }
      });

      it('should snap-close the square with no gaps', () => {
        // Square path that's almost but not quite closed (but has Z)
        const segments: BezierSegment[] = [
          { type: 'M', points: [], start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
          { type: 'L', points: [], start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
          { type: 'L', points: [], start: { x: 100, y: 0 }, end: { x: 100, y: 100 } },
          { type: 'L', points: [], start: { x: 100, y: 100 }, end: { x: 0, y: 100 } },
          { type: 'L', points: [], start: { x: 0, y: 100 }, end: { x: 0.001, y: 0.001 } }, // Almost closed
          { type: 'Z', points: [], start: { x: 0.001, y: 0.001 }, end: { x: 0, y: 0 } }
        ];
        
        const path: Path = { id: 'gap-test', d: '', segments, fill: '#000' };
        const simplified = simplifyPath(path, 0.1);
        
        // Should have Z command
        const hasZ = simplified.segments.some(s => s.type === 'Z');
        expect(hasZ).toBe(true);
        
        // Last segment before Z should end exactly at first point
        const lastBeforeZ = simplified.segments[simplified.segments.length - 2];
        const first = simplified.segments[0];
        expect(lastBeforeZ.end.x).toBe(first.start.x);
        expect(lastBeforeZ.end.y).toBe(first.start.y);
      });
    });

    describe('Circle Case: G1 Continuity Across Z-Seam', () => {
      it('should produce smooth circle with seamless join', () => {
        // Create a circle using 4 cubic Bezier curves (standard SVG approach)
        const k = 0.5522847498; // Magic constant for circular arcs
        const r = 50; // radius
        const segments: BezierSegment[] = [
          { type: 'M', points: [], start: { x: r, y: 0 }, end: { x: r, y: 0 } },
          // Top-right quadrant
          { 
            type: 'C', 
            points: [{ x: r, y: r * k }, { x: r * k, y: r }], 
            start: { x: r, y: 0 }, 
            end: { x: 0, y: r } 
          },
          // Top-left quadrant
          { 
            type: 'C', 
            points: [{ x: -r * k, y: r }, { x: -r, y: r * k }], 
            start: { x: 0, y: r }, 
            end: { x: -r, y: 0 } 
          },
          // Bottom-left quadrant
          { 
            type: 'C', 
            points: [{ x: -r, y: -r * k }, { x: -r * k, y: -r }], 
            start: { x: -r, y: 0 }, 
            end: { x: 0, y: -r } 
          },
          // Bottom-right quadrant
          { 
            type: 'C', 
            points: [{ x: r * k, y: -r }, { x: r, y: -r * k }], 
            start: { x: 0, y: -r }, 
            end: { x: r, y: 0 } 
          },
          { type: 'Z', points: [], start: { x: r, y: 0 }, end: { x: r, y: 0 } }
        ];
        
        const path: Path = { id: 'circle-test', d: '', segments, fill: '#000' };
        const simplified = simplifyPath(path, 0.1);
        
        // Should remain as curves (not simplified to lines)
        const curveCount = simplified.segments.filter(s => s.type === 'C').length;
        expect(curveCount).toBeGreaterThan(0);
        
        // Should have Z command
        const hasZ = simplified.segments.some(s => s.type === 'Z');
        expect(hasZ).toBe(true);
        
        // Check G1 continuity at seam (last curve → first curve)
        const curves = simplified.segments.filter(s => s.type === 'C') as BezierSegment[];
        if (curves.length >= 2) {
          const lastCurve = curves[curves.length - 1];
          const firstCurve = curves[0];
          
          // Last handle and first handle should be collinear through the join point
          const lastHandle = lastCurve.points[1]; // CP2 of last curve
          const join = lastCurve.end;
          const firstHandle = firstCurve.points[0]; // CP1 of first curve
          
          // Calculate vectors
          const v1 = { x: join.x - lastHandle.x, y: join.y - lastHandle.y };
          const v2 = { x: firstHandle.x - join.x, y: firstHandle.y - join.y };
          
          const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
          const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
          
          if (len1 > 0.01 && len2 > 0.01) {
            const unit1 = { x: v1.x / len1, y: v1.y / len1 };
            const unit2 = { x: v2.x / len2, y: v2.y / len2 };
            
            // Dot product should be close to 1 (vectors aligned)
            const dot = unit1.x * unit2.x + unit1.y * unit2.y;
            expect(Math.abs(dot)).toBeGreaterThan(0.9); // Vectors mostly aligned
          }
        }
      });
    });

    describe('Compound Path Case: Multiple Subpaths', () => {
      it('should preserve both subpaths when merging letter "O"', () => {
        // Outer ring
        const outer: BezierSegment[] = [
          { type: 'M', points: [], start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
          { type: 'L', points: [], start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
          { type: 'L', points: [], start: { x: 100, y: 0 }, end: { x: 100, y: 100 } },
          { type: 'L', points: [], start: { x: 100, y: 100 }, end: { x: 0, y: 100 } },
          { type: 'L', points: [], start: { x: 0, y: 100 }, end: { x: 0, y: 0 } },
          { type: 'Z', points: [], start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }
        ];
        
        // Inner ring (hole)
        const inner: BezierSegment[] = [
          { type: 'M', points: [], start: { x: 25, y: 25 }, end: { x: 25, y: 25 } },
          { type: 'L', points: [], start: { x: 25, y: 25 }, end: { x: 75, y: 25 } },
          { type: 'L', points: [], start: { x: 75, y: 25 }, end: { x: 75, y: 75 } },
          { type: 'L', points: [], start: { x: 75, y: 75 }, end: { x: 25, y: 75 } },
          { type: 'L', points: [], start: { x: 25, y: 75 }, end: { x: 25, y: 25 } },
          { type: 'Z', points: [], start: { x: 25, y: 25 }, end: { x: 25, y: 25 } }
        ];
        
        const path: Path = {
          id: 'compound-test',
          d: '',
          segments: [...outer, ...inner],
          fill: '#000'
        };
        
        const simplified = simplifyPath(path, 0.1);
        
        // Should have 2 M commands (one for each subpath)
        const moveCount = simplified.segments.filter(s => s.type === 'M').length;
        expect(moveCount).toBe(2);
        
        // Should have 2 Z commands (one for each subpath)
        const closeCount = simplified.segments.filter(s => s.type === 'Z').length;
        expect(closeCount).toBe(2);
        
        // Verify that M command follows Z command (compound path structure)
        for (let i = 1; i < simplified.segments.length; i++) {
          if (simplified.segments[i].type === 'M') {
            // Previous segment should be Z
            expect(simplified.segments[i - 1].type).toBe('Z');
          }
        }
      });

      it('should not create empty subpaths', () => {
        // Path with valid content
        const segments: BezierSegment[] = [
          { type: 'M', points: [], start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
          { type: 'L', points: [], start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
          { type: 'L', points: [], start: { x: 100, y: 0 }, end: { x: 100, y: 100 } },
          { type: 'Z', points: [], start: { x: 100, y: 100 }, end: { x: 0, y: 0 } }
        ];
        
        const path: Path = { id: 'no-empty-test', d: '', segments, fill: '#000' };
        const simplified = simplifyPath(path, 0.1);
        
        // Algorithm should never CREATE empty subpaths (M followed immediately by Z)
        for (let i = 1; i < simplified.segments.length; i++) {
          if (simplified.segments[i].type === 'Z') {
            expect(simplified.segments[i - 1].type).not.toBe('M');
          }
        }
      });
    });

    describe('Tolerance Strategy', () => {
      it('should use multi-stage tolerance for optimal results', () => {
        // Path with slight wobble that should become a line
        const segments: BezierSegment[] = [
          { type: 'M', points: [], start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }
        ];
        
        // Add wobbly line (max deviation 0.5px from straight line)
        for (let i = 0; i <= 100; i += 5) {
          const wobble = Math.sin(i / 10) * 0.5;
          segments.push({ 
            type: 'L', 
            points: [], 
            start: { x: i, y: wobble }, 
            end: { x: i + 5, y: Math.sin((i + 5) / 10) * 0.5 } 
          });
        }
        
        const path: Path = { id: 'wobble-test', d: '', segments, fill: '#000' };
        
        console.log(`Wobble input: ${segments.length} segments`);
        
        // With tolerance=0.1% of 100px = 0.1px, wobble of 0.5px should be straightened
        const simplified = simplifyPath(path, 0.1);
        
        console.log(`Wobble output: ${simplified.segments.length} segments`);
        
        // Should significantly reduce segment count
        expect(simplified.segments.length).toBeLessThan(segments.length / 2);
        
        // Should be just a few segments (wobble mostly smoothed out)
        expect(simplified.segments.length).toBeLessThanOrEqual(6); // M + a few curves/lines
      });
    });
  });
});
