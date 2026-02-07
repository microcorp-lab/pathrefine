import React from 'react';
import { useEditorStore } from '../../store/editorStore';

export const HelpOverlay: React.FC = () => {
  const showHelp = useEditorStore((state) => state.showHelp);
  const toggleHelp = useEditorStore((state) => state.toggleHelp);

  if (!showHelp) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
      onClick={toggleHelp}
    >
      <div 
        className="bg-bg-secondary border border-border rounded-lg shadow-2xl max-w-4xl max-h-[90vh] overflow-y-auto p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">SVG Path Editor - Help</h2>
          <button
            onClick={toggleHelp}
            className="text-2xl hover:text-accent-primary transition-colors"
            title="Close (Press ? or Esc)"
          >
            ×
          </button>
        </div>

        <div className="space-y-8">
          {/* Tools Section */}
          <section>
            <h3 className="text-xl font-semibold mb-4 text-accent-primary">Navigation</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border min-w-[2rem] text-center">Space</kbd>
                  <div>
                    <div className="font-medium">Pan Canvas</div>
                    <div className="text-sm text-text-secondary">Hold Space + Drag anywhere to pan</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border min-w-[2rem] text-center">Wheel</kbd>
                  <div>
                    <div className="font-medium">Zoom</div>
                    <div className="text-sm text-text-secondary">Mouse wheel or trackpad to zoom</div>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border min-w-[2rem] text-center">E</kbd>
                  <div>
                    <div className="font-medium">Edit Tool (Default)</div>
                    <div className="text-sm text-text-secondary">Click paths, drag points, Alt+Click to add</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border min-w-[2rem] text-center">⇧A</kbd>
                  <div>
                    <div className="font-medium">Path Alignment</div>
                    <div className="text-sm text-text-secondary">Open alignment tool (Shape following path)</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section>
            <h3 className="text-xl font-semibold mb-4 text-accent-primary">Keyboard Shortcuts</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Undo</span>
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border">⌘Z / Ctrl+Z</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Redo</span>
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border">⌘⇧Z / Ctrl+Shift+Z</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Save/Export</span>
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border">⌘S / Ctrl+S</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Toggle Code Panel</span>
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border">⌘K / Ctrl+K</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Zoom In</span>
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border">+</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Zoom Out</span>
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border">-</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Reset Zoom</span>
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border">⌘0 / Ctrl+0</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Pan Canvas</span>
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border">Space+Drag</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Complexity Heatmap</span>
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border">X</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Toggle Help</span>
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border">?</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Toggle Hints</span>
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border">I</kbd>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Perfect Square</span>
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border">Q</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Auto Colorize</span>
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border">C</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Smooth Path</span>
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border">S</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Smart Heal</span>
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border">H</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Merge Paths</span>
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border">M</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Path Alignment</span>
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border">Shift+A</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Snap to Grid</span>
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border">G</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Delete Point(s)</span>
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border">Backspace / Del</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Delete Path(s)</span>
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border">⌘⌫ / Ctrl+Del</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Add Point</span>
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border">Alt+Click</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Multi-select</span>
                  <kbd className="px-3 py-1.5 bg-bg-tertiary rounded border border-border">Shift+Click/Drag</kbd>
                </div>
              </div>
            </div>
          </section>

          {/* Workflow Guide */}
          <section>
            <h3 className="text-xl font-semibold mb-4 text-accent-primary">Workflow Guide</h3>
            <ol className="space-y-3 list-decimal list-inside">
              <li className="text-text-secondary">
                <span className="text-text-primary font-medium">Load SVG:</span> Click the 📂 Open button or drag & drop your SVG file
              </li>
              <li className="text-text-secondary">
                <span className="text-text-primary font-medium">Select & Edit:</span> Click any path to select it and see control points. Drag points to move, Alt+Click to add, Delete to remove
              </li>
              <li className="text-text-secondary">
                <span className="text-text-primary font-medium">Multi-Select:</span> Shift+Click to select multiple paths or points. Shift+Drag for marquee selection
              </li>
              <li className="text-text-secondary">
                <span className="text-text-primary font-medium">Pan & Zoom:</span> Hold Space and drag to pan. Use mouse wheel to zoom in/out
              </li>
              <li className="text-text-secondary">
                <span className="text-text-primary font-medium">Align Paths:</span> Use Align tool (A) to make one path follow another curve (unique feature!)
              </li>
              <li className="text-text-secondary">
                <span className="text-text-primary font-medium">Export:</span> Click 💾 Export or press ⌘S/Ctrl+S to save your work
              </li>
            </ol>
          </section>

          {/* Tips */}
          <section>
            <h3 className="text-xl font-semibold mb-4 text-accent-primary">Pro Tips</h3>
            <ul className="space-y-2 list-disc list-inside text-text-secondary">
              <li><strong>Hold Space and drag</strong> to pan around the canvas from anywhere - no tool switching needed!</li>
              <li>Use mouse wheel or trackpad to zoom in/out while hovering over canvas</li>
              <li><strong>Press X</strong> to toggle Complexity Heatmap - instantly see which paths are bloated (red) vs optimal (green)</li>
              <li><strong>Check Optimization Score</strong> in Properties Panel - shows how many points can be removed and file size savings</li>
              <li><strong>Selected points glow orange</strong> - easily see which points you're working with</li>
              <li><strong>Shift+Click points</strong> for multi-selection - move multiple points at once</li>
              <li><strong>Shift+Drag in edit mode</strong> to draw selection rectangle around multiple points</li>
              <li><strong>Eye icon</strong> in properties panel toggles path visibility - hide paths you're not editing</li>
              <li>Blue circles are anchor points, green lines show control handles</li>
              <li>Path smoothing automatically optimizes curves for better results</li>
              <li>Snap-to-grid helps with precise positioning (toggle in sidebar)</li>
              <li><strong>Middle mouse button</strong> also pans the canvas - like Space+Drag</li>
            </ul>
          </section>
        </div>

        <div className="mt-8 pt-4 border-t border-border text-center text-sm text-text-secondary">
          Press <kbd className="px-2 py-1 bg-bg-tertiary rounded border border-border">?</kbd> or <kbd className="px-2 py-1 bg-bg-tertiary rounded border border-border">Esc</kbd> to close this help
        </div>
      </div>
    </div>
  );
};
