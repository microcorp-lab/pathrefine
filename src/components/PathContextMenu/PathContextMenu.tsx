import React, { useEffect, useRef } from 'react';
import { Sparkles, Waves, Trash2, Eye, EyeOff, MousePointer } from 'lucide-react';
import type { DeviceTier } from '../../utils/breakpoints';

interface PathContextMenuProps {
  /** The path ID this menu is for */
  pathId:    string;
  /** Screen position to anchor the menu to */
  x:         number;
  y:         number;
  /** Current visibility of the path */
  isVisible: boolean;
  /** Current device tier — hides 'Edit Points' on mobile */
  tier:      DeviceTier;
  onHeal:     () => void;
  onSmooth:   () => void;
  onDelete:   () => void;
  onHide:     () => void;
  onEdit:     () => void;
  onDismiss:  () => void;
}

/**
 * Context menu anchored to a long-press point on a path.
 * Displayed as a vertical list of large touch-friendly buttons.
 * Dismissed by tapping outside or after any action.
 */
export const PathContextMenu: React.FC<PathContextMenuProps> = ({
  pathId,
  x,
  y,
  isVisible,
  tier,
  onHeal,
  onSmooth,
  onDelete,
  onHide,
  onEdit,
  onDismiss,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Adjust position so the menu doesn't overflow the viewport
  const menuWidth  = 200;
  const menuHeight = tier === 'mobile' ? 200 : 248; // fewer items on mobile
  const safeX = Math.min(x, window.innerWidth  - menuWidth  - 8);
  const safeY = Math.min(y, window.innerHeight - menuHeight - 8);

  // Dismiss on outside tap
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    // Small delay so the long-press pointerup doesn't immediately dismiss
    const t = setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown);
    }, 80);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onDismiss]);

  function action(fn: () => void) {
    return () => { fn(); onDismiss(); };
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[200] bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden"
      style={{ left: safeX, top: safeY, width: menuWidth }}
    >
      {/* Path label */}
      <div className="px-4 py-2 border-b border-border">
        <span className="text-xs text-text-secondary truncate block">{pathId}</span>
      </div>

      <div className="p-1">
        <MenuItem icon={<Sparkles size={16} strokeWidth={1.5} />} label="Smart Heal" onClick={action(onHeal)} color="#10b981" />
        {tier !== 'mobile' && (
          <MenuItem icon={<Waves size={16} strokeWidth={1.5} />}     label="Smooth"     onClick={action(onSmooth)} />
        )}
        <MenuItem
          icon={isVisible ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
          label={isVisible ? 'Hide' : 'Show'}
          onClick={action(onHide)}
        />
        {tier !== 'mobile' && (
          <MenuItem icon={<MousePointer size={16} strokeWidth={1.5} />} label="Edit Points" onClick={action(onEdit)} />
        )}
        <MenuItem icon={<Trash2 size={16} strokeWidth={1.5} />}  label="Delete" onClick={action(onDelete)} color="#ef4444" danger />
      </div>
    </div>
  );
};

// ── Sub-component ─────────────────────────────────────────────────────────────

interface MenuItemProps {
  icon:    React.ReactNode;
  label:   string;
  onClick: () => void;
  color?:  string;
  danger?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, onClick, color, danger }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors min-h-[44px] ${
      danger
        ? 'text-red-400 hover:bg-red-600/15'
        : 'text-text-primary hover:bg-bg-primary'
    }`}
    style={color && !danger ? { color } : undefined}
  >
    {icon}
    {label}
  </button>
);
