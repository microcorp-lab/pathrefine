/**
 * BooleanOpsModal – subtract one path ("cutter") from the paths beneath it.
 *
 * The darkest fill path is auto-suggested as the cutter.
 * The user can reassign the cutter by clicking any listed path.
 * Paths ordered above the cutter in the z-stack are unaffected.
 * A live preview shows the result before committing.
 */

import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { Scissors } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '../Modal/Modal';
import { useEditorStore } from '../../store/editorStore';
import {
  subtractPaths,
  applyBooleanResult,
  suggestCutterPath,
  type BooleanOpResult,
} from '../../engine/booleanOps';
import { track } from '../../utils/analytics';
import type { Path, SVGDocument } from '../../types/svg';

// ─── Props ────────────────────────────────────────────────────────────────────

interface BooleanOpsModalProps {
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSolidColor(s?: string): boolean {
  return !!s && s !== 'none' && s !== 'transparent';
}

function pathLabel(path: Path, index: number): string {
  return path.id && path.id !== String(index) ? path.id : `Path ${index + 1}`;
}

/** Build a minimal SVG preview string from the document */
function buildPreviewSVG(
  doc: SVGDocument,
  overridePaths?: Path[],
  cutterPathId?: string,
  highlightCutter = false
): string {
  const vb = doc.viewBox
    ? `${doc.viewBox.x} ${doc.viewBox.y} ${doc.viewBox.width} ${doc.viewBox.height}`
    : `0 0 ${doc.width} ${doc.height}`;

  const pathsToRender = overridePaths ?? doc.paths;

  const elements = pathsToRender
    .filter(p => p.d && p.d.length > 0 && p.visible !== false)
    .map(p => {
      const isCutter = p.id === cutterPathId;
      const extraStyle =
        isCutter && highlightCutter
          ? ` stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.5"`
          : '';
      const t = p.transform?.raw ? ` transform="${p.transform.raw}"` : '';
      return `<path d="${p.d}" fill="${p.fill || 'none'}" fill-rule="evenodd" stroke="${
        p.stroke || 'none'
      }" stroke-width="${p.strokeWidth ?? 0}"${extraStyle}${t}/>`;
    });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${elements.join('')}</svg>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BooleanOpsModal({ onClose }: BooleanOpsModalProps) {
  const { svgDocument, setSVGDocument, selectedPathIds } = useEditorStore();

  // ── Auto-suggest cutter ────────────────────────────────────────────────────
  const initialCutter = useMemo<string | null>(() => {
    if (!svgDocument) return null;
    // If exactly one path is selected, prefer that
    if (selectedPathIds.length === 1) return selectedPathIds[0];
    return suggestCutterPath(svgDocument.paths);
  }, []); // deliberately only on mount

  const [cutterId, setCutterId] = useState<string | null>(initialCutter);

  // ── Simplification tolerance ───────────────────────────────────────────────
  const [simplifyTol, setSimplifyTol] = useState(0.3);

  // ── Computed: which paths sit *below* the cutter ───────────────────────────
  const { belowIds, aboveIds } = useMemo(() => {
    if (!svgDocument || !cutterId) return { belowIds: [], aboveIds: [] };
    const paths = svgDocument.paths;
    const cutterIdx = paths.findIndex(p => p.id === cutterId);
    if (cutterIdx < 0) return { belowIds: [], aboveIds: [] };
    return {
      belowIds: paths.slice(0, cutterIdx).map(p => p.id),
      aboveIds: paths.slice(cutterIdx + 1).map(p => p.id),
    };
  }, [svgDocument, cutterId]);

  // ── Live result computation ────────────────────────────────────────────────
  const [results, setResults] = useState<BooleanOpResult[]>([]);
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    if (!svgDocument || !cutterId || belowIds.length === 0) {
      setResults([]);
      return;
    }
    setComputing(true);

    // Use a minimal setTimeout so the UI can update (show computing state) before
    // the synchronous polygon-clipping heavy-lift.
    const id = setTimeout(() => {
      try {
        const r = subtractPaths(svgDocument.paths, cutterId, belowIds, {
          simplifyTolerance: simplifyTol,
        });
        setResults(r);
      } catch (_e) {
        setResults([]);
      }
      setComputing(false);
    }, 30);

    return () => clearTimeout(id);
  }, [svgDocument, cutterId, belowIds, simplifyTol]);

  // ── Build preview SVGs ─────────────────────────────────────────────────────
  const beforeSVG = useMemo(() => {
    if (!svgDocument) return '';
    return buildPreviewSVG(svgDocument, undefined, cutterId ?? undefined, true);
  }, [svgDocument, cutterId]);

  const afterSVG = useMemo(() => {
    if (!svgDocument || !cutterId) return beforeSVG;
    const resultMap = new Map(results.map(r => [r.pathId, r]));

    const newPaths: Path[] = svgDocument.paths
      // Remove the cutter
      .filter(p => p.id !== cutterId)
      .map(p => {
        const r = resultMap.get(p.id);
        if (!r) return p;
        return applyBooleanResult(p, r);
      })
      // Remove paths that were fully cut away
      .filter(p => p.d && p.d.length > 0 && p.visible !== false);

    return buildPreviewSVG({ ...svgDocument, paths: newPaths });
  }, [svgDocument, cutterId, results, beforeSVG]);

  // ── Apply ──────────────────────────────────────────────────────────────────
  const handleApply = useCallback(() => {
    if (!svgDocument || !cutterId) return;

    const resultMap = new Map(results.map(r => [r.pathId, r]));

    const newPaths: Path[] = svgDocument.paths
      .filter(p => p.id !== cutterId)
      .map(p => {
        const r = resultMap.get(p.id);
        if (!r) return p;
        return applyBooleanResult(p, r);
      })
      .filter(p => p.d && p.d.length > 0 && p.visible !== false);

    setSVGDocument({ ...svgDocument, paths: newPaths });

    const deletedCount = results.filter(r => r.deleted).length;
    const modifiedCount = results.filter(r => !r.deleted).length;

    track({ name: 'boolean_ops_applied', paths_cut: modifiedCount, paths_removed: deletedCount });

    toast.success('Boolean subtract applied', {
      description: [
        modifiedCount > 0 && `${modifiedCount} path${modifiedCount !== 1 ? 's' : ''} cut`,
        deletedCount > 0 && `${deletedCount} path${deletedCount !== 1 ? 's' : ''} removed`,
      ]
        .filter(Boolean)
        .join(' · '),
    });
    onClose();
  }, [svgDocument, cutterId, results, setSVGDocument, onClose]);

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (!svgDocument || svgDocument.paths.length < 2) {
    return (
      <Modal isOpen title="Boolean Subtract" onClose={onClose} size="sm">
        <p className="text-text-secondary text-sm py-4 text-center">
          Load an SVG with at least 2 paths to use Boolean Subtract.
        </p>
      </Modal>
    );
  }

  const paths = svgDocument.paths;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Modal
      isOpen
      title="Boolean Subtract"
      titleIcon={<Scissors size={18} className="text-orange-400" />}
      onClose={onClose}
      size="xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-text-secondary">
            {cutterId ? (
              computing ? (
                <span className="text-accent-primary">Computing preview…</span>
              ) : results.length === 0 && belowIds.length > 0 ? (
                <span className="text-yellow-400">No overlap detected</span>
              ) : (
                <span>
                  {results.filter(r => !r.deleted).length} cut ·{' '}
                  {results.filter(r => r.deleted).length} removed
                </span>
              )
            ) : (
              <span className="text-yellow-400">Select a cutter path</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg bg-bg-secondary text-text-secondary hover:bg-border hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!cutterId || computing || (results.length === 0 && belowIds.length > 0)}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Apply Subtract
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">

        {/* ── Explanation ─────────────────────────────────────────────────── */}
        <p className="text-sm text-text-secondary leading-relaxed">
          The <span className="text-white font-medium">cutter path</span> punches through all paths
          beneath it, removing the overlapping area. The cutter is then deleted.
        </p>

        {/* ── Main content row ─────────────────────────────────────────────── */}
        <div className="flex gap-4">

          {/* Left: path list */}
          <div className="flex flex-col gap-1 min-w-[180px] w-[180px]">
            <div className="text-[10px] uppercase tracking-wider text-text-secondary font-semibold mb-1">
              Paths (z-order ↑)
            </div>
            {/* Render in reverse z-order: topmost path first */}
            {[...paths].reverse().map((p, ri) => {
              const isAbove = aboveIds.includes(p.id);
              const isCutter = p.id === cutterId;
              const isBelow = belowIds.includes(p.id);
              const result = results.find(r => r.pathId === p.id);

              let roleLabel = '';
              let rolePill = '';
              if (isCutter) {
                roleLabel = 'cutter';
                rolePill = 'bg-orange-500/20 text-orange-300 border-orange-500/30';
              } else if (isAbove) {
                roleLabel = 'unaffected';
                rolePill = 'bg-bg-secondary text-text-secondary border-border';
              } else if (isBelow) {
                if (result?.deleted) {
                  roleLabel = 'removed';
                  rolePill = 'bg-red-900/30 text-red-300 border-red-700/40';
                } else {
                  roleLabel = 'cut';
                  rolePill = 'bg-blue-900/30 text-blue-300 border-blue-700/40';
                }
              }

              return (
                <button
                  key={p.id}
                  onClick={() => setCutterId(p.id)}
                  className={`
                    flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-left text-sm
                    border transition-all duration-150
                    ${isCutter
                      ? 'border-orange-500/60 bg-orange-500/10 text-white'
                      : 'border-border bg-bg-secondary text-text-secondary hover:bg-border hover:text-white'
                    }
                  `}
                  title="Click to make this the cutter"
                >
                  {/* Color swatch */}
                  <span
                    className="w-4 h-4 rounded-sm border border-white/10 shrink-0"
                    style={{
                      background: isSolidColor(p.fill) ? p.fill : 'transparent',
                      borderColor: isSolidColor(p.stroke) ? p.stroke : 'rgba(255,255,255,0.1)',
                    }}
                  />
                  {/* Label */}
                  <span className="flex-1 truncate text-[11px]">
                    {pathLabel(p, paths.length - 1 - ri)}
                  </span>
                  {/* Role pill */}
                  {roleLabel && (
                    <span
                      className={`text-[9px] px-1 py-0.5 rounded border font-medium leading-none ${rolePill}`}
                    >
                      {roleLabel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right: preview */}
          <div className="flex-1 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Before */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-text-secondary font-semibold">
                  Before
                </span>
                <PreviewPane svgString={beforeSVG} />
              </div>
              {/* After */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-text-secondary font-semibold">
                  After
                </span>
                {computing ? (
                  <div className="flex-1 rounded-lg bg-bg-secondary border border-border flex items-center justify-center min-h-[160px]">
                    <span className="text-xs text-text-secondary animate-pulse">Computing…</span>
                  </div>
                ) : (
                  <PreviewPane svgString={afterSVG} />
                )}
              </div>
            </div>

            {/* ── Simplification control ─────────────────────────────────── */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-text-secondary">
                  Output smoothness
                </label>
                <span className="text-xs text-text-secondary tabular-nums">
                  {simplifyTol.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="2"
                step="0.05"
                value={simplifyTol}
                onChange={e => setSimplifyTol(parseFloat(e.target.value))}
                className="w-full accent-orange-500"
              />
              <div className="flex justify-between text-[10px] text-text-secondary">
                <span>Precise</span>
                <span>Simplified</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Affected-paths summary ──────────────────────────────────────── */}
        {cutterId && belowIds.length === 0 && (
          <div className="rounded-lg border border-yellow-600/30 bg-yellow-900/10 px-3 py-2 text-xs text-yellow-300">
            The selected cutter is the bottom-most path — nothing beneath it to cut.
            Move the cutter higher in z-order or select a different cutter.
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Preview pane ─────────────────────────────────────────────────────────────

interface PreviewPaneProps {
  svgString: string;
}

function PreviewPane({ svgString }: PreviewPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="rounded-lg border border-border bg-[#1a1a1a] overflow-hidden min-h-[160px] flex items-center justify-center p-2"
      style={{
        backgroundImage:
          'linear-gradient(45deg, #252525 25%, transparent 25%), ' +
          'linear-gradient(-45deg, #252525 25%, transparent 25%), ' +
          'linear-gradient(45deg, transparent 75%, #252525 75%), ' +
          'linear-gradient(-45deg, transparent 75%, #252525 75%)',
        backgroundSize: '12px 12px',
        backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
      }}
      dangerouslySetInnerHTML={{
        __html: svgString.replace(
          '<svg ',
          '<svg style="width:100%;height:100%;max-height:160px;display:block" '
        ),
      }}
    />
  );
}
