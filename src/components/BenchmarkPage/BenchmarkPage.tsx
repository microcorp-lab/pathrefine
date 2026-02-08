import React, { useEffect, useState } from 'react';
import { parsePathData } from '../../engine/parser';
import { simplifyPath } from '../../engine/pathMerging';

interface TestCase {
  name: string;
  description: string;
  file: string;
  expectedReduction: number;
}

interface BenchmarkResult {
  name: string;
  originalSegments: number;
  simplifiedSegments: number;
  reduction: number;
  processingTime: number;
  originalPath: string;
  simplifiedPath: string;
  stroke: string;
  fill: string;
  strokeWidth: string;
  originalParsedSegments: any[];
  simplifiedParsedSegments: any[];
}

const testCases: TestCase[] = [
  {
    name: 'Straight Line with Redundancy',
    description: '50 collinear points that should reduce to 2',
    file: '/test-svgs/redundant-line.svg',
    expectedReduction: 95
  },
  {
    name: 'Sine Wave Pattern',
    description: '100 line segments approximating smooth curve',
    file: '/test-svgs/redundant-curve.svg',
    expectedReduction: 70
  },
  {
    name: 'Nearly Straight Curve',
    description: 'Cubic Bezier with minimal curvature (should convert to line)',
    file: '/test-svgs/nearly-straight-curve.svg',
    expectedReduction: 0
  },
  {
    name: 'True Curve',
    description: 'Genuinely curved Bezier (should stay as curve)',
    file: '/test-svgs/true-curve.svg',
    expectedReduction: 0
  },
  {
    name: 'Circle from Lines',
    description: '200 short line segments forming a circle',
    file: '/test-svgs/circle-many-lines.svg',
    expectedReduction: 85
  },
  {
    name: 'Circle: Tiny Curves (Nearly Straight)',
    description: '36 tiny curves (0.1px deviation each) - should merge with cumulative curvature',
    file: '/test-svgs/circle-bezier-tiny.svg',
    expectedReduction: 75
  },
  {
    name: 'Circle: Proper Bezier Curves',
    description: '16 proper curves (optimal is 4) - should stay as curves',
    file: '/test-svgs/circle-bezier.svg',
    expectedReduction: 0
  },
  {
    name: 'Complex Mixed Shape',
    description: 'Mix of curves and lines with many redundant segments',
    file: '/test-svgs/complex-shape.svg',
    expectedReduction: 60
  },
  {
    name: '⭐ Star (Sharp Corners)',
    description: '5-pointed star - corners should stay sharp with G1 continuity',
    file: '/test-svgs/star.svg',
    expectedReduction: 85
  },
  {
    name: '◼️ Square (90° Corners)',
    description: 'Square with many points per edge - corners should stay at 90°',
    file: '/test-svgs/square.svg',
    expectedReduction: 90
  },
  {
    name: '▲ Triangle (Sharp Corners)',
    description: 'Equilateral triangle - test corner detection at 60° angles',
    file: '/test-svgs/triangle.svg',
    expectedReduction: 85
  },
  {
    name: '💎 Diamond (4 Sharp Corners)',
    description: 'Diamond shape - test corner preservation at 45° and 135°',
    file: '/test-svgs/diamond.svg',
    expectedReduction: 85
  },
  {
    name: '❤️ Heart (Mixed: Curves + Sharp Bottom)',
    description: 'Heart - smooth curves on top, sharp point at bottom',
    file: '/test-svgs/heart.svg',
    expectedReduction: 70
  }
];

export const BenchmarkPage: React.FC = () => {
  const [tolerance, setTolerance] = useState(0.1); // Percentage of bounding box diagonal
  const [benchmarkState, setBenchmarkState] = useState<{
    results: BenchmarkResult[];
    isRunning: boolean;
  }>({ results: [], isRunning: true });
  const [showPoints, setShowPoints] = useState(false);

  const { results, isRunning } = benchmarkState;

  const loadSVG = async (file: string): Promise<{ d: string; stroke: string; fill: string; strokeWidth: string }> => {
    const response = await fetch(file);
    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'image/svg+xml');
    const pathElement = doc.querySelector('path');
    return {
      d: pathElement?.getAttribute('d') || '',
      stroke: pathElement?.getAttribute('stroke') || '#000',
      fill: pathElement?.getAttribute('fill') || 'none',
      strokeWidth: pathElement?.getAttribute('stroke-width') || '2'
    };
  };

  const renderPoints = (segments: any[]) => {
    if (!showPoints) return null;
    
    const points: JSX.Element[] = [];
    segments.forEach((seg, idx) => {
      // Render end point
      points.push(
        <circle
          key={`end-${idx}`}
          cx={seg.end.x}
          cy={seg.end.y}
          r="2"
          fill="#ef4444"
          stroke="#fff"
          strokeWidth="0.5"
        />
      );
      
      // Render control points for curves
      if (seg.type === 'C' && seg.points && seg.points.length >= 2) {
        points.push(
          <circle
            key={`cp1-${idx}`}
            cx={seg.points[0].x}
            cy={seg.points[0].y}
            r="1.5"
            fill="#fbbf24"
            stroke="#fff"
            strokeWidth="0.5"
            opacity="0.7"
          />
        );
        points.push(
          <circle
            key={`cp2-${idx}`}
            cx={seg.points[1].x}
            cy={seg.points[1].y}
            r="1.5"
            fill="#fbbf24"
            stroke="#fff"
            strokeWidth="0.5"
            opacity="0.7"
          />
        );
      } else if (seg.type === 'Q' && seg.points && seg.points.length >= 1) {
        points.push(
          <circle
            key={`cp-${idx}`}
            cx={seg.points[0].x}
            cy={seg.points[0].y}
            r="1.5"
            fill="#fbbf24"
            stroke="#fff"
            strokeWidth="0.5"
            opacity="0.7"
          />
        );
      }
    });
    
    return points;
  };

  const runBenchmarks = async (): Promise<BenchmarkResult[]> => {
    const benchmarkResults: BenchmarkResult[] = [];

    for (const testCase of testCases) {
      try {
        const pathData = await loadSVG(testCase.file);
        const segments = parsePathData(pathData.d);
        const originalPath = {
          id: 'test',
          d: pathData.d,
          segments,
          fill: 'none'
        };

        const startTime = performance.now();
        const simplifiedPath = simplifyPath(originalPath, tolerance);
        const endTime = performance.now();

        const originalSegments = originalPath.segments.length;
        const simplifiedSegments = simplifiedPath.segments.length;
        const reduction = ((originalSegments - simplifiedSegments) / originalSegments * 100);
        const processingTime = endTime - startTime;

        benchmarkResults.push({
          name: testCase.name,
          originalSegments,
          simplifiedSegments,
          reduction,
          processingTime,
          originalPath: pathData.d,
          simplifiedPath: simplifiedPath.d,
          stroke: pathData.stroke,
          fill: pathData.fill,
          strokeWidth: pathData.strokeWidth,
          originalParsedSegments: originalPath.segments,
          simplifiedParsedSegments: simplifiedPath.segments
        });
      } catch (error) {
        console.error(`Error processing ${testCase.name}:`, error);
      }
    }

    return benchmarkResults;
  };

  useEffect(() => {
    let cancelled = false;
    
    runBenchmarks().then(benchmarkResults => {
      if (!cancelled) {
        setBenchmarkState({ results: benchmarkResults, isRunning: false });
      }
    });
    
    return () => {
      cancelled = true;
    };
  }, []);

  const totalOriginal = results.reduce((sum, r) => sum + r.originalSegments, 0);
  const totalSimplified = results.reduce((sum, r) => sum + r.simplifiedSegments, 0);
  const avgReduction = results.length > 0 ? (results.reduce((sum, r) => sum + r.reduction, 0) / results.length) : 0;
  const totalTime = results.reduce((sum, r) => sum + r.processingTime, 0);
  const avgTime = results.length > 0 ? totalTime / results.length : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
          Path Simplification Benchmark
        </h1>
        <p className="text-slate-400 text-lg mb-8">
          Testing hybrid segment-aware simplification algorithm
        </p>

        <div className="bg-slate-800 p-6 rounded-xl mb-8 flex gap-6 items-center flex-wrap">
          <div className="flex flex-col gap-2">
            <label className="text-slate-300 text-sm font-medium">
              Tolerance: <span className="text-blue-500 font-semibold">{tolerance.toFixed(2)}%</span>
              <span className="text-slate-500 text-xs ml-2">(of path bounding box diagonal)</span>
            </label>
            <input
              type="range"
              min="0.01"
              max="2.0"
              step="0.01"
              value={tolerance}
              onChange={(e) => setTolerance(parseFloat(e.target.value))}
              className="w-64"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showPoints"
              checked={showPoints}
              onChange={(e) => setShowPoints(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="showPoints" className="text-slate-300 text-sm font-medium cursor-pointer">
              Show Point Locations
            </label>
          </div>
          <button
            onClick={runBenchmarks}
            disabled={isRunning}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white px-6 py-2 rounded-lg font-semibold transition-all"
          >
            {isRunning ? 'Running...' : 'Run Benchmarks'}
          </button>
        </div>

        {results.length === 0 && !isRunning && (
          <div className="text-center py-12 text-slate-500">
            Click "Run Benchmarks" to start
          </div>
        )}

        <div className="space-y-8">
          {results.map((result, idx) => (
            <div key={idx} className="bg-slate-800 rounded-xl p-6 border-2 border-slate-700">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-slate-100 mb-2">{result.name}</h2>
                <p className="text-slate-400 text-sm">{testCases[idx].description}</p>
              </div>

              <div className="grid grid-cols-3 gap-6 mb-6">
                <div className="bg-slate-950 rounded-lg p-4 border border-slate-700">
                  <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-3">Original</div>
                  <div className="bg-white rounded p-4 flex items-center justify-center min-h-[200px]">
                    <svg width="300" height="200" viewBox="0 0 400 300">
                      <path
                        d={result.originalPath}
                        stroke={result.stroke}
                        fill={result.fill}
                        strokeWidth={result.strokeWidth}
                      />
                      {renderPoints(result.originalParsedSegments)}
                    </svg>
                  </div>
                </div>

                <div className="bg-slate-950 rounded-lg p-4 border border-slate-700">
                  <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-3">Simplified</div>
                  <div className="bg-white rounded p-4 flex items-center justify-center min-h-[200px]">
                    <svg width="300" height="200" viewBox="0 0 400 300">
                      <path
                        d={result.simplifiedPath}
                        stroke={result.stroke}
                        fill={result.fill}
                        strokeWidth={result.strokeWidth}
                      />
                      {renderPoints(result.simplifiedParsedSegments)}
                    </svg>
                  </div>
                </div>

                <div className="bg-slate-950 rounded-lg p-4 border border-slate-700">
                  <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-3">Overlay (Deviation)</div>
                  <div className="bg-white rounded p-4 flex items-center justify-center min-h-[200px]">
                    <svg width="300" height="200" viewBox="0 0 400 300">
                      <path
                        d={result.originalPath}
                        stroke="#94a3b8"
                        fill="none"
                        strokeWidth="3"
                        opacity="0.5"
                      />
                      <path
                        d={result.simplifiedPath}
                        stroke="#ef4444"
                        fill="none"
                        strokeWidth="2"
                      />
                      {showPoints && (
                        <>
                          <g opacity="0.3">{renderPoints(result.originalParsedSegments)}</g>
                          <g>{renderPoints(result.simplifiedParsedSegments)}</g>
                        </>
                      )}
                    </svg>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Original Segments</div>
                  <div className="text-2xl font-bold text-slate-100">{result.originalSegments}</div>
                </div>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Simplified Segments</div>
                  <div className="text-2xl font-bold text-slate-100">{result.simplifiedSegments}</div>
                  {result.reduction > 0 && (
                    <div className="text-sm text-green-500 mt-1">↓ {result.reduction.toFixed(1)}%</div>
                  )}
                </div>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Processing Time</div>
                  <div className="text-2xl font-bold text-slate-100">
                    {result.processingTime.toFixed(2)}<span className="text-sm">ms</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Tolerance</div>
                  <div className="text-2xl font-bold text-slate-100">
                    {tolerance.toFixed(2)}<span className="text-sm">%</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">of bbox diagonal</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {results.length > 0 && (
          <div className="bg-gradient-to-r from-slate-800 to-slate-950 rounded-xl p-6 mt-8 border-2 border-blue-600">
            <h2 className="text-2xl font-bold text-blue-500 mb-6">Overall Results</h2>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-700">
                <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Total Segments</div>
                <div className="text-2xl font-bold text-slate-100">
                  {totalOriginal} → {totalSimplified}
                </div>
                <div className="text-sm text-green-500 mt-1">↓ {avgReduction.toFixed(1)}% avg</div>
              </div>

              <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-700">
                <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Total Processing Time</div>
                <div className="text-2xl font-bold text-slate-100">
                  {totalTime.toFixed(2)}<span className="text-sm">ms</span>
                </div>
                <div className="text-sm text-slate-400 mt-1">{avgTime.toFixed(2)}ms per test</div>
              </div>

              <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-700">
                <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Tolerance Used</div>
                <div className="text-2xl font-bold text-slate-100">
                  {tolerance.toFixed(2)}<span className="text-sm">%</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">of bbox diagonal</div>
              </div>

              <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-700">
                <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Test Cases</div>
                <div className="text-2xl font-bold text-slate-100">{results.length}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
