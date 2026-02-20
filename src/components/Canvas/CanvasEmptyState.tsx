import React, { useCallback } from 'react';
import { FolderOpen } from 'lucide-react';
import { DEMO_LOGO_SVG } from '../../data/demoLogo';
import { parseSVG } from '../../engine/parser';
import { useEditorStore } from '../../store/editorStore';

export const CanvasEmptyState: React.FC = () => {
  const setSVGDocument = useEditorStore(state => state.setSVGDocument);
  const selectPath     = useEditorStore(state => state.selectPath);
  const setEditingPath = useEditorStore(state => state.setEditingPath);
  const setZoom        = useEditorStore(state => state.setZoom);
  const setPan         = useEditorStore(state => state.setPan);

  const loadDemoLogo = useCallback(() => {
    const doc = parseSVG(DEMO_LOGO_SVG);
    setSVGDocument(doc);
    setTimeout(() => {
      if (doc.paths.length > 0) {
        const pathId = doc.paths[0].id;
        selectPath(pathId);
        setEditingPath(pathId);
        if (!useEditorStore.getState().showHeatmap) {
          useEditorStore.getState().toggleHeatmap();
        }
      }
    }, 100);
  }, [setSVGDocument, selectPath, setEditingPath]);

  const handleFileOpen = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.svg,image/svg+xml';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const doc = parseSVG(text);
        setSVGDocument(doc);
        setZoom(1);
        setPan(0, 0);
      } catch {
        // Handled by caller
      }
    };
    input.click();
  }, [setSVGDocument, setZoom, setPan]);

  return (
    <div className="flex-1 flex items-center justify-center bg-[#0F172A] relative overflow-hidden">
      {/* Background Grid Pattern */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="max-w-lg w-full bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl pointer-events-auto relative z-10 mx-4">
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Start Optimizing</h2>
            <p className="text-slate-400">
              Drop an SVG file here, or try our demo to see the optimization magic in action.
            </p>
          </div>

          <div className="relative group cursor-pointer" onClick={loadDemoLogo}>
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
            <div className="relative bg-slate-800 border border-slate-700/50 rounded-xl p-6 hover:bg-slate-800/80 transition-all flex items-center gap-6">
              <div className="w-16 h-16 flex-shrink-0 bg-slate-900/50 rounded-lg p-2 border border-slate-700/50 flex items-center justify-center">
                <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: DEMO_LOGO_SVG }} />
              </div>
              <div className="text-left flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-white">Fix Broken Logo</span>
                  <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20">
                    Messy
                  </span>
                </div>
                <p className="text-sm text-slate-400">
                  Our logo was auto-traced poorly. Use{' '}
                  <span className="text-indigo-400 font-medium">Smart Heal</span> to fix it instantly.
                </p>
              </div>
              <div className="flex-shrink-0 text-indigo-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-center pt-4 border-t border-slate-800">
            <button
              onClick={handleFileOpen}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors flex items-center gap-2 border border-slate-700"
            >
              <FolderOpen size={18} strokeWidth={1.5} />
              Upload SVG
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('openConverter'))}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors flex items-center gap-2 border border-slate-700"
            >
              <FolderOpen size={18} strokeWidth={1.5} />
              Import Image
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
