import React, { useState, useEffect, useMemo, useContext } from 'react';
import { Link } from 'react-router-dom';
import { parseSVG, segmentsToPathData } from '../../engine/parser';
import { countAnchorPoints } from '../../engine/pathAnalysis';
import { extractAnchorPoints } from '../../engine/pathEditor';
import { DEMO_LOGO_SVG } from '../../data/demoLogo';
import { Path, Command } from '../../types/svg';
import { Wand2, RefreshCw, Zap, ArrowRight, CheckCircle2 } from 'lucide-react';
import { ProFeaturesContext } from '../../main';

export const LandingPageDemo: React.FC = () => {
  // Get PRO features from context
  const proFeatures = useContext(ProFeaturesContext);
  if (!proFeatures) throw new Error('ProFeaturesContext not found');
  const { autoRefinePath } = proFeatures.engine;
  
  const [originalPaths, setOriginalPaths] = useState<Path[]>([]);
  const [currentPaths, setCurrentPaths] = useState<Path[]>([]);
  const [isRefined, setIsRefined] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Parse initial SVG
  useEffect(() => {
    try {
      const doc = parseSVG(DEMO_LOGO_SVG);
      setOriginalPaths(doc.paths);
      setCurrentPaths(doc.paths);
    } catch (e) {
      console.error("Failed to parse demo SVG", e);
    }
  }, []);

  const stats = useMemo(() => {
    const originalPoints = originalPaths.reduce((sum, p) => sum + countAnchorPoints(p), 0);
    const currentPoints = currentPaths.reduce((sum, p) => sum + countAnchorPoints(p), 0);
    const reduction = originalPoints > 0 
      ? Math.round(((originalPoints - currentPoints) / originalPoints) * 100) 
      : 0;
    
    // Calculate actual file size by measuring SVG path data strings
    const originalSize = originalPaths.reduce((sum, p) => {
      const pathData = segmentsToPathData(p.segments);
      return sum + pathData.length;
    }, 0);
    
    const currentSize = currentPaths.reduce((sum, p) => {
      const pathData = segmentsToPathData(p.segments);
      return sum + pathData.length;
    }, 0);
    
    const sizeReduction = originalSize > 0
      ? Math.round(((originalSize - currentSize) / originalSize) * 100)
      : 0;
      
    return { originalPoints, currentPoints, reduction, originalSize, currentSize, sizeReduction };
  }, [originalPaths, currentPaths]);

  const handleRefine = () => {
    if (isRefined || isAnimating) return;
    
    setIsAnimating(true);
    
    // Simulate processing delay for effect
    setTimeout(() => {
      const refinedPaths = originalPaths.map(p => autoRefinePath(p, 'strong'));
      setCurrentPaths(refinedPaths);
      setIsRefined(true);
      setIsAnimating(false);
    }, 800);
  };

  const handleReset = () => {
    if (!isRefined || isAnimating) return;
    setCurrentPaths(originalPaths);
    setIsRefined(false);
  };

  // Extract all anchor points for visualization
  const pointsToRender = useMemo(() => {
    const points: {x: number, y: number, color: string}[] = [];
    currentPaths.forEach(path => {
      const anchorPoints = extractAnchorPoints(path);
      anchorPoints.forEach(pt => {
        points.push({ 
          x: pt.x, 
          y: pt.y, 
          color: isRefined ? '#4ade80' : '#ef4444' 
        });
      });
    });
    return points;
  }, [currentPaths, isRefined]);

  if (originalPaths.length === 0) return <div className="h-64 flex items-center justify-center">Loading demo...</div>;

  const viewBox = "0 0 128 128"; // Known from demoLogo.ts

  return (
    <div className="w-full max-w-4xl mx-auto my-12" id="demo-section">
        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">See It In Action</h2>
            <p className="text-text-secondary">One click to remove noise and perfect your geometry.</p>
        </div>

      <div className="bg-bg-secondary/80 backdrop-blur-sm rounded-2xl border border-border overflow-hidden shadow-2xl flex flex-col md:flex-row">
        
        {/* Left: Canvas Area */}
        <div className="flex-1 p-8 relative min-h-[300px] flex items-center justify-center bg-grid-pattern">
            {/* SVG Renderer */}
            <div className="relative w-full max-w-[300px] aspect-square">
                <svg viewBox={viewBox} className="w-full h-full drop-shadow-xl overflow-visible">
                    {/* Paths */}
                    {currentPaths.map((path, i) => (
                        <path
                            key={path.id + (isRefined ? '_refined' : '_raw')}
                            d={segmentsToPathData(path.segments)}
                            fill={path.fill || '#6366f1'}
                            stroke={path.stroke || 'none'}
                            strokeWidth={path.strokeWidth || 0}
                            className="transition-all duration-700 ease-in-out"
                        />
                    ))}

                    {/* Points Overlay */}
                    <g className="opacity-60">
                        {pointsToRender.map((pt, i) => (
                            <circle
                                key={i}
                                cx={pt.x}
                                cy={pt.y}
                                r={isRefined ? 0.8 : 1.2}
                                fill={pt.color}
                                className="transition-all duration-500"
                            />
                        ))}
                    </g>
                </svg>

                {/* Processing Indicator */}
                {isAnimating && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px] rounded-xl transition-all">
                        <div className="bg-white text-black px-4 py-2 rounded-full font-bold flex items-center gap-2 shadow-xl animate-pulse">
                            <Wand2 size={16} className="animate-spin-slow" />
                            Optimizing...
                        </div>
                    </div>
                )}
            </div>

            {/* Floating Point Count Badge */}
            <div className="absolute bottom-4 left-4 bg-bg-tertiary/90 backdrop-blur border border-border px-3 py-1.5 rounded-full text-xs font-mono text-text-secondary flex items-center gap-2 shadow-lg">
                <div className={`w-2 h-2 rounded-full ${isRefined ? 'bg-green-500' : 'bg-red-500'}`} />
                {stats.currentPoints} anchor points
            </div>
        </div>

        {/* Right: Controls & Stats */}
        <div className="w-full md:w-80 bg-bg-tertiary border-l border-border p-6 flex flex-col justify-center relative">
            
            <div className="space-y-6">
                
                {/* Status Header */}
                <div>
                   <div className="text-xs uppercase tracking-wider text-text-secondary font-bold mb-1">
                        Current State
                   </div>
                   <div className={`text-2xl font-bold flex items-center gap-2 ${isRefined ? 'text-green-400' : 'text-amber-400'}`}>
                        {isRefined ? (
                            <>
                                <CheckCircle2 size={24} />
                                Optimized
                            </>
                        ) : (
                            <>
                                <Zap size={24} />
                                Raw / Noisy
                            </>
                        )}
                   </div>
                </div>

                {/* Main Action */}
                {!isRefined ? (
                    <button
                        onClick={handleRefine}
                        disabled={isAnimating}
                        className="w-full py-4 bg-accent-primary hover:bg-accent-secondary text-white rounded-xl font-bold text-lg shadow-lg shadow-accent-primary/20 transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 group"
                    >
                        <Wand2 size={20} className="group-hover:rotate-12 transition-transform" />
                        Auto-Refine
                    </button>
                ) : (
                    <button
                        onClick={handleReset}
                        className="w-full py-3 bg-bg-secondary hover:bg-bg-primary text-text-primary border border-border rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                    >
                        <RefreshCw size={16} />
                        Reset Demo
                    </button>
                )}

                {/* Stats Grid - Show only when refined or explicitly meant to show potential */}
                <div className={`transition-all duration-500 ${isRefined ? 'opacity-100 translate-y-0' : 'opacity-50 blur-[1px]'}`}>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-bg-secondary p-3 rounded-lg border border-border">
                            <div className="text-[10px] text-text-secondary uppercase">Points</div>
                            <div className="text-xl font-bold text-accent-primary">
                                {isRefined ? `${stats.reduction}%` : '0%'}
                            </div>
                        </div>
                        <div className="bg-bg-secondary p-3 rounded-lg border border-border">
                            <div className="text-[10px] text-text-secondary uppercase">File Size</div>
                            <div className="text-xl font-bold text-white">
                                {isRefined ? `${stats.sizeReduction}%` : '0%'}
                            </div>
                        </div>
                    </div>
                    
                    {isRefined && (
                        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-400 space-y-2">
                            <div className="flex items-start gap-2">
                                <Zap size={16} className="mt-0.5 shrink-0" />
                                <span>
                                    Removed <strong>{stats.originalPoints - stats.currentPoints} points</strong> ({stats.reduction}%) and saved <strong>{((stats.originalSize - stats.currentSize) / 1000).toFixed(1)}KB</strong> ({stats.sizeReduction}%).
                                </span>
                            </div>
                            <div className="text-xs text-green-400/70 pl-6">
                                {(stats.originalSize / 1000).toFixed(1)}KB → {(stats.currentSize / 1000).toFixed(1)}KB
                            </div>
                        </div>
                    )}
                </div>

                {/* Explanation */}
                {!isRefined && (
                     <p className="text-sm text-text-secondary text-center mt-2 italic">
                        Try it! See how many points are redundant.
                     </p>
                )}

                {/* Try Editor CTA */}
                {isRefined && (
                    <Link 
                        to="/editor?demo=logo"
                        className="mt-4 w-full py-3 bg-accent-primary hover:bg-accent-secondary text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 group"
                    >
                        Try the Editor for Free
                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                )}
            </div>

        </div>
      </div>
    </div>
  );
};
