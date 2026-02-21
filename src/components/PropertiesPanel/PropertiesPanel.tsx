import React, { useMemo, useState, useEffect } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { 
  analyzeDocument,
  getComplexityColor, 
  getComplexityEmoji, 
  formatFileSize,
  getHealthPercentage 
} from '../../engine/pathAnalysis';
import { exportSVG } from '../../engine/parser';
import { Eye, EyeOff, Trash2, ChevronRight, ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react';

export const PropertiesPanel: React.FC = () => {
  const svgDocument = useEditorStore(state => state.svgDocument);
  const selectedPathIds = useEditorStore(state => state.selectedPathIds);
  const activeTool = useEditorStore(state => state.activeTool);
  const togglePathVisibility = useEditorStore(state => state.togglePathVisibility);
  const deletePath = useEditorStore(state => state.deletePath);
  const selectPath = useEditorStore(state => state.selectPath);
  const addPathToSelection = useEditorStore(state => state.addPathToSelection);
  const setEditingPath = useEditorStore(state => state.setEditingPath);
  const updatePath = useEditorStore(state => state.updatePath);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scoreExpanded, setScoreExpanded] = useState(false);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [pendingDeleteAll, setPendingDeleteAll] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [expandedPathIds, setExpandedPathIds] = useState<Set<string>>(new Set());

  // Auto-reset pending deletes after 3 seconds
  useEffect(() => {
    if (!pendingDeleteAll) return;
    const t = setTimeout(() => setPendingDeleteAll(false), 3000);
    return () => clearTimeout(t);
  }, [pendingDeleteAll]);

  useEffect(() => {
    if (!pendingDeleteId) return;
    const t = setTimeout(() => setPendingDeleteId(null), 3000);
    return () => clearTimeout(t);
  }, [pendingDeleteId]);

  // Cancel both pending deletes with Escape
  useEffect(() => {
    if (!pendingDeleteAll && !pendingDeleteId) return;
    const cancel = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingDeleteAll(false);
        setPendingDeleteId(null);
      }
    };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, [pendingDeleteAll, pendingDeleteId]);

  // Auto-collapse on mobile
  useEffect(() => {
    const checkMobile = () => {
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Generate SVG code (needed first — byte length feeds the analysis)
  const svgCode = useMemo(() => {
    if (!svgDocument) return '';
    return exportSVG(svgDocument);
  }, [svgDocument]);

  // Calculate optimization score — pass actual SVG byte length for accurate file size
  const documentAnalysis = useMemo(() => {
    if (!svgDocument) return null;
    return analyzeDocument(svgDocument, svgCode.length);
  }, [svgDocument, svgCode]);

  const healthPercentage = documentAnalysis ? getHealthPercentage(documentAnalysis) : 0;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(svgCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!svgDocument) {
    return (
      <div className={`${isCollapsed ? 'w-0' : 'w-64'} bg-bg-secondary border-l border-border transition-all duration-300 overflow-hidden relative`}>
        {!isCollapsed && (
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-4">Properties</h3>
            <p className="text-text-secondary text-sm">No document loaded</p>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full bg-bg-secondary border border-r-0 border-border rounded-l px-1 py-2 hover:bg-bg-tertiary transition-colors md:hidden"
          title={isCollapsed ? 'Show properties' : 'Hide properties'}
        >
          {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
    );
  }

  const selectedPaths = svgDocument.paths.filter(p => 
    selectedPathIds.includes(p.id)
  );

  return (
    <div className={`${isCollapsed ? 'w-0' : 'w-64'} bg-bg-secondary border-l border-border transition-all duration-300 overflow-hidden relative`}>
      {!isCollapsed && (
        <div className="p-4 overflow-y-auto h-full">
          <h3 className="text-lg font-semibold mb-4">Properties</h3>

      {/* Optimization Score - Collapsible */}
      {documentAnalysis && (
        <div className="mb-6 bg-bg-primary rounded-lg border-2 border-accent-primary/20 overflow-hidden">
          <button
            onClick={() => setScoreExpanded(!scoreExpanded)}
            className="w-full p-4 flex items-center justify-between hover:bg-bg-secondary transition-colors"
          >
            <div className="flex items-center gap-2">
              <span>⚡ Optimization</span>
              <span className="text-sm font-bold" style={{ 
                color: healthPercentage >= 75 ? '#10b981' : 
                       healthPercentage >= 50 ? '#f59e0b' : '#ef4444' 
              }}>
                {healthPercentage}%
              </span>
            </div>
            <span className="text-text-secondary" title={scoreExpanded ? 'Collapse details' : 'Expand details'}>
              {scoreExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          </button>
          
          <div 
            className="transition-all duration-300 ease-in-out"
            style={{
              maxHeight: scoreExpanded ? '500px' : '0',
              opacity: scoreExpanded ? 1 : 0
            }}
          >
            <div className="px-4 pb-4">
              {/* Health Bar */}
              <div className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-text-secondary">Health</span>
                  <span className="text-sm font-bold" style={{ 
                    color: healthPercentage >= 75 ? '#10b981' : 
                           healthPercentage >= 50 ? '#f59e0b' : '#ef4444' 
                  }}>
                    {healthPercentage}%
                  </span>
                </div>
                <div className="h-2 bg-bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full transition-all duration-500"
                    style={{ 
                      width: `${healthPercentage}%`,
                      backgroundColor: healthPercentage >= 75 ? '#10b981' : 
                                       healthPercentage >= 50 ? '#f59e0b' : '#ef4444'
                    }}
                  />
                </div>
              </div>

              {/* Key Metrics */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Total Points:</span>
                  <span className="font-mono font-bold">
                    {documentAnalysis.totalPoints.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">File Size:</span>
                  <span className="font-mono">
                    {formatFileSize(documentAnalysis.estimatedFileSize)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Could be:</span>
                  <span className="font-mono text-green-400 font-bold">
                    {formatFileSize(documentAnalysis.optimalFileSize)}
                  </span>
                </div>
                
                {documentAnalysis.savingsPotential > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-400">
                        {formatFileSize(documentAnalysis.savingsPotential)}
                      </div>
                      <div className="text-text-secondary">
                        potential savings
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document info */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-text-secondary mb-2">Document</h4>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-text-secondary">Width:</span>
            <span>{svgDocument.width}px</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Height:</span>
            <span>{svgDocument.height}px</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Paths:</span>
            <span>{svgDocument.paths.length}</span>
          </div>
        </div>
      </div>

      {/* Path list */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-text-secondary">All Paths</h4>
          <div className="flex items-center gap-1">
            {selectedPathIds.length > 1 && (
              <button
                onClick={() => {
                  if (pendingDeleteAll) {
                    selectedPaths.forEach(path => deletePath(path.id, 'Delete Path'));
                    setPendingDeleteAll(false);
                  } else {
                    setPendingDeleteAll(true);
                  }
                }}
                className={`px-2 py-0.5 text-xs text-white rounded transition-colors ${
                  pendingDeleteAll ? 'bg-red-700 ring-1 ring-red-400' : 'bg-red-600 hover:bg-red-700'
                }`}
                title={pendingDeleteAll ? 'Click again to confirm' : `Delete ${selectedPathIds.length} selected paths`}
              >
                <Trash2 size={12} strokeWidth={1.5} className="inline mr-1" />
                {pendingDeleteAll ? 'Confirm?' : `Delete ${selectedPathIds.length}`}
              </button>
            )}
            <span className="text-xs text-text-secondary" title="Click to select, Shift+Click for range, Cmd/Ctrl+Click to add/remove">
              💡
            </span>
          </div>
        </div>
        <div className="space-y-1">
          {svgDocument.paths.map((path, index) => {
            const isSelected = selectedPathIds.includes(path.id);
            const isExpanded = expandedPathIds.has(path.id);
            
            const handlePathClick = (e: React.MouseEvent) => {
              if (e.shiftKey && lastClickedIndex !== null) {
                // Shift+Click: Select range
                e.preventDefault();
                const start = Math.min(lastClickedIndex, index);
                const end = Math.max(lastClickedIndex, index);
                const pathsToSelect = svgDocument.paths.slice(start, end + 1);
                
                // Add all paths in range to selection
                const lastPath = pathsToSelect[pathsToSelect.length - 1];
                pathsToSelect.forEach(p => {
                  if (!selectedPathIds.includes(p.id)) {
                    addPathToSelection(p.id);
                  }
                });
                // Set the last path as editing path
                if (lastPath) {
                  setEditingPath(lastPath.id);
                }
              } else if (e.metaKey || e.ctrlKey) {
                // Cmd/Ctrl+Click: Toggle single path
                e.preventDefault();
                if (isSelected) {
                  // Deselect by selecting all others
                  const otherPaths = selectedPathIds.filter(id => id !== path.id);
                  if (otherPaths.length > 0) {
                    selectPath(otherPaths[0]);
                    otherPaths.slice(1).forEach(id => addPathToSelection(id));
                  } else {
                    selectPath(''); // Deselect all
                  }
                } else {
                  addPathToSelection(path.id);
                  setEditingPath(path.id);
                }
                setLastClickedIndex(index);
              } else {
                // Normal click: Select only this path (or deselect if it's the only one selected)
                if (isSelected && selectedPathIds.length === 1) {
                  // Clicking the only selected path deselects it
                  selectPath('');
                } else {
                  selectPath(path.id);
                  setEditingPath(path.id);
                }
                setLastClickedIndex(index);
              }
            };
            
            const pathAnalysis = documentAnalysis?.pathAnalyses.get(path.id);
            const dotColor = pathAnalysis ? getComplexityColor(pathAnalysis.complexity) : null;
            const dotTooltip = pathAnalysis
              ? `${pathAnalysis.complexity.charAt(0).toUpperCase() + pathAnalysis.complexity.slice(1)} — ${pathAnalysis.pointCount} pts, ${pathAnalysis.pointDensity.toFixed(1)} density.${pathAnalysis.complexity === 'bloated' || pathAnalysis.complexity === 'disaster' ? ' Smart Heal recommended.' : ''}`
              : null;

            return (
              <div
                key={path.id}
                data-testid="path-item"
                className={`rounded text-sm transition-colors ${
                  isSelected ? 'bg-accent-primary/10 ring-1 ring-accent-primary/30' : 'hover:bg-bg-primary'
                }`}
              >
                {/* Row header — always visible */}
                <div
                  onClick={handlePathClick}
                  className="flex items-center justify-between gap-2 px-2 py-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {dotColor && (
                      <div
                        className="flex-shrink-0 rounded-full"
                        style={{ width: 6, height: 6, backgroundColor: dotColor, minWidth: 6 }}
                        title={dotTooltip ?? undefined}
                      />
                    )}
                    {path.fill && (
                      <div
                        className="w-3 h-3 rounded border border-border flex-shrink-0"
                        style={{ backgroundColor: path.fill }}
                      />
                    )}
                    <span className={`truncate ${isSelected ? 'font-medium text-text-primary' : 'text-text-secondary'}`}>
                      {path.id}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePathVisibility(path.id);
                      }}
                      className="p-1 hover:bg-bg-secondary rounded transition-colors"
                      title={path.visible === false ? 'Show path' : 'Hide path'}
                    >
                      {path.visible === false ?
                        <EyeOff className="w-3.5 h-3.5 text-gray-400" /> :
                        <Eye className="w-3.5 h-3.5 text-gray-400" />
                      }
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedPathIds(prev => {
                          const next = new Set(prev);
                          if (next.has(path.id)) { next.delete(path.id); } else { next.add(path.id); }
                          return next;
                        });
                      }}
                      className="p-1 hover:bg-bg-secondary rounded transition-colors"
                      title={isExpanded ? 'Collapse' : 'Expand path details'}
                    >
                      {isExpanded
                        ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                        : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                      }
                    </button>
                  </div>
                </div>

                {/* Inline expanded details */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-border/50 mt-0.5">
                    {/* Complexity row */}
                    {pathAnalysis && (
                      <div className="flex items-center justify-between mt-2 mb-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span>{getComplexityEmoji(pathAnalysis.complexity)}</span>
                          <span
                            className="font-semibold capitalize"
                            style={{ color: getComplexityColor(pathAnalysis.complexity) }}
                          >
                            {pathAnalysis.complexity}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-text-secondary">
                          <span>{pathAnalysis.pointCount} pts</span>
                          <span>·</span>
                          <span>{pathAnalysis.pointDensity.toFixed(1)} density</span>
                        </div>
                      </div>
                    )}
                    {pathAnalysis?.recommendations.length ? (
                      <div className="mb-2 text-xs text-yellow-400">
                        💡 {pathAnalysis.recommendations[0]}
                      </div>
                    ) : null}

                    {/* Property controls */}
                    <div className="space-y-3 text-xs">
                      {/* Fill */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-text-secondary">Fill:</span>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!path.fill && path.fill !== 'none'}
                              onChange={(e) => {
                                updatePath(path.id, { ...path, fill: e.target.checked ? '#000000' : 'none' }, 'Toggle fill');
                              }}
                              className="cursor-pointer"
                            />
                            <span className="text-xs">Enable</span>
                          </label>
                        </div>
                        {path.fill && path.fill !== 'none' && (
                          <div className="flex items-center gap-2">
                            <span className="text-text-secondary">Color:</span>
                            {path.fill.startsWith('#') && (
                              <input
                                type="color"
                                value={path.fill}
                                onChange={(e) => updatePath(path.id, { ...path, fill: e.target.value }, 'Change fill color')}
                                className="w-10 h-6 rounded border border-border cursor-pointer flex-shrink-0"
                              />
                            )}
                            <input
                              type="text"
                              value={path.fill}
                              onChange={(e) => updatePath(path.id, { ...path, fill: e.target.value }, 'Change fill color')}
                              className="flex-1 px-2 py-1 bg-bg-primary border border-border rounded font-mono text-xs"
                              placeholder="#000000"
                            />
                          </div>
                        )}
                      </div>

                      {/* Stroke */}
                      <div className="space-y-2 pt-2 border-t border-border">
                        <div className="flex items-center justify-between">
                          <span className="text-text-secondary">Stroke:</span>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!path.stroke && path.stroke !== 'none'}
                              onChange={(e) => {
                                updatePath(path.id, {
                                  ...path,
                                  stroke: e.target.checked ? '#000000' : 'none',
                                  strokeWidth: e.target.checked ? (path.strokeWidth || 1) : path.strokeWidth
                                }, 'Toggle stroke');
                              }}
                              className="cursor-pointer"
                            />
                            <span className="text-xs">Enable</span>
                          </label>
                        </div>
                        {path.stroke && path.stroke !== 'none' && (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-text-secondary">Color:</span>
                              {path.stroke.startsWith('#') && (
                                <input
                                  type="color"
                                  value={path.stroke}
                                  onChange={(e) => updatePath(path.id, { ...path, stroke: e.target.value }, 'Change stroke color')}
                                  className="w-10 h-6 rounded border border-border cursor-pointer flex-shrink-0"
                                />
                              )}
                              <input
                                type="text"
                                value={path.stroke}
                                onChange={(e) => updatePath(path.id, { ...path, stroke: e.target.value }, 'Change stroke color')}
                                className="flex-1 px-2 py-1 bg-bg-primary border border-border rounded font-mono text-xs"
                                placeholder="#000000"
                              />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-text-secondary">Width:</span>
                                <span className="font-mono">{(path.strokeWidth || 1).toFixed(1)}px</span>
                              </div>
                              <input
                                type="range"
                                min="0.5"
                                max="10"
                                step="0.5"
                                value={path.strokeWidth || 1}
                                onChange={(e) => updatePath(path.id, { ...path, strokeWidth: parseFloat(e.target.value) }, 'Change stroke width')}
                                className="w-full"
                              />
                            </div>
                          </>
                        )}
                      </div>

                      {/* Meta */}
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <span className="text-text-secondary">Segments:</span>
                        <span>{path.segments.length}</span>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => {
                          if (pendingDeleteId === path.id) {
                            deletePath(path.id, 'Delete Path');
                            setPendingDeleteId(null);
                          } else {
                            setPendingDeleteId(path.id);
                          }
                        }}
                        className={`w-full flex items-center justify-center gap-1.5 py-1 rounded text-xs transition-colors ${
                          pendingDeleteId === path.id
                            ? 'bg-red-700 text-white ring-1 ring-red-400'
                            : 'bg-red-600/10 text-red-400 hover:bg-red-600 hover:text-white'
                        }`}
                        title={pendingDeleteId === path.id ? 'Click again to confirm delete' : 'Delete path'}
                      >
                        <Trash2 size={12} strokeWidth={1.5} />
                        {pendingDeleteId === path.id ? 'Confirm delete?' : 'Delete path'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tool-specific controls */}
      {activeTool === 'align' && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-text-secondary mb-3">
            Path Alignment
          </h4>
          
          {selectedPathIds.length === 0 && (
            <p className="text-xs text-text-secondary">
              Select a path to align, then click the target path.
            </p>
          )}
          
          {selectedPathIds.length === 1 && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-secondary block mb-1">
                  Position along path
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  defaultValue="0"
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="text-xs text-text-secondary block mb-1">
                  Offset distance
                </label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  step="1"
                  defaultValue="0"
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="text-xs text-text-secondary block mb-1">
                  Rotation
                </label>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  defaultValue="0"
                  className="w-full"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="preserveShape"
                  className="rounded"
                />
                <label htmlFor="preserveShape" className="text-xs">
                  Preserve original shape
                </label>
              </div>
              
              <button className="w-full bg-accent-primary text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors">
                Apply Alignment
              </button>
            </div>
          )}
        </div>
      )}

      {/* SVG Code Viewer */}
      <div className="mt-6 border-t border-border pt-4">
        <button
          onClick={() => setShowCode(!showCode)}
          className="w-full flex items-center justify-between text-sm font-medium text-text-secondary hover:text-text-primary mb-2"
        >
          <span>📄 SVG Code</span>
          <span>{showCode ? '▼' : '▶'}</span>
        </button>
        
        {showCode && (
          <div className="space-y-2">
            <div className="relative">
              <textarea
                value={svgCode}
                readOnly
                className="w-full h-64 p-2 text-xs font-mono bg-bg-primary border border-border rounded resize-none focus:outline-none focus:ring-1 focus:ring-accent-primary"
                spellCheck={false}
              />
              <button
                onClick={handleCopyCode}
                className="absolute top-2 right-2 px-2 py-1 text-xs bg-accent-primary text-white rounded hover:bg-accent-primary/80 transition-colors"
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
            <div className="text-xs text-text-secondary">
              {svgCode.length.toLocaleString()} characters
            </div>
          </div>
        )}
      </div>
        </div>
      )}
      
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full bg-bg-secondary border border-r-0 border-border rounded-l px-1 py-2 hover:bg-bg-tertiary transition-colors md:hidden"
        title={isCollapsed ? 'Show properties' : 'Hide properties'}
      >
        {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>
    </div>
  );
};
