import React, { useCallback, useContext, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { useDeviceTier } from '../../hooks/useDeviceTier';
import { smoothPath } from '../../engine/pathSmoothing';
import { countAnchorPoints } from '../../engine/pathAnalysis';
import { SmartHealModal } from '../SmartHealModal/SmartHealModal';
import { joinPoints } from '../../engine/pathEditor';
import { PerfectSquareModal } from '../PerfectSquareModal/PerfectSquareModal';
import { SmoothPathModal } from '../SmoothPathModal/SmoothPathModal';
import { MergePathsModal } from '../MergePathsModal/MergePathsModal';
import { PathAlignmentModal } from '../PathAlignmentModal/PathAlignmentModal';
import { RestrictedFeature } from '../RestrictedFeature';
import { alignPathsToPath } from '../../engine/alignment';
import { Activity, Waves, Link, Palette, Sparkles, Square, Grid3x3, Flame, AlignVerticalDistributeCenter, Wand2 } from 'lucide-react';
import type { PathAlignment, Path } from '../../types/svg';
import { Tooltip } from '../Tooltip/Tooltip';
import { toast } from 'sonner';
import { ProFeaturesContext } from '../../context/ProFeaturesContext';
import { track } from '../../utils/analytics';

export const Toolbar: React.FC = () => {
  // Get PRO features from context
  const proFeatures = useContext(ProFeaturesContext);
  if (!proFeatures) throw new Error('ProFeaturesContext not found');
  const organicSmoothPath = proFeatures.engine.organicSmoothPath;
  const hasProFeatures = !!proFeatures.isProVersion;
  const AutoColorizeModal = proFeatures.components.AutoColorizeModal;
  const AutoRefineModal = proFeatures.components.AutoRefineModal;
  const { useAuthStore } = proFeatures.hooks;
  const isPro = useAuthStore((state) => state.isPro);
  
  const deviceTier = useDeviceTier();
  // On mobile, the TouchActionBar + bottom drawer replace the toolbar entirely
  // (toolbar is narrow vertical and inaccessible on small screens)
  
  const setSVGDocument = useEditorStore(state => state.setSVGDocument);
  const svgDocument = useEditorStore(state => state.svgDocument);
  const selectedPathIds = useEditorStore(state => state.selectedPathIds);
  const toggleUpgradeModal = useEditorStore(state => state.toggleUpgradeModal);
  const editingPathId = useEditorStore(state => state.editingPathId);
  const selectedPointIndices = useEditorStore(state => state.selectedPointIndices);
  const clearPointSelection = useEditorStore(state => state.clearPointSelection);
  const updatePath = useEditorStore(state => state.updatePath);
  const snapToGrid = useEditorStore(state => state.snapToGrid);
  const toggleSnapToGrid = useEditorStore(state => state.toggleSnapToGrid);
  const showHeatmap = useEditorStore(state => state.showHeatmap);
  const toggleHeatmap = useEditorStore(state => state.toggleHeatmap);

  const [showPerfectSquareModal, setShowPerfectSquareModal] = useState(false);
  const [showAutoColorizeModal, setShowAutoColorizeModal] = useState(false);
  const [showAutoRefineModal, setShowAutoRefineModal] = useState(false);
  const [showSmoothModal, setShowSmoothModal] = useState(false);
  const [showSmartHealModal, setShowSmartHealModal] = useState(false);
  const [showMergePathsModal, setShowMergePathsModal] = useState(false);
  const [showPathAlignmentModal, setShowPathAlignmentModal] = useState(false);

  // Listen for keyboard shortcut to open Path Alignment
  React.useEffect(() => {
    const handleOpenPathAlignment = () => {
      if (svgDocument && svgDocument.paths.length >= 2) {
        setShowPathAlignmentModal(true);
      }
    };
    window.addEventListener('openPathAlignment', handleOpenPathAlignment);
    return () => window.removeEventListener('openPathAlignment', handleOpenPathAlignment);
  }, [svgDocument]);

  const handleSmoothPath = useCallback(() => {
    if (!svgDocument || selectedPathIds.length === 0) {
      toast.warning('Select a path first');
      return;
    }

    // Open modal instead of directly smoothing
    setShowSmoothModal(true);
  }, [svgDocument, selectedPathIds]);

  const handleAutoColorize = useCallback(() => {
    if (!svgDocument || svgDocument.paths.length === 0) {
      toast.warning('Load an SVG first');
      return;
    }
    if (!isPro) {
      toggleUpgradeModal();
      return;
    }
    track({ name: 'auto_colorize_opened' });
    setShowAutoColorizeModal(true);
  }, [svgDocument, isPro, toggleUpgradeModal]);

  const handleAutoRefine = useCallback(() => {
    if (!svgDocument || selectedPathIds.length === 0) {
      toast.warning('Select a path first');
      return;
    }
    if (!isPro) {
      toggleUpgradeModal();
      return;
    }
    track({ name: 'auto_refine_opened' });
    setShowAutoRefineModal(true);
  }, [svgDocument, selectedPathIds, isPro, toggleUpgradeModal]);

  const handleApplySmooth = useCallback((
    mode: 'polish' | 'organic',
    smoothness: number,
    convertLinesToCurves: boolean,
    selectedPointsOnly: boolean,
    preserveSmooth: boolean,
    cornerAngle: number
  ) => {
    if (!svgDocument || selectedPathIds.length === 0) return;

    selectedPathIds.forEach(pathId => {
      const path = svgDocument.paths.find(p => p.id === pathId);
      if (path) {
        if (mode === 'organic') {
          if (!organicSmoothPath) {
            toast.error('Organic smoothing is a PRO feature');
            return;
          }
          const smoothed = organicSmoothPath(path, smoothness, true, cornerAngle);
          updatePath(pathId, smoothed, 'Organic smooth');
          track({ name: 'smooth_applied', mode: 'organic' });
          toast.success(`Smoothed path organically`, {
            description: `Reduced jitter with ${Math.round(smoothness * 100)}% strength`
          });
        } else {
          const smoothed = smoothPath(
            path,
            smoothness,
            convertLinesToCurves,
            selectedPointsOnly && editingPathId === pathId ? selectedPointIndices : undefined,
            preserveSmooth
          );
          updatePath(pathId, smoothed, 'Polish curves');
          track({ name: 'smooth_applied', mode: 'polish' });
          toast.success(`Polished path curves`, {
            description: `Applied ${Math.round(smoothness * 100)}% smoothing factor`
          });
        }
      }
    });
  }, [svgDocument, selectedPathIds, editingPathId, selectedPointIndices, updatePath, organicSmoothPath]);

  const handleHealPath = useCallback(() => {
    if (!svgDocument || selectedPathIds.length === 0) {
      toast.warning('Select a path first');
      return;
    }

    track({ name: 'smart_heal_opened' });
    setShowSmartHealModal(true);
  }, [svgDocument, selectedPathIds]);

  const handleApplySmartHeal = useCallback((results: Array<{ path: Path; originalPathId: string }>) => {
    if (!svgDocument || results.length === 0) return;

    if (results.length === 1) {
      // Single path — one updatePath call (own undo entry)
      const { path: resultPath, originalPathId } = results[0];
      const originalPath = svgDocument.paths.find(p => p.id === originalPathId);
      if (originalPath) {
        const originalCount = countAnchorPoints(originalPath);
        updatePath(originalPathId, resultPath, 'Smart Heal');
        const newCount = countAnchorPoints(resultPath);
        const diff = originalCount - newCount;
        track({ name: 'smart_heal_applied', reduction_pct: originalCount > 0 ? Math.round((diff / originalCount) * 100) : 0 });
        toast.success('Smart Heal complete', {
          description: `Removed ${diff} redundant point${diff !== 1 ? 's' : ''} (${Math.round((diff / originalCount) * 100)}%)`
        });
      }
    } else {
      // Batch — apply all in a single setSVGDocument call = one undo step
      const resultMap = new Map(results.map(r => [r.originalPathId, r.path]));
      const totalBefore = results.reduce((s, r) => {
        const orig = svgDocument.paths.find(p => p.id === r.originalPathId);
        return s + (orig ? countAnchorPoints(orig) : 0);
      }, 0);
      const totalAfter = results.reduce((s, r) => s + countAnchorPoints(r.path), 0);
      const newPaths = svgDocument.paths.map(p => resultMap.get(p.id) ?? p);
      setSVGDocument({ ...svgDocument, paths: newPaths });
      const diff = totalBefore - totalAfter;
      track({ name: 'heal_all_applied', paths_count: results.length, total_reduction_pct: totalBefore > 0 ? Math.round((diff / totalBefore) * 100) : 0 });
      toast.success(`Smart Heal complete · ${results.length} paths`, {
        description: `${totalBefore} → ${totalAfter} points · ${diff} removed (${Math.round((diff / totalBefore) * 100)}%)`
      });
    }
  }, [svgDocument, updatePath, setSVGDocument]);

  const handleJoinPoints = useCallback(() => {
    if (!svgDocument || !editingPathId || selectedPointIndices.length < 2) {
      toast.warning('Select at least 2 anchor points to join');
      return;
    }

    const path = svgDocument.paths.find(p => p.id === editingPathId);
    if (path) {
      const joined = joinPoints(path, selectedPointIndices);
      updatePath(editingPathId, joined, 'Join points');
      clearPointSelection();
      toast.success('Joined points', {
        description: 'Selected points connected, intermediate points removed'
      });
    }
  }, [svgDocument, editingPathId, selectedPointIndices, updatePath, clearPointSelection]);

  const handleMergePaths = useCallback(() => {
    if (!svgDocument) {
      toast.warning('Load an SVG first');
      return;
    }

    // Always show modal for user control
    setShowMergePathsModal(true);
  }, [svgDocument]);


  const handlePerfectSquare = useCallback(() => {
    if (!svgDocument) {
      toast.warning('Load an SVG first');
      return;
    }

    setShowPerfectSquareModal(true);
  }, [svgDocument]);

  const handlePathAlignment = useCallback(() => {
    if (!svgDocument || svgDocument.paths.length < 2) {
      toast.warning('Need at least 2 paths to use alignment');
      return;
    }

    setShowPathAlignmentModal(true);
  }, [svgDocument]);

  const handleApplyPathAlignment = useCallback((alignment: PathAlignment) => {
    if (!svgDocument) return;

    const sourcePath = svgDocument.paths.find(p => p.id === alignment.sourcePathId);
    const targetPath = svgDocument.paths.find(p => p.id === alignment.targetPathId);

    if (!sourcePath || !targetPath) {
      toast.error('Source or target path not found');
      return;
    }

    // Generate aligned paths
    const alignedPaths = alignPathsToPath(sourcePath, targetPath, alignment);

    // Add all aligned paths to the document
    const newDoc = {
      ...svgDocument,
      paths: [...svgDocument.paths, ...alignedPaths],
    };

    setSVGDocument(newDoc);
    
    toast.success('Path Alignment Applied', {
      description: `Created ${alignedPaths.length} new aligned path${alignedPaths.length > 1 ? 's' : ''}`
    });
  }, [svgDocument, setSVGDocument]);

  return (
    <>
    {/* On mobile, hide the side toolbar — TouchActionBar and MobilePathDrawer handle everything */}
    {deviceTier !== 'mobile' && (
    <div className="w-16 bg-bg-secondary border-r border-border flex flex-col items-center py-2 sm:py-4 gap-1 sm:gap-2 overflow-y-auto hide-scrollbar">
      
      {/* ACTIONS - Path Operations */}
      <div className="flex flex-col gap-1 sm:gap-2">
        <div className="text-[7px] sm:text-[8px] text-text-secondary text-center uppercase tracking-wider mb-1">
          Actions
        </div>
        <Tooltip label="Smart Heal" shortcut="H" description="Remove the most complex point">
          <button
            onClick={handleHealPath}
            disabled={!svgDocument || selectedPathIds.length === 0}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center bg-green-600 hover:bg-green-700 text-white text-lg sm:text-xl transition-all duration-200 shadow-lg disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-bg-secondary"
            title="Smart Heal (Remove 1 point)"
          >
            <Activity size={20} strokeWidth={1.5} />
          </button>
        </Tooltip>

        {hasProFeatures && (
          <Tooltip label="Auto Refine" shortcut="PRO" description="One-click full optimization">
            <RestrictedFeature
              featureId="auto_refine"
              name="Auto Refine"
              description="Automatic 4-step processing"
              mode="bypass"
              onRestrictedClick={handleAutoRefine}
            >
            <button
              onClick={handleAutoRefine}
              disabled={!svgDocument || selectedPathIds.length === 0}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center bg-accent-primary text-white hover:bg-accent-secondary text-lg sm:text-xl transition-all duration-200 shadow-lg disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-bg-secondary relative"
              title="Auto Refine (Magic Fix)"
            >
              <Wand2 size={20} strokeWidth={1.5} />
              <span className="absolute -top-1.5 -right-1.5 px-1 py-0.5 text-[8px] leading-none font-black tracking-wide bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-md shadow-md border border-white/20">PRO</span>
            </button>
            </RestrictedFeature>
          </Tooltip>
        )}
        
        <Tooltip label="Smooth Path" shortcut="S" description="Soften sharp curves">
          <button
            onClick={handleSmoothPath}
            disabled={!svgDocument || selectedPathIds.length === 0}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center bg-bg-secondary text-text-secondary hover:bg-border hover:text-white text-lg sm:text-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Smooth Path (S)"
          >
            <Waves size={20} strokeWidth={1.5} />
          </button>
        </Tooltip>
        
        <Tooltip label="Join Points" shortcut="J" description="Remove points between selection">
          <button
            onClick={handleJoinPoints}
            disabled={!editingPathId || selectedPointIndices.length < 2}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center bg-bg-secondary text-text-secondary hover:bg-border hover:text-white text-lg sm:text-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Join Points (J) - Remove intermediate points"
          >
            <Link size={20} strokeWidth={1.5} />
          </button>
        </Tooltip>
        
        <Tooltip label="Merge Paths" shortcut="M" description="Combine paths of similar color">
          <button
            onClick={handleMergePaths}
            disabled={!svgDocument || svgDocument.paths.length < 2}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center bg-bg-secondary text-text-secondary hover:bg-border hover:text-white text-lg sm:text-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
            title={selectedPathIds.length >= 2 ? "Merge Selected Paths (M)" : "Merge Paths (M) - Combine similar colors"}
          >
            <Palette size={20} strokeWidth={1.5} />
          </button>
        </Tooltip>
        
        <Tooltip label="Path Alignment" shortcut="⇧A" description="Tile shapes along a path">
          <button
            onClick={handlePathAlignment}
            disabled={!svgDocument || svgDocument.paths.length < 2}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center bg-bg-secondary text-text-secondary hover:bg-border hover:text-white text-lg sm:text-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Path Alignment (Shift+A) - Align shapes along paths"
        >
            <AlignVerticalDistributeCenter size={20} strokeWidth={1.5} />
          </button>
        </Tooltip>
        
        {hasProFeatures && (
          <Tooltip label="Auto-Colorize" shortcut="C" description="Replace fills with currentColor">
            <RestrictedFeature
              featureId="auto_colorize"
              name="Auto Colorize"
              description="Intelligent color mapping"
              mode="bypass"
              onRestrictedClick={handleAutoColorize}
            >
            <button
              onClick={handleAutoColorize}
              disabled={!svgDocument || svgDocument.paths.length === 0}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center bg-bg-secondary text-text-secondary hover:bg-border hover:text-white text-lg sm:text-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed relative"
              title="Auto-colorize (C) - Replace colors with currentColor [PRO]"
            >
              <Sparkles size={20} strokeWidth={1.5} />
              <span className="absolute -top-1.5 -right-1.5 px-1 py-0.5 text-[8px] leading-none font-black tracking-wide bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-md shadow-md border border-white/20">PRO</span>
            </button>
            </RestrictedFeature>
          </Tooltip>
        )}
        
        <Tooltip label="Perfect Square" shortcut="Q" description="Center in 24×24 viewBox">
          <button
            onClick={handlePerfectSquare}
            disabled={!svgDocument || svgDocument.paths.length === 0}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center bg-bg-secondary text-text-secondary hover:bg-border hover:text-white text-lg sm:text-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Perfect Square (Q) - Center in 24×24 viewBox"
          >
            <Square size={20} strokeWidth={1.5} />
          </button>
        </Tooltip>
      </div>
      
      <div className="w-10 h-px bg-border my-1 sm:my-2" />
      
      {/* VIEW OPTIONS */}
      <div className="flex flex-col gap-1 sm:gap-2">
        <div className="text-[7px] sm:text-[8px] text-text-secondary text-center uppercase tracking-wider mb-1">
          View
        </div>
        <Tooltip label="Snap to Grid" shortcut="G" description="Snap points to nearest grid">
          <button
            onClick={toggleSnapToGrid}
            className={`
              w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center text-lg sm:text-xl
              transition-all duration-200
              ${snapToGrid 
                ? 'bg-accent-success text-white shadow-lg' 
                : 'bg-bg-secondary text-text-secondary hover:bg-border hover:text-white'
              }
            `}
            title="Snap to Grid (G)"
          >
            <Grid3x3 size={20} strokeWidth={1.5} />
          </button>
        </Tooltip>
        
        <Tooltip label="Complexity Heatmap" shortcut="X" description="Highlight dense regions in red">
          <button
            onClick={toggleHeatmap}
            className={`
              w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center text-lg sm:text-xl
              transition-all duration-200
              ${showHeatmap 
                ? 'bg-red-500 text-white shadow-lg' 
                : 'bg-bg-secondary text-text-secondary hover:bg-border hover:text-white'
              }
            `}
            title="Complexity Heatmap (X)"
          >
            <Flame size={20} strokeWidth={1.5} />
          </button>
        </Tooltip>
      </div>
      
      {/* Spacer to push future tools to bottom if needed */}
      <div className="flex-1" />
      
      {/* FUTURE: Advanced Tools */}
      {/* Uncomment when implementing these features
      <div className="w-10 h-px bg-border my-2" />
      <ToolButton
        tool="align"
        icon="🎯"
        label="Align Path (A)"
        active={activeTool === 'align'}
        onClick={() => setTool('align')}
      />
      
      <ToolButton
        tool="measure"
        icon="📏"
        label="Measure (M)"
        active={activeTool === 'measure'}
        onClick={() => setTool('measure')}
      />
      
      <ToolButton
        tool="animate"
        icon="✨"
        label="Animate (K)"
        active={activeTool === 'animate'}
        onClick={() => setTool('animate')}
      />
      */}
    </div>
    )} {/* end deviceTier !== 'mobile' */}

      {/* Modals */}
      <PerfectSquareModal 
        isOpen={showPerfectSquareModal} 
        onClose={() => setShowPerfectSquareModal(false)} 
      />
      <AutoColorizeModal 
        isOpen={showAutoColorizeModal} 
        onClose={() => setShowAutoColorizeModal(false)} 
      />
      <AutoRefineModal 
        isOpen={showAutoRefineModal} 
        onClose={() => setShowAutoRefineModal(false)} 
      />
      {showSmoothModal && (
        <SmoothPathModal
          onClose={() => setShowSmoothModal(false)}
          onApply={handleApplySmooth}
        />
      )}
      {showSmartHealModal && (
        <SmartHealModal
          onClose={() => setShowSmartHealModal(false)}
          onApply={handleApplySmartHeal}
        />
      )}
      {showMergePathsModal && (
        <MergePathsModal
          onClose={() => setShowMergePathsModal(false)}
        />
      )}
      {showPathAlignmentModal && svgDocument && (
        <PathAlignmentModal
          isOpen={showPathAlignmentModal}
          onClose={() => setShowPathAlignmentModal(false)}
          onApply={handleApplyPathAlignment}
          availablePaths={svgDocument.paths}
          selectedPathIds={selectedPathIds}
        />
      )}
    </>
  );
};
