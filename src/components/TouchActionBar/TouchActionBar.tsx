import React from 'react';
import { Undo2, Redo2, Flame, Sparkles, Download, Waves } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import type { DeviceTier } from '../../utils/breakpoints';

interface TouchActionBarProps {
  /** Device tier — controls which actions are shown */
  tier: DeviceTier;
  /** Open the Smart Heal modal */
  onHeal: () => void;
  /** Open the Smooth modal */
  onSmooth: () => void;
  /** Open the export modal */
  onExport: () => void;
}

/**
 * Persistent horizontal action strip pinned at the bottom of the canvas.
 * Shown on tablet and mobile to replace keyboard shortcuts.
 * Desktop: not rendered.
 */
export const TouchActionBar: React.FC<TouchActionBarProps> = ({
  tier,
  onHeal,
  onSmooth,
  onExport,
}) => {
  const svgDocument   = useEditorStore(s => s.svgDocument);
  const selectedPathIds = useEditorStore(s => s.selectedPathIds);
  const undo          = useEditorStore(s => s.undo);
  const redo          = useEditorStore(s => s.redo);
  const canUndo       = useEditorStore(s => s.canUndo());
  const canRedo       = useEditorStore(s => s.canRedo());
  const showHeatmap   = useEditorStore(s => s.showHeatmap);
  const toggleHeatmap = useEditorStore(s => s.toggleHeatmap);

  const hasDoc   = !!svgDocument;
  const hasSel   = selectedPathIds.length > 0;

  // On mobile, show a minimal strip (undo/redo/heal/export)
  // On tablet, show all: undo/redo/heatmap/heal/smooth/export
  const isTablet = tier === 'tablet';

  return (
    <div
      data-testid="touch-action-bar"
      className="flex items-center justify-around px-2 py-1 bg-bg-secondary/95 backdrop-blur border-t border-border"
    >
      {/* Undo */}
      <ActionButton
        icon={<Undo2 size={22} strokeWidth={1.5} />}
        label="Undo"
        onClick={undo}
        disabled={!canUndo}
      />

      {/* Redo */}
      <ActionButton
        icon={<Redo2 size={22} strokeWidth={1.5} />}
        label="Redo"
        onClick={redo}
        disabled={!canRedo}
      />

      {/* Heatmap — tablet only */}
      {isTablet && (
        <ActionButton
          icon={<Flame size={22} strokeWidth={1.5} />}
          label="Heatmap"
          onClick={toggleHeatmap}
          disabled={!hasDoc}
          active={showHeatmap}
          activeColor="#ef4444"
        />
      )}

      {/* Smart Heal */}
      <ActionButton
        icon={<Sparkles size={22} strokeWidth={1.5} />}
        label="Heal"
        onClick={onHeal}
        disabled={!hasDoc || !hasSel}
        activeColor="#10b981"
      />

      {/* Smooth — tablet only */}
      {isTablet && (
        <ActionButton
          icon={<Waves size={22} strokeWidth={1.5} />}
          label="Smooth"
          onClick={onSmooth}
          disabled={!hasDoc || !hasSel}
        />
      )}

      {/* Export */}
      <ActionButton
        icon={<Download size={22} strokeWidth={1.5} />}
        label="Export"
        onClick={onExport}
        disabled={!hasDoc}
      />
    </div>
  );
};

// ── Small sub-component for each button ────────────────────────────────────────

interface ActionButtonProps {
  icon:        React.ReactNode;
  label:       string;
  onClick:     () => void;
  disabled?:   boolean;
  active?:     boolean;
  activeColor?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  icon, label, onClick, disabled, active, activeColor = '#6366f1',
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-xl transition-colors min-w-[52px] min-h-[52px] disabled:opacity-35 disabled:cursor-not-allowed"
    style={active ? { color: activeColor } : undefined}
  >
    {icon}
    <span className="text-[10px] leading-none text-text-secondary">{label}</span>
  </button>
);
