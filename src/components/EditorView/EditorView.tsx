import { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toolbar } from '../Toolbar/Toolbar';
import { CanvasWithCode } from '../Canvas/CanvasWithCode';
import { PropertiesPanel } from '../PropertiesPanel/PropertiesPanel';
import { HelpOverlay } from '../HelpOverlay/HelpOverlay';
import { ImageConverter } from '../ImageConverter/ImageConverter';
import { ExportSVGModal } from '../ExportSVGModal';
import { SmartHealModal } from '../SmartHealModal/SmartHealModal';
import { SmoothPathModal } from '../SmoothPathModal/SmoothPathModal';
import { useEditorStore } from '../../store/editorStore';
import { exportSVG, parseSVG } from '../../engine/parser';
import { mergeSimilarPaths, mergeSelectedPaths } from '../../engine/pathMerging';
import { autoColorize } from '../../engine/pathEditor';
import { perfectSquare } from '../../engine/perfectSquare';
import { shouldIgnoreKeyboardShortcut } from '../../utils/keyboard';
import { FolderOpen, Camera, Save, FileCode, Image, Sparkles, FileUp, User } from 'lucide-react';
import { Trash2 } from 'lucide-react';
import { MobileNotice } from '../MobileNotice';
import { Dropdown } from '../Dropdown';
import { toast } from 'sonner';
import { ProFeaturesContext } from '../../context/ProFeaturesContext';

export function EditorView() {
  const navigate = useNavigate();
  
  // Get PRO features from context
  const proFeatures = useContext(ProFeaturesContext);
  if (!proFeatures) throw new Error('ProFeaturesContext not found');
  const { 
    ProFeatureModal, 
    AuthModal, 
    UpgradeModal, 
    WelcomeProModal, 
    ExportModal, 
    ImageExportModal,
    UserMenu 
  } = proFeatures.components;
  const { useAuthStore } = proFeatures.hooks;
  const user = useAuthStore((state) => state.user);
  
  const svgDocument = useEditorStore((state) => state.svgDocument);
  const setSVGDocument = useEditorStore((state) => state.setSVGDocument);
  const selectedPathIds = useEditorStore((state) => state.selectedPathIds);
  const deletePath = useEditorStore((state) => state.deletePath);
  const setTool = useEditorStore((state) => state.setTool);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const canUndo = useEditorStore((state) => state.canUndo());
  const canRedo = useEditorStore((state) => state.canRedo());
  const toggleHelp = useEditorStore((state) => state.toggleHelp);
  const showHelp = useEditorStore((state) => state.showHelp);
  const toggleHeatmap = useEditorStore((state) => state.toggleHeatmap);
  const toggleCodePanel = useEditorStore((state) => state.toggleCodePanel);
  const clearProject = useEditorStore((state) => state.clearProject);
  
  const [showConverter, setShowConverter] = useState(false);
  const [showExportSVGModal, setShowExportSVGModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImageExportModal, setShowImageExportModal] = useState(false);
  const [showProFeatureModal, setShowProFeatureModal] = useState(false);
  
  // Check if PRO features are available in this build
  const hasProFeatures = !!proFeatures?.isProVersion;
  
  const [proFeatureName, setProFeatureName] = useState('');
  const [proFeatureDescription, setProFeatureDescription] = useState('');
  const [proFeaturePreview, setProFeaturePreview] = useState<React.ReactNode>(null);
  const [showSmartHeal, setShowSmartHeal] = useState(false);
  const [showSmoothPath, setShowSmoothPath] = useState(false);
  const [showWelcomeProModal, setShowWelcomeProModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingClear, setPendingClear] = useState(false);

  // Auto-reset the clear confirmation after 3 seconds
  useEffect(() => {
    if (!pendingClear) return;
    const t = setTimeout(() => setPendingClear(false), 3000);
    return () => clearTimeout(t);
  }, [pendingClear]);

  // Cancel pending clear with Escape
  useEffect(() => {
    if (!pendingClear) return;
    const cancel = (e: KeyboardEvent) => { if (e.key === 'Escape') setPendingClear(false); };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, [pendingClear]);

  // Auto-load demo SVG if ?demo=logo parameter is present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === 'logo' && !svgDocument) {
      // Dynamically import demo logo to avoid bloating main bundle
      import('../../data/demoLogo').then(({ DEMO_LOGO_SVG }) => {
        try {
          const doc = parseSVG(DEMO_LOGO_SVG);
          setSVGDocument(doc);
          // Clear query parameter after loading
          window.history.replaceState({}, '', '/editor');
        } catch (e) {
          console.error('Failed to load demo SVG:', e);
        }
      });
    }
  }, [svgDocument, setSVGDocument]);

  // Listen for converter open events from empty state
  useEffect(() => {
    const handleOpenConverter = () => setShowConverter(true);
    window.addEventListener('openConverter', handleOpenConverter);
    return () => window.removeEventListener('openConverter', handleOpenConverter);
  }, []);

  // Check for success URL param (Stripe return)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      toast.success('Payment successful! Verifying license...', { duration: 5000 });
      
      // Clean URL
      window.history.replaceState({}, '', '/editor');
      
      // Refresh session to get updated is_pro status (retry a few times)
      const checkProStatus = async (attempts = 0) => {
        await useAuthStore.getState().refreshSession();
        const isNowPro = useAuthStore.getState().isPro;
        
        if (isNowPro) {
          setShowWelcomeProModal(true);
        } else if (attempts < 3) {
          // Retry in 2 seconds (webhook might be slow)
          setTimeout(() => checkProStatus(attempts + 1), 2000);
        } else {
           // If on localhost, warn about webhooks
           if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
             toast.info('On localhost? Make sure Stripe CLI is forwarding webhooks!', { duration: 10000 });
           }
        }
      };
      
      checkProStatus();
    }
  }, [useAuthStore]);

  // Listen for PRO feature requests
  useEffect(() => {
    const handleShowProFeature = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { feature } = customEvent.detail;
      
      if (feature === 'autoColorize') {
        setProFeatureName('Auto-Colorize');
        setProFeatureDescription('Replace all colors with CSS currentColor for themeable icons. Use Export Component to generate framework code with currentColor.');
        
        // Don't show broken preview (CSS variables don't exist), show benefits instead
        setProFeaturePreview(
          <div className="text-sm text-text-secondary bg-bg-primary p-4 rounded border border-border">
            <div className="mb-3">
              <strong className="text-white">✨ Auto-Colorize Benefits:</strong>
            </div>
            <ul className="space-y-2 list-disc list-inside">
              <li>Replace all colors with <code className="px-1.5 py-0.5 bg-bg-secondary rounded text-accent-primary">currentColor</code></li>
              <li>Icons inherit color from parent CSS</li>
              <li>Perfect for dark/light mode themes</li>
              <li>Works seamlessly with Export Component</li>
            </ul>
            <div className="mt-4 p-3 bg-bg-secondary rounded border border-border">
              <div className="text-xs text-text-secondary mb-1">💡 Tip:</div>
              <div className="text-xs">Use <strong>Export Component</strong> after Auto-Colorize to generate React/Vue/Svelte code with themeable colors</div>
            </div>
          </div>
        );
        setShowProFeatureModal(true);
      }
    };
    
    window.addEventListener('showProFeature', handleShowProFeature);
    return () => window.removeEventListener('showProFeature', handleShowProFeature);
  }, [svgDocument]);

  const handleExport = useCallback(() => {
    if (!svgDocument) return;

    // Open Export SVG Modal with optional auto-colorize step
    setShowExportSVGModal(true);
  }, [svgDocument]);

  // Legacy direct download (keeping for keyboard shortcut compatibility)
  const handleDirectDownload = useCallback(() => {
    if (!svgDocument) return;

    try {
      const svgString = exportSVG(svgDocument);
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `edited-svg-${Date.now()}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed — try again');
    }
  }, [svgDocument]);

  const handleFileOpen = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.svg,image/svg+xml';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const groupTransformCount = (text.match(/<g\b[^>]*\stransform=/gi) ?? []).length;
        const doc = parseSVG(text);
        setSVGDocument(doc);
        if (groupTransformCount > 0) {
          toast.info(
            `${groupTransformCount} group transform${groupTransformCount !== 1 ? 's' : ''} inlined on import`,
            { duration: 3000 }
          );
        }
        
        // Reset view
        const setZoom = useEditorStore.getState().setZoom;
        const setPan = useEditorStore.getState().setPan;
        setZoom(1);
        setPan(0, 0);
      } catch (error) {
        console.error('Failed to parse SVG:', error);
        toast.error('Failed to load file — check the SVG format');
      }
    };

    input.click();
  }, [setSVGDocument]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keyboard shortcuts when typing in input fields (except ESC)
      if (shouldIgnoreKeyboardShortcut(e, true)) {
        return;
      }
      
      // Export: Cmd/Ctrl+S (direct download for keyboard shortcut)
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleDirectDownload();
      }
      
      // Undo: Cmd/Ctrl+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      
      // Redo: Cmd/Ctrl+Shift+Z
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        redo();
      }
      
      // Help: ?
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        toggleHelp();
      }
      
      // Toggle Code Panel: Cmd/Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k' && !e.shiftKey) {
        e.preventDefault();
        toggleCodePanel();
      }
      
      // Tool Shortcuts
      // Edit Tool: E (default tool, always active)
      if (e.key === 'e' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setTool('edit');
      }
      
      // Align Tool: A
      if (e.key === 'a' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setTool('align');
      }
      
      // Path Alignment Modal: Shift+A
      if (e.key === 'A' && e.shiftKey && !e.metaKey && !e.ctrlKey && svgDocument && svgDocument.paths.length >= 2) {
        e.preventDefault();
        // Trigger path alignment modal
        // This is handled in Toolbar, so we'll use a custom event
        window.dispatchEvent(new CustomEvent('openPathAlignment'));
      }
      
      // Heatmap: X
      if (e.key === 'x' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        toggleHeatmap();
      }
      
      // Merge Paths: M
      if (e.key === 'm' && !e.metaKey && !e.ctrlKey && svgDocument && svgDocument.paths.length >= 2) {
        e.preventDefault();
        if (selectedPathIds.length >= 2) {
          const mergedDoc = mergeSelectedPaths(svgDocument, selectedPathIds);
          setSVGDocument(mergedDoc);
        } else {
          const { document: mergedDoc, mergedCount } = mergeSimilarPaths(svgDocument, 0.95);
          if (mergedCount > 0) {
            setSVGDocument(mergedDoc);
          }
        }
      }
      
      // Auto-colorize: C
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey && svgDocument && svgDocument.paths.length > 0) {
        e.preventDefault();
        const updatePath = useEditorStore.getState().updatePath;
        const targetPathIds = selectedPathIds.length > 0 ? selectedPathIds : svgDocument.paths.map(p => p.id);
        
        targetPathIds.forEach(pathId => {
          const path = svgDocument.paths.find(p => p.id === pathId);
          if (path) {
            const colorized = autoColorize(path);
            if (colorized.fill !== path.fill || colorized.stroke !== path.stroke) {
              updatePath(pathId, colorized, 'Auto-colorize');
            }
          }
        });
      }
      
      // Perfect Square: Q
      if (e.key === 'q' && !e.metaKey && !e.ctrlKey && svgDocument && svgDocument.paths.length > 0) {
        e.preventDefault();
        const squared = perfectSquare(svgDocument);
        setSVGDocument(squared);
      }
      
      // Smart Heal: H
      if (e.key === 'h' && !e.metaKey && !e.ctrlKey && svgDocument && selectedPathIds.length > 0) {
        e.preventDefault();
        setShowSmartHeal(true);
      }
      
      // Smooth Path: S
      if (e.key === 's' && !e.metaKey && !e.ctrlKey && svgDocument && selectedPathIds.length > 0) {
        e.preventDefault();
        setShowSmoothPath(true);
      }
      
      // Delete Paths: Cmd/Ctrl+Backspace (when paths are selected)
      // Note: Regular Delete/Backspace is reserved for deleting points in Edit mode
      if (e.key === 'Backspace' && (e.metaKey || e.ctrlKey) && selectedPathIds.length > 0) {
        e.preventDefault();
        const pathsToDelete = [...selectedPathIds];
        pathsToDelete.forEach(pathId => {
          deletePath(pathId, 'Delete Path');
        });
      }
      
      // Close help: Esc
      if (e.key === 'Escape' && showHelp) {
        e.preventDefault();
        toggleHelp();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDirectDownload, undo, redo, toggleHelp, toggleHeatmap, toggleCodePanel, showHelp, svgDocument, selectedPathIds, setSVGDocument, deletePath, setTool]);

  const handleManageSubscription = async () => {
    try {
      const session = useAuthStore.getState().session;
      if (!session) return;
      
      const loadingToast = toast.loading('Opening customer portal...');
      
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          returnUrl: window.location.href
        })
      });
      
      const data = await response.json();
      toast.dismiss(loadingToast);
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || 'Failed to open portal');
      }
    } catch (error) {
      console.error('Portal error:', error);
      toast.error('Failed to open subscription management');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-bg-primary text-text-primary overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-bg-secondary border-b border-border px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <img src="/logo.svg?v=1" alt="PathRefine" className="h-7 w-7" />
            <div className="flex items-baseline gap-1">
              <h1 className="text-lg font-bold text-accent-primary">PathRefine</h1>
              <span className="text-xs text-text-secondary">.dev</span>
            </div>
          </div>
          
          {/* New Dropdown */}
          <Dropdown
            label="New"
            icon={<FileUp size={16} strokeWidth={2} />}
            variant="primary"
            items={[
              {
                label: 'Open SVG File',
                icon: <FolderOpen size={16} />,
                onClick: handleFileOpen
              },
              {
                label: 'Convert Image to SVG',
                icon: <Camera size={16} />,
                onClick: () => setShowConverter(true)
              },
              ...(hasProFeatures ? [{
                label: 'Create with AI',
                icon: <Sparkles size={16} />,
                onClick: () => {
                  setProFeatureName('Create with AI');
                  setProFeatureDescription('Generate SVG paths and shapes using AI prompts. Describe what you want to create, and our AI will generate the perfect SVG code for you.');
                  setProFeaturePreview(
                    <div className="text-sm text-text-secondary space-y-4">
                      <div className="bg-bg-primary p-4 rounded border border-border">
                        <div className="mb-3">
                          <strong className="text-white">✨ AI Prompt Examples:</strong>
                        </div>
                        <ul className="space-y-2 list-disc list-inside">
                          <li>"Create a heart icon"</li>
                          <li>"Draw a modern rocket ship"</li>
                          <li>"Generate a minimalist sun icon"</li>
                          <li>"Make a smooth curved arrow pointing right"</li>
                        </ul>
                      </div>
                      <div className="p-3 bg-bg-secondary rounded border border-border">
                        <div className="text-xs text-text-secondary mb-1">💡 How it works:</div>
                        <div className="text-xs">Type what you want → AI generates SVG → Instantly editable in PathRefine</div>
                      </div>
                    </div>
                  );
                  setShowProFeatureModal(true);
                },
                onRestrictedClick: () => {
                  setProFeatureName('Create with AI');
                  setProFeatureDescription('Generate SVG paths and shapes using AI prompts. Describe what you want to create, and our AI will generate the perfect SVG code for you.');
                  setProFeaturePreview(
                    <div className="text-sm text-text-secondary space-y-4">
                      <div className="bg-bg-primary p-4 rounded border border-border">
                        <div className="mb-3">
                          <strong className="text-white">✨ AI Prompt Examples:</strong>
                        </div>
                        <ul className="space-y-2 list-disc list-inside">
                          <li>"Create a heart icon"</li>
                          <li>"Draw a modern rocket ship"</li>
                          <li>"Generate a minimalist sun icon"</li>
                          <li>"Make a smooth curved arrow pointing right"</li>
                        </ul>
                      </div>
                      <div className="p-3 bg-bg-secondary rounded border border-border">
                        <div className="text-xs text-text-secondary mb-1">💡 How it works:</div>
                        <div className="text-xs">Type what you want → AI generates SVG → Instantly editable in PathRefine</div>
                      </div>
                    </div>
                  );
                  setShowProFeatureModal(true);
                },
                isPro: true
              }] : [])
            ]}
          />
          
          {svgDocument && (
            <>
              {/* Undo/Redo buttons */}
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  className="p-2 hover:bg-bg-tertiary rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Undo (Cmd/Ctrl+Z)"
                >
                  <span className="text-lg">↶</span>
                </button>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  className="p-2 hover:bg-bg-tertiary rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Redo (Cmd/Ctrl+Shift+Z)"
                >
                  <span className="text-lg">↷</span>
                </button>
              </div>
              
              <div className="h-6 w-px bg-border mx-2" />
              
              {/* Export Dropdown */}
              <Dropdown
                label="Export"
                icon={<Save size={16} strokeWidth={2} />}
                variant="primary"
                items={[
                  {
                    label: 'Export to SVG',
                    icon: <Save size={16} />,
                    onClick: handleExport
                  },
                  ...(hasProFeatures ? [{
                    label: 'Export Component',
                    icon: <FileCode size={16} />,
                    onClick: () => setShowExportModal(true),
                    onRestrictedClick: () => {
                      setProFeatureName('Export Component');
                      setProFeatureDescription('Export your SVG as optimized framework components for React, Vue, Svelte, or Solid. Includes TypeScript support and automatic prop handling.');
                      setProFeaturePreview(
                        <div className="text-sm text-text-secondary space-y-4">
                          <div className="bg-bg-primary p-4 rounded border border-border">
                            <div className="mb-3">
                              <strong className="text-white">🎯 Framework Support:</strong>
                            </div>
                            <ul className="space-y-2 list-disc list-inside">
                              <li><strong>React</strong> - TypeScript + JSX with props</li>
                              <li><strong>Vue</strong> - SFC with composition API</li>
                              <li><strong>Svelte</strong> - Native component syntax</li>
                              <li><strong>Solid</strong> - Reactive primitives</li>
                            </ul>
                          </div>
                          <div className="p-3 bg-bg-secondary rounded border border-border">
                            <div className="text-xs text-text-secondary mb-1">💡 Pro Tip:</div>
                            <div className="text-xs">Use with <strong>Auto-Colorize</strong> to generate components with CSS variable support for themeable icons</div>
                          </div>
                        </div>
                      );
                      setShowProFeatureModal(true);
                    },
                    isPro: true
                  }] : []),
                  ...(hasProFeatures ? [{
                    label: 'Export as Image',
                    icon: <Image size={16} />,
                    onClick: () => setShowImageExportModal(true),
                    onRestrictedClick: () => {
                      setProFeatureName('Export as Image');
                      setProFeatureDescription('Export your SVG as high-quality raster images in multiple formats: WebP for web, PNG with transparency, or multi-resolution ICO files for favicons.');
                      setProFeaturePreview(
                        <div className="text-sm text-text-secondary space-y-4">
                          <div className="bg-bg-primary p-4 rounded border border-border">
                            <div className="mb-3">
                              <strong className="text-white">📸 Export Formats:</strong>
                            </div>
                            <ul className="space-y-2 list-disc list-inside">
                              <li><strong>WebP</strong> - Modern web format, smaller file sizes</li>
                              <li><strong>PNG</strong> - Transparent backgrounds supported</li>
                              <li><strong>ICO</strong> - Multi-resolution favicons (16×16 to 512×512)</li>
                            </ul>
                          </div>
                          <div className="p-3 bg-bg-secondary rounded border border-border">
                            <div className="text-xs text-text-secondary mb-1">💡 Use Cases:</div>
                            <div className="text-xs">Perfect for favicons, app icons, social media graphics, and web assets</div>
                          </div>
                        </div>
                      );
                      setShowProFeatureModal(true);
                    },
                    isPro: true
                  }] : [])
                ]}
              />
              
              <div className="h-6 w-px bg-border mx-2" />
              
              {/* Clear Button */}
              <button
                onClick={() => {
                  if (pendingClear) {
                    clearProject();
                    setPendingClear(false);
                  } else {
                    setPendingClear(true);
                  }
                }}
                className={`px-2 sm:px-4 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 sm:gap-2 ${
                  pendingClear ? 'bg-red-700 ring-2 ring-red-400' : 'bg-red-600 hover:bg-red-700'
                }`}
                title={pendingClear ? 'Click again to confirm — this removes all unsaved work' : 'Clear project'}
                aria-label={pendingClear ? 'Confirm clear project — press Escape to cancel' : 'Clear project'}
              >
                <Trash2 size={16} strokeWidth={1.5} />
                <span className="hidden sm:inline">{pendingClear ? 'Confirm?' : 'Clear'}</span>
              </button>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {svgDocument && (
            <button
              onClick={() => navigate('/')}
              className="px-3 py-1.5 text-sm text-text-secondary hover:text-accent-primary transition-colors"
              title="Back to home"
            >
              ← Home
            </button>
          )}
          <button 
            onClick={toggleHelp}
            className="flex items-center gap-2 text-xs sm:text-sm text-text-secondary hover:text-accent-primary transition-colors cursor-pointer"
            title="Show keyboard shortcuts"
          >
            <kbd className="px-2 py-1 bg-bg-primary rounded border border-border hidden sm:inline">⌘Z</kbd>
            <span className="hidden sm:inline">Undo</span>
            <kbd className="px-2 py-1 bg-bg-primary rounded border border-border sm:ml-3">?</kbd>
            <span>Help</span>
          </button>
          
          {user ? (
            <UserMenu onManageSubscription={handleManageSubscription} />
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors flex items-center gap-2"
            >
              <User size={16} />
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <Toolbar />
        <CanvasWithCode />
        <PropertiesPanel />
      </div>
      
      {/* Image Converter Modal */}
      {showConverter && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
          onClick={() => setShowConverter(false)}
        >
          <div 
            className="bg-bg-secondary border border-border rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-xl font-bold">PNG to SVG Converter</h2>
              <button
                onClick={() => setShowConverter(false)}
                className="text-2xl hover:text-accent-primary transition-colors"
                title="Close"
              >
                ×
              </button>
            </div>
            <ImageConverter onClose={() => setShowConverter(false)} />
          </div>
        </div>
      )}
      
      {/* Help Overlay */}
      <HelpOverlay />
      
      {/* PRO Feature Modal */}
      <ProFeatureModal
        isOpen={showProFeatureModal}
        onClose={() => {
          setShowProFeatureModal(false);
          setProFeaturePreview(null);
          setProFeatureName('');
          setProFeatureDescription('');
        }}
        onOpenAuth={() => setShowAuthModal(true)}
        featureName={proFeatureName}
        description={proFeatureDescription}
        previewContent={proFeaturePreview}
      />
      
      {/* Export Modals */}
      <ExportSVGModal 
        isOpen={showExportSVGModal} 
        onClose={() => setShowExportSVGModal(false)} 
      />
      
      <ExportModal 
        isOpen={showExportModal} 
        onClose={() => setShowExportModal(false)} 
      />
      
      <ImageExportModal 
        isOpen={showImageExportModal} 
        onClose={() => setShowImageExportModal(false)} 
      />
      
      {/* Smart Heal Modal */}
      {showSmartHeal && (
        <SmartHealModal
          onClose={() => setShowSmartHeal(false)}
          onApply={() => { setShowSmartHeal(false); }}
        />
      )}
      
      {/* Smooth Path Modal */}
      {showSmoothPath && (
        <SmoothPathModal
          onClose={() => setShowSmoothPath(false)}
          onApply={() => {
            // Handled in modal itself via store
            setShowSmoothPath(false);
          }}
        />
      )}
      
      {/* Welcome to PRO Modal */}
      <WelcomeProModal 
        isOpen={showWelcomeProModal} 
        onClose={() => setShowWelcomeProModal(false)} 
      />

      {/* Upgrade Modal */}
      <UpgradeModal onOpenAuth={() => setShowAuthModal(true)} />
      
      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
      
      {/* Mobile Notice */}
      <MobileNotice />
    </div>
  );
}
