import { describe, it, expect } from 'vitest';
import { parseSVG, parsePathData, segmentsToPathData, exportSVG } from '../engine/parser';
import type { SVGDocument, BezierSegment } from '../types/svg';

describe('parser', () => {
  describe('parseSVG', () => {
    it('should parse basic SVG with single path', () => {
      const svg = `<svg width="100" height="100"><path d="M 10 10 L 90 90" fill="red"/></svg>`;
      const doc = parseSVG(svg);
      
      expect(doc.width).toBe(100);
      expect(doc.height).toBe(100);
      expect(doc.paths).toHaveLength(1);
      expect(doc.paths[0].fill).toBe('red');
    });

    it('should parse SVG with viewBox', () => {
      const svg = `<svg width="100" height="100" viewBox="0 0 24 24"><path d="M 10 10 L 20 20"/></svg>`;
      const doc = parseSVG(svg);
      
      expect(doc.viewBox).toBeDefined();
      expect(doc.viewBox?.width).toBe(24);
      expect(doc.viewBox?.height).toBe(24);
    });

    it('should parse multiple paths', () => {
      const svg = `<svg width="100" height="100">
        <path d="M 10 10 L 20 20" fill="red"/>
        <path d="M 30 30 L 40 40" fill="blue"/>
        <path d="M 50 50 L 60 60" fill="green"/>
      </svg>`;
      const doc = parseSVG(svg);
      
      expect(doc.paths).toHaveLength(3);
      expect(doc.paths[0].fill).toBe('red');
      expect(doc.paths[1].fill).toBe('blue');
      expect(doc.paths[2].fill).toBe('green');
    });

    it('should parse path with stroke attributes', () => {
      const svg = `<svg><path d="M 0 0 L 10 10" stroke="black" stroke-width="2"/></svg>`;
      const doc = parseSVG(svg);
      
      expect(doc.paths[0].stroke).toBe('black');
      expect(doc.paths[0].strokeWidth).toBe(2);
    });

    it('should parse path with opacity attributes', () => {
      const svg = `<svg><path d="M 0 0 L 10 10" opacity="0.5" fill-opacity="0.8" stroke-opacity="0.3"/></svg>`;
      const doc = parseSVG(svg);
      
      expect(doc.paths[0].opacity).toBe(0.5);
      expect(doc.paths[0].fillOpacity).toBe(0.8);
      expect(doc.paths[0].strokeOpacity).toBe(0.3);
    });

    it('should parse path with transform', () => {
      const svg = `<svg><path d="M 0 0 L 10 10" transform="translate(50,100)"/></svg>`;
      const doc = parseSVG(svg);
      
      expect(doc.paths[0].transform).toBeDefined();
      expect(doc.paths[0].transform?.raw).toBe('translate(50,100)');
    });

    it('should parse path with id', () => {
      const svg = `<svg><path id="mypath" d="M 0 0 L 10 10"/></svg>`;
      const doc = parseSVG(svg);
      
      expect(doc.paths[0].id).toBe('mypath');
    });

    it('should generate id if not provided', () => {
      const svg = `<svg><path d="M 0 0 L 10 10"/></svg>`;
      const doc = parseSVG(svg);
      
      expect(doc.paths[0].id).toBe('path-0');
    });

    it('should throw error for invalid SVG', () => {
      const invalid = 'not an svg';
      expect(() => parseSVG(invalid)).toThrow();
    });

    it('should use viewBox dimensions if width/height not specified', () => {
      const svg = `<svg viewBox="0 0 200 150"><path d="M 0 0 L 10 10"/></svg>`;
      const doc = parseSVG(svg);
      
      expect(doc.width).toBe(200);
      expect(doc.height).toBe(150);
    });

    it('should default to 400x400 if no dimensions specified', () => {
      const svg = `<svg><path d="M 0 0 L 10 10"/></svg>`;
      const doc = parseSVG(svg);
      
      expect(doc.width).toBe(400);
      expect(doc.height).toBe(400);
    });
  });

  describe('parsePathData', () => {
    it('should parse moveto and lineto commands', () => {
      const segments = parsePathData('M 10 20 L 30 40');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].type).toBe('M');
      expect(segments[0].start).toEqual({ x: 10, y: 20 });
      expect(segments[1].type).toBe('L');
      expect(segments[1].end).toEqual({ x: 30, y: 40 });
    });

    it('should parse cubic bezier curve', () => {
      const segments = parsePathData('M 0 0 C 10 10 20 20 30 30');
      
      expect(segments).toHaveLength(2);
      expect(segments[1].type).toBe('C');
      expect(segments[1].points).toHaveLength(2);  // Only control points, not end
      expect(segments[1].points[0]).toEqual({ x: 10, y: 10 });  // cp1
      expect(segments[1].points[1]).toEqual({ x: 20, y: 20 });  // cp2
      expect(segments[1].end).toEqual({ x: 30, y: 30 });  // end point separate
    });

    it('should parse quadratic bezier curve', () => {
      const segments = parsePathData('M 0 0 Q 10 10 20 20');
      
      expect(segments).toHaveLength(2);
      expect(segments[1].type).toBe('Q');
      expect(segments[1].points).toHaveLength(1);  // Only control point, not end
      expect(segments[1].points[0]).toEqual({ x: 10, y: 10 });  // cp
      expect(segments[1].end).toEqual({ x: 20, y: 20 });  // end point separate
    });

    it('should parse closepath command', () => {
      const segments = parsePathData('M 0 0 L 10 0 L 10 10 Z');
      
      expect(segments).toHaveLength(4);
      expect(segments[3].type).toBe('Z');
    });

    it('should handle lowercase commands', () => {
      const segments = parsePathData('m 10 20 l 5 5');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].type).toBe('M');
      expect(segments[1].type).toBe('L');
    });

    it('should handle commas as separators', () => {
      const segments = parsePathData('M 10,20 L 30,40');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].start).toEqual({ x: 10, y: 20 });
      expect(segments[1].end).toEqual({ x: 30, y: 40 });
    });

    it('should handle mixed whitespace and commas', () => {
      const segments = parsePathData('M 10, 20  L  30 , 40');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].start).toEqual({ x: 10, y: 20 });
    });

    it('should handle negative numbers', () => {
      const segments = parsePathData('M -10 -20 L -30 -40');
      
      expect(segments[0].start).toEqual({ x: -10, y: -20 });
      expect(segments[1].end).toEqual({ x: -30, y: -40 });
    });

    it('should handle decimal numbers', () => {
      const segments = parsePathData('M 10.5 20.75 L 30.25 40.5');
      
      expect(segments[0].start.x).toBeCloseTo(10.5);
      expect(segments[0].start.y).toBeCloseTo(20.75);
    });

    it('should handle empty path data', () => {
      const segments = parsePathData('');
      expect(segments).toHaveLength(0);
    });

    // Note: H, V, S, A commands and implicit lineto are not yet implemented in parser
    // These are less common SVG path commands that could be added in the future
  });

  describe('segmentsToPathData', () => {
    it('should convert segments back to path data', () => {
      const segments: BezierSegment[] = [
        {
          type: 'M',
          start: { x: 10, y: 20 },
          end: { x: 10, y: 20 },
          points: []
        },
        {
          type: 'L',
          start: { x: 10, y: 20 },
          end: { x: 30, y: 40 },
          points: []  // L segments have no control points
        }
      ];
      
      const pathData = segmentsToPathData(segments);
      expect(pathData).toContain('M 10 20');
      expect(pathData).toContain('L 30 40');
    });

    it('should handle cubic bezier curves', () => {
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
          end: { x: 30, y: 30 },
          points: [{ x: 10, y: 10 }, { x: 20, y: 20 }]  // Only control points
        }
      ];
      
      const pathData = segmentsToPathData(segments);
      expect(pathData).toContain('C');
      expect(pathData).toContain('10 10');
    });

    it('should handle quadratic bezier curves', () => {
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
          end: { x: 20, y: 20 },
          points: [{ x: 10, y: 10 }]  // Only control point
        }
      ];
      
      const pathData = segmentsToPathData(segments);
      expect(pathData).toContain('Q');
    });

    it('should handle closepath', () => {
      const segments: BezierSegment[] = [
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
      ];
      
      const pathData = segmentsToPathData(segments);
      expect(pathData).toContain('Z');
    });

    it('should handle empty segments', () => {
      const pathData = segmentsToPathData([]);
      expect(pathData).toBe('');
    });
  });

  describe('exportSVG', () => {
    it('should export document back to SVG string', () => {
      const doc: SVGDocument = {
        width: 100,
        height: 100,
        paths: [
          {
            id: 'path-0',
            d: 'M 10 10 L 90 90',
            fill: 'red',
            segments: []
          }
        ],
        groups: []
      };
      
      const svg = exportSVG(doc);
      expect(svg).toContain('<svg');
      expect(svg).toContain('width="100"');
      expect(svg).toContain('height="100"');
      expect(svg).toContain('<path');
      expect(svg).toContain('fill="red"');
      expect(svg).toContain('M 10 10 L 90 90');
    });

    it('should include viewBox if present', () => {
      const doc: SVGDocument = {
        width: 100,
        height: 100,
        viewBox: { x: 0, y: 0, width: 24, height: 24 },
        paths: [],
        groups: []
      };
      
      const svg = exportSVG(doc);
      expect(svg).toContain('viewBox="0 0 24 24"');
    });

    it('should include stroke attributes', () => {
      const doc: SVGDocument = {
        width: 100,
        height: 100,
        paths: [
          {
            id: 'path-0',
            d: 'M 0 0 L 10 10',
            stroke: 'black',
            strokeWidth: 2,
            segments: []
          }
        ],
        groups: []
      };
      
      const svg = exportSVG(doc);
      expect(svg).toContain('stroke="black"');
      expect(svg).toContain('stroke-width="2"');
    });

    it('should include opacity attributes', () => {
      const doc: SVGDocument = {
        width: 100,
        height: 100,
        paths: [
          {
            id: 'path-0',
            d: 'M 0 0 L 10 10',
            opacity: 0.5,
            fillOpacity: 0.8,
            strokeOpacity: 0.3,
            segments: []
          }
        ],
        groups: []
      };
      
      const svg = exportSVG(doc);
      expect(svg).toContain('opacity="0.5"');
      expect(svg).toContain('fill-opacity="0.8"');
      expect(svg).toContain('stroke-opacity="0.3"');
    });

    it('should include transform if present', () => {
      const doc: SVGDocument = {
        width: 100,
        height: 100,
        paths: [
          {
            id: 'path-0',
            d: 'M 0 0 L 10 10',
            transform: { raw: 'translate(50,100)' },
            segments: []
          }
        ],
        groups: []
      };
      
      const svg = exportSVG(doc);
      expect(svg).toContain('transform="translate(50,100)"');
    });

    it('should handle multiple paths', () => {
      const doc: SVGDocument = {
        width: 100,
        height: 100,
        paths: [
          { id: 'path-0', d: 'M 0 0 L 10 10', segments: [] },
          { id: 'path-1', d: 'M 20 20 L 30 30', segments: [] },
          { id: 'path-2', d: 'M 40 40 L 50 50', segments: [] }
        ],
        groups: []
      };
      
      const svg = exportSVG(doc);
      expect(svg.match(/<path/g)?.length).toBe(3);
    });

    it('should omit optional attributes if not present', () => {
      const doc: SVGDocument = {
        width: 100,
        height: 100,
        paths: [
          {
            id: 'path-0',
            d: 'M 0 0 L 10 10',
            segments: []
          }
        ],
        groups: []
      };
      
      const svg = exportSVG(doc);
      expect(svg).not.toContain('fill=');
      expect(svg).not.toContain('stroke=');
      expect(svg).not.toContain('opacity=');
    });
  });

  describe('parsePathData - extended commands', () => {
    describe('H (horizontal line) command', () => {
      it('should parse absolute H command', () => {
        const segments = parsePathData('M 10 20 H 50');
        expect(segments).toHaveLength(2);
        expect(segments[1].type).toBe('L');
        expect(segments[1].end.x).toBe(50);
        expect(segments[1].end.y).toBe(20); // Y stays the same
      });

      it('should parse relative h command', () => {
        const segments = parsePathData('M 10 20 h 30');
        expect(segments).toHaveLength(2);
        expect(segments[1].type).toBe('L');
        expect(segments[1].end.x).toBe(40); // 10 + 30
        expect(segments[1].end.y).toBe(20);
      });

      it('should parse multiple H values', () => {
        const segments = parsePathData('M 0 0 H 10 20 30');
        expect(segments).toHaveLength(4);
        expect(segments[1].end.x).toBe(10);
        expect(segments[2].end.x).toBe(20);
        expect(segments[3].end.x).toBe(30);
      });
    });

    describe('V (vertical line) command', () => {
      it('should parse absolute V command', () => {
        const segments = parsePathData('M 10 20 V 50');
        expect(segments).toHaveLength(2);
        expect(segments[1].type).toBe('L');
        expect(segments[1].end.x).toBe(10); // X stays the same
        expect(segments[1].end.y).toBe(50);
      });

      it('should parse relative v command', () => {
        const segments = parsePathData('M 10 20 v 30');
        expect(segments).toHaveLength(2);
        expect(segments[1].type).toBe('L');
        expect(segments[1].end.x).toBe(10);
        expect(segments[1].end.y).toBe(50); // 20 + 30
      });

      it('should parse multiple V values', () => {
        const segments = parsePathData('M 0 0 V 10 20 30');
        expect(segments).toHaveLength(4);
        expect(segments[1].end.y).toBe(10);
        expect(segments[2].end.y).toBe(20);
        expect(segments[3].end.y).toBe(30);
      });
    });

    describe('S (smooth cubic bezier) command', () => {
      it('should parse absolute S command after C', () => {
        const segments = parsePathData('M 10 10 C 20 20 30 30 40 40 S 60 60 70 70');
        expect(segments).toHaveLength(3);
        expect(segments[2].type).toBe('C');
        // First control point should be reflection of (30,30) across (40,40)
        expect(segments[2].points[0].x).toBe(50); // 2*40 - 30
        expect(segments[2].points[0].y).toBe(50); // 2*40 - 30
        expect(segments[2].points[1].x).toBe(60);
        expect(segments[2].points[1].y).toBe(60);
        expect(segments[2].end.x).toBe(70);
        expect(segments[2].end.y).toBe(70);
      });

      it('should parse relative s command', () => {
        const segments = parsePathData('M 10 10 C 20 20 30 30 40 40 s 20 20 30 30');
        expect(segments).toHaveLength(3);
        expect(segments[2].type).toBe('C');
        expect(segments[2].end.x).toBe(70); // 40 + 30
        expect(segments[2].end.y).toBe(70); // 40 + 30
      });

      it('should use current point if no previous control point', () => {
        const segments = parsePathData('M 10 10 S 30 30 40 40');
        expect(segments).toHaveLength(2);
        expect(segments[1].type).toBe('C');
        // First control point should be current point
        expect(segments[1].points[0].x).toBe(10);
        expect(segments[1].points[0].y).toBe(10);
      });
    });

    describe('T (smooth quadratic bezier) command', () => {
      it('should parse absolute T command after Q', () => {
        const segments = parsePathData('M 10 10 Q 30 30 50 50 T 90 90');
        expect(segments).toHaveLength(3);
        expect(segments[2].type).toBe('Q');
        // Control point should be reflection of (30,30) across (50,50)
        expect(segments[2].points[0].x).toBe(70); // 2*50 - 30
        expect(segments[2].points[0].y).toBe(70); // 2*50 - 30
        expect(segments[2].end.x).toBe(90);
        expect(segments[2].end.y).toBe(90);
      });

      it('should parse relative t command', () => {
        const segments = parsePathData('M 10 10 Q 30 30 50 50 t 40 40');
        expect(segments).toHaveLength(3);
        expect(segments[2].type).toBe('Q');
        expect(segments[2].end.x).toBe(90); // 50 + 40
        expect(segments[2].end.y).toBe(90); // 50 + 40
      });

      it('should use current point if no previous control point', () => {
        const segments = parsePathData('M 10 10 T 50 50');
        expect(segments).toHaveLength(2);
        expect(segments[1].type).toBe('Q');
        // Control point should be current point
        expect(segments[1].points[0].x).toBe(10);
        expect(segments[1].points[0].y).toBe(10);
      });

      it('should chain multiple T commands', () => {
        const segments = parsePathData('M 0 0 Q 25 50 50 0 T 100 0 T 150 0');
        expect(segments).toHaveLength(4);
        expect(segments[1].type).toBe('Q');
        expect(segments[2].type).toBe('Q');
        expect(segments[3].type).toBe('Q');
      });
    });

    describe('A (arc) command', () => {
      it('should parse absolute A command', () => {
        const segments = parsePathData('M 10 10 A 30 30 0 0 1 40 40');
        expect(segments).toHaveLength(2);
        // Arc is converted to cubic bezier(s)
        expect(segments[1].type).toBe('C');
        expect(segments[1].end.x).toBeCloseTo(40, 1);
        expect(segments[1].end.y).toBeCloseTo(40, 1);
      });

      it('should parse relative a command', () => {
        const segments = parsePathData('M 10 10 a 30 30 0 0 1 30 30');
        expect(segments).toHaveLength(2);
        expect(segments[1].type).toBe('C');
        expect(segments[1].end.x).toBeCloseTo(40, 1);
        expect(segments[1].end.y).toBeCloseTo(40, 1);
      });

      it('should handle different arc flags', () => {
        // Large arc flag and sweep flag combinations
        const segments1 = parsePathData('M 0 0 A 50 50 0 0 0 100 0');
        const segments2 = parsePathData('M 0 0 A 50 50 0 0 1 100 0');
        const segments3 = parsePathData('M 0 0 A 50 50 0 1 0 100 0');
        const segments4 = parsePathData('M 0 0 A 50 50 0 1 1 100 0');
        
        expect(segments1[1].type).toBe('C');
        expect(segments2[1].type).toBe('C');
        expect(segments3[1].type).toBe('C');
        expect(segments4[1].type).toBe('C');
      });

      it('should handle rotated ellipse', () => {
        const segments = parsePathData('M 10 10 A 30 20 45 0 1 50 50');
        // Large arcs may be split into multiple cubic bezier segments
        expect(segments.length).toBeGreaterThanOrEqual(2);
        expect(segments[segments.length - 1].type).toBe('C');
        expect(segments[segments.length - 1].end.x).toBeCloseTo(50, 1);
        expect(segments[segments.length - 1].end.y).toBeCloseTo(50, 1);
      });

      it('should handle degenerate arc (zero radius)', () => {
        const segments = parsePathData('M 10 10 A 0 0 0 0 1 20 20');
        expect(segments).toHaveLength(2);
        expect(segments[1].end.x).toBe(20);
        expect(segments[1].end.y).toBe(20);
      });

      it('should handle arc to same point', () => {
        const segments = parsePathData('M 10 10 A 30 30 0 0 1 10 10');
        expect(segments).toHaveLength(2);
        expect(segments[1].end.x).toBe(10);
        expect(segments[1].end.y).toBe(10);
      });
    });

    describe('mixed commands', () => {
      it('should parse path with all command types', () => {
        const pathData = 'M 0 0 H 10 V 10 L 20 20 C 25 25 30 30 35 35 S 45 45 50 50 Q 60 60 70 70 T 90 90 A 20 20 0 0 1 110 90 Z';
        const segments = parsePathData(pathData);
        
        expect(segments[0].type).toBe('M');
        expect(segments[1].type).toBe('L'); // H -> L
        expect(segments[2].type).toBe('L'); // V -> L
        expect(segments[3].type).toBe('L');
        expect(segments[4].type).toBe('C');
        expect(segments[5].type).toBe('C'); // S -> C
        expect(segments[6].type).toBe('Q');
        expect(segments[7].type).toBe('Q'); // T -> Q
        expect(segments[8].type).toBe('C'); // A -> C
        expect(segments[9].type).toBe('Z');
      });

      it('should reset control point tracking after non-curve commands', () => {
        const segments = parsePathData('M 0 0 C 10 10 20 20 30 30 L 40 40 S 50 50 60 60');
        expect(segments).toHaveLength(4);
        // S after L should use current point as first control
        expect(segments[3].points[0].x).toBe(40);
        expect(segments[3].points[0].y).toBe(40);
      });

      it('should reset control point tracking after M command', () => {
        const segments = parsePathData('M 0 0 C 10 10 20 20 30 30 M 40 40 S 50 50 60 60');
        expect(segments).toHaveLength(4);
        // S after M should use current point as first control
        expect(segments[3].points[0].x).toBe(40);
        expect(segments[3].points[0].y).toBe(40);
      });
    });
  });

  describe('round-trip parsing', () => {
    it('should preserve data through parse and export cycle', () => {
      const original = `<svg width="100" height="100" viewBox="0 0 24 24">
        <path id="test" d="M 10 10 L 90 90" fill="red" stroke="black" stroke-width="2" opacity="0.8"/>
      </svg>`;
      
      const doc = parseSVG(original);
      const exported = exportSVG(doc);
      const reparsed = parseSVG(exported);
      
      expect(reparsed.width).toBe(doc.width);
      expect(reparsed.height).toBe(doc.height);
      expect(reparsed.paths[0].fill).toBe(doc.paths[0].fill);
      expect(reparsed.paths[0].stroke).toBe(doc.paths[0].stroke);
      expect(reparsed.paths[0].strokeWidth).toBe(doc.paths[0].strokeWidth);
      expect(reparsed.paths[0].opacity).toBe(doc.paths[0].opacity);
    });

    it('should preserve path data through segmentation and reconstruction', () => {
      const pathData = 'M 10 20 L 30 40 C 50 60 70 80 90 100 Z';
      const segments = parsePathData(pathData);
      const reconstructed = segmentsToPathData(segments);
      const reparsed = parsePathData(reconstructed);
      
      expect(reparsed).toHaveLength(segments.length);
      expect(reparsed[0].type).toBe(segments[0].type);
      expect(reparsed[1].type).toBe(segments[1].type);
    });
  });

  describe('SVG shape element support', () => {
    describe('<rect> conversion', () => {
      it('converts a plain rect to a closed rectangular path', () => {
        const svg = `<svg width="100" height="100"><rect x="10" y="20" width="80" height="60"/></svg>`;
        const doc = parseSVG(svg);

        expect(doc.paths).toHaveLength(1);
        const p = doc.paths[0];
        expect(p.id).toBe('rect-0');
        expect(p.segments.length).toBeGreaterThan(0);
        // Check corners using segment end-points
        const ends = p.segments.map(s => s.end);
        expect(ends.some(pt => Math.abs(pt.x - 10) < 0.01 && Math.abs(pt.y - 20) < 0.01)).toBe(true); // top-left after Z
        expect(ends.some(pt => Math.abs(pt.x - 90) < 0.01 && Math.abs(pt.y - 20) < 0.01)).toBe(true); // top-right
        expect(ends.some(pt => Math.abs(pt.x - 90) < 0.01 && Math.abs(pt.y - 80) < 0.01)).toBe(true); // bottom-right
        expect(ends.some(pt => Math.abs(pt.x - 10) < 0.01 && Math.abs(pt.y - 80) < 0.01)).toBe(true); // bottom-left
      });

      it('converts a rounded rect (rx/ry) to a path with arc segments', () => {
        const svg = `<svg width="100" height="100"><rect x="0" y="0" width="100" height="50" rx="10" ry="10"/></svg>`;
        const doc = parseSVG(svg);

        expect(doc.paths).toHaveLength(1);
        const p = doc.paths[0];
        // Rounded rect produces more segments than a plain rect
        expect(p.segments.length).toBeGreaterThan(5);
        // Last segment should be Z (closed)
        const lastNonZ = [...p.segments].reverse().find(s => s.type !== 'Z');
        expect(lastNonZ).toBeDefined();
      });

      it('respects rx only — ry defaults to rx', () => {
        const svg = `<svg><rect x="0" y="0" width="60" height="40" rx="8"/></svg>`;
        const doc = parseSVG(svg);
        expect(doc.paths[0].segments.length).toBeGreaterThan(5);
      });

      it('preserves fill, stroke and id', () => {
        const svg = `<svg><rect id="box" x="0" y="0" width="10" height="10" fill="blue" stroke="red" stroke-width="2"/></svg>`;
        const doc = parseSVG(svg);
        const p = doc.paths[0];
        expect(p.id).toBe('box');
        expect(p.fill).toBe('blue');
        expect(p.stroke).toBe('red');
        expect(p.strokeWidth).toBe(2);
      });
    });

    describe('<line> conversion', () => {
      it('converts a line to M…L path', () => {
        const svg = `<svg><line x1="10" y1="20" x2="90" y2="80"/></svg>`;
        const doc = parseSVG(svg);

        expect(doc.paths).toHaveLength(1);
        const p = doc.paths[0];
        expect(p.id).toBe('line-0');
        expect(p.segments[0].type).toBe('M');
        expect(p.segments[0].start.x).toBeCloseTo(10);
        expect(p.segments[0].start.y).toBeCloseTo(20);
        expect(p.segments[1].type).toBe('L');
        expect(p.segments[1].end.x).toBeCloseTo(90);
        expect(p.segments[1].end.y).toBeCloseTo(80);
      });

      it('preserves id and stroke on line', () => {
        const svg = `<svg><line id="myline" x1="0" y1="0" x2="50" y2="50" stroke="#333" stroke-width="3"/></svg>`;
        const doc = parseSVG(svg);
        expect(doc.paths[0].id).toBe('myline');
        expect(doc.paths[0].stroke).toBe('#333');
        expect(doc.paths[0].strokeWidth).toBe(3);
      });
    });

    describe('<polygon> conversion', () => {
      it('converts a triangle polygon to a closed path', () => {
        const svg = `<svg><polygon points="50,0 100,100 0,100"/></svg>`;
        const doc = parseSVG(svg);

        expect(doc.paths).toHaveLength(1);
        const p = doc.paths[0];
        expect(p.segments[0].type).toBe('M');
        expect(p.segments[0].start).toMatchObject({ x: 50, y: 0 });
        // Should end with Z
        expect(p.segments[p.segments.length - 1].type).toBe('Z');
      });

      it('handles comma-separated points', () => {
        const svg = `<svg><polygon points="0,0,100,0,100,100,0,100"/></svg>`;
        const doc = parseSVG(svg);
        // 4 vertices → M + 3×L + Z = 5 segments
        expect(doc.paths[0].segments).toHaveLength(5);
      });
    });

    describe('<polyline> conversion', () => {
      it('converts polyline to an open path (no Z)', () => {
        const svg = `<svg><polyline points="10,10 50,80 90,10"/></svg>`;
        const doc = parseSVG(svg);

        expect(doc.paths).toHaveLength(1);
        const p = doc.paths[0];
        expect(p.id).toBe('polyline-0');
        // Open path: last segment must NOT be Z
        expect(p.segments[p.segments.length - 1].type).not.toBe('Z');
      });
    });

    describe('<g> transform propagation', () => {
      it('applies group translate to child path', () => {
        const svg = `<svg><g transform="translate(50,100)"><path d="M 0 0 L 10 10"/></g></svg>`;
        const doc = parseSVG(svg);

        expect(doc.paths).toHaveLength(1);
        const p = doc.paths[0];
        expect(p.transform?.raw).toContain('translate(50,100)');
      });

      it('concatenates nested group transforms', () => {
        const svg = `<svg>
          <g transform="translate(10,0)">
            <g transform="scale(2)">
              <path d="M 0 0 L 5 5"/>
            </g>
          </g>
        </svg>`;
        const doc = parseSVG(svg);

        expect(doc.paths).toHaveLength(1);
        // Both group transforms should appear in the combined transform
        expect(doc.paths[0].transform?.raw).toContain('translate(10,0)');
        expect(doc.paths[0].transform?.raw).toContain('scale(2)');
      });

      it('ignores groups with no transform', () => {
        const svg = `<svg><g><path d="M 0 0 L 10 10"/></g></svg>`;
        const doc = parseSVG(svg);
        expect(doc.paths[0].transform).toBeUndefined();
      });

      it('merges own path transform with ancestor group transform', () => {
        const svg = `<svg>
          <g transform="translate(20,30)">
            <path d="M 0 0 L 10 10" transform="rotate(45)"/>
          </g>
        </svg>`;
        const doc = parseSVG(svg);
        const raw = doc.paths[0].transform?.raw ?? '';
        expect(raw).toContain('translate(20,30)');
        expect(raw).toContain('rotate(45)');
      });

      it('applies group transform to non-path shapes inside group', () => {
        const svg = `<svg><g transform="translate(5,5)"><rect x="0" y="0" width="10" height="10"/></g></svg>`;
        const doc = parseSVG(svg);
        expect(doc.paths[0].transform?.raw).toContain('translate(5,5)');
      });
    });

    describe('document order preservation', () => {
      it('preserves z-order: paths, circles, rects in declaration order', () => {
        const svg = `<svg>
          <path id="first" d="M 0 0 L 1 1" fill="red"/>
          <circle id="second" cx="50" cy="50" r="30" fill="green"/>
          <rect id="third" x="10" y="10" width="20" height="20" fill="blue"/>
        </svg>`;
        const doc = parseSVG(svg);
        expect(doc.paths).toHaveLength(3);
        expect(doc.paths[0].id).toBe('first');
        expect(doc.paths[1].id).toBe('second');
        expect(doc.paths[2].id).toBe('third');
      });
    });
  });
});
