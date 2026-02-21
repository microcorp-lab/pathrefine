import React from 'react';
import { Flame } from 'lucide-react';

/**
 * Heatmap legend overlay — shown in top-right corner when heatmap is active.
 * Pure display: no side-effects, no store access.
 */
export const CanvasHeatmap: React.FC = () => (
  <div className="absolute top-4 right-4 bg-bg-secondary/95 backdrop-blur border border-border rounded-lg p-3 shadow-lg">
    <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
      <Flame size={16} strokeWidth={1.5} />
      <span>Complexity Heatmap</span>
    </h4>
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs">
        <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10b981' }} />
        <span className="text-text-secondary">Optimal</span>
        <span className="ml-auto font-mono text-[10px]">80–100</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f59e0b' }} />
        <span className="text-text-secondary">Acceptable</span>
        <span className="ml-auto font-mono text-[10px]">55–79</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f97316' }} />
        <span className="text-text-secondary">Bloated</span>
        <span className="ml-auto font-mono text-[10px]">30–54</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <div
          className="w-4 h-4 rounded animate-pulse-slow"
          style={{
            backgroundColor: '#ef4444',
            backgroundImage:
              'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 4px)',
          }}
        />
        <span className="text-text-secondary">Disaster</span>
        <span className="ml-auto font-mono text-[10px]">0–29</span>
      </div>
    </div>
    <div className="mt-2 pt-2 border-t border-border text-[10px] text-text-secondary">
      Per-path health score (100 = perfect)
      <div className="mt-1 opacity-70">Dashed paths pulse slowly</div>
    </div>
  </div>
);
