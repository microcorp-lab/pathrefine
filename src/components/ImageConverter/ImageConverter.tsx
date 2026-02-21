import React, { useCallback, useState, useEffect } from 'react';
import { Activity, Eye } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { parseSVG } from '../../engine/parser';
import { analyzeDocument } from '../../engine/pathAnalysis';
import { generateSVG } from '../../engine/vtracerHelper';
import { track } from '../../utils/analytics';

export interface VTracerConfig {
  colorPrecision: number;
  layerDifference: number;
  filterSpeckle: number;
  mode: 'polygon' | 'spline' | 'pixel';
  cornerThreshold: number; // in degrees
  lengthThreshold: number;
  spliceThreshold: number; // in degrees
}

const PRESETS: Record<string, VTracerConfig> = {
  logo: {
    colorPrecision: 4, // Optimal for logos to reduce color noise
    layerDifference: 100, // High difference to merge similar layers
    filterSpeckle: 25, // Aggressive noise reduction
    mode: 'spline',
    cornerThreshold: 60,
    lengthThreshold: 4,
    spliceThreshold: 45,
  },
  photo: {
    colorPrecision: 4, // Reduced for consistency
    layerDifference: 16,
    filterSpeckle: 4,
    mode: 'spline',
    cornerThreshold: 60,
    lengthThreshold: 4,
    spliceThreshold: 45,
  },
  detailed: {
    colorPrecision: 3,
    layerDifference: 0,
    filterSpeckle: 2,
    mode: 'spline',
    cornerThreshold: 60,
    lengthThreshold: 4,
    spliceThreshold: 45,
  },
};

interface ImageConverterProps {
  onClose?: () => void;
}

export const ImageConverter: React.FC<ImageConverterProps> = ({ onClose }) => {
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{ points: number; size: string } | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [config, setConfig] = useState<VTracerConfig>(PRESETS.logo);
  const [selectedPreset, setSelectedPreset] = useState('logo');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewStats, setPreviewStats] = useState<{ paths: number; size: string } | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const setSVGDocument = useEditorStore(state => state.setSVGDocument);

  // ESC to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose && !converting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, converting]);
  const setZoom = useEditorStore(state => state.setZoom);
  const setPan = useEditorStore(state => state.setPan);

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    setConfig(PRESETS[preset]);
  };

  // Generate preview SVG with current settings (debounced)
  useEffect(() => {
    if (!imageFile) {
      setPreviewSvg(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setPreviewLoading(true);
        
        // Generate preview at same resolution as final (512px) for consistency
        const svgString = await generateSVG(imageFile, config, 512);
        setPreviewSvg(svgString);
        
        // Parse and analyze for stats
        try {
          const doc = parseSVG(svgString);
          setPreviewStats({
            paths: doc.paths.length,
            size: `${(svgString.length / 1024).toFixed(1)}KB`
          });
        } catch {
          setPreviewStats(null);
        }
      } catch (err) {
        console.error('Preview generation failed:', err);
        setPreviewSvg(null);
        setPreviewStats(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 800); // 800ms debounce

    return () => clearTimeout(timeoutId);
  }, [imageFile, config]);

  const convertImage = useCallback(async (file: File, userConfig: VTracerConfig) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, etc.)');
      return;
    }

    try {
      setConverting(true);
      setError(null);
      setAnalysisResult(null);

      // Generate final SVG at 512px to match preview
      // Note: VTracer WASM produces inconsistent results at 1024px (fewer paths)
      // This appears to be a memory/performance limitation in the WASM build
      const svgString = await generateSVG(file, userConfig, 512);

      // Parse the SVG
      const doc = parseSVG(svgString);
      
      setSVGDocument(doc);
      track({ name: 'svg_loaded', source: 'image_converter' });

      // Analyze the result
      const analysis = analyzeDocument(doc);
      setAnalysisResult({
        points: analysis.totalPoints,
        size: `${(analysis.estimatedFileSize / 1024).toFixed(1)}KB`
      });

      // Auto-fit the view to show the entire SVG
      // Small delay to ensure DOM updates
      setTimeout(() => {
        // Calculate zoom to fit 80% of viewport
        const viewportWidth = window.innerWidth * 0.6; // Account for sidebars
        const viewportHeight = window.innerHeight * 0.9;
        const scaleX = viewportWidth / doc.width;
        const scaleY = viewportHeight / doc.height;
        const fitZoom = Math.min(scaleX, scaleY, 1); // Max zoom of 1
        
        setZoom(fitZoom);
        setPan(0, 0);
      }, 50);

      // Close modal after successful conversion
      if (onClose) {
        setTimeout(() => onClose(), 100);
      }
      
    } catch (err) {
      console.error('Conversion error:', err);
      setError(err instanceof Error ? err.message : 'Failed to convert image');
    } finally {
      setConverting(false);
    }
  }, [onClose, setSVGDocument, setZoom, setPan]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
      setAnalysisResult(null);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const triggerFileInput = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setImageFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setError(null);
        setAnalysisResult(null);
      }
    };
    input.click();
  }, []);

  // Calculate estimated complexity based on config
  const estimatedComplexity = {
    colors: Math.max(1, Math.floor(256 / Math.pow(2, config.colorPrecision))),
    layers: config.layerDifference === 0 ? 256 : Math.floor(256 / config.layerDifference),
    quality: config.filterSpeckle > 50 ? 'Clean' : config.filterSpeckle > 20 ? 'Balanced' : 'Detailed',
  };

  return (
    <div className="p-6">
      {/* Drop Zone */}
      {!imageFile && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={triggerFileInput}
          className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-accent-primary transition-colors"
        >
          <div className="space-y-3">
            <div className="text-5xl">📸</div>
            <div className="text-lg font-medium">Upload PNG/JPG to Convert</div>
            <div className="text-sm text-text-secondary">
              Click or drag & drop an image here
            </div>
            <div className="text-xs text-text-secondary mt-2">
              Supports PNG, JPG, JPEG, GIF, BMP (max 1024px)
            </div>
          </div>
        </div>
      )}

      {/* Configuration Panel - Two Column Layout */}
      {imageFile && (
        <div className="grid grid-cols-2 gap-6">
          {/* Left Column: Preview & Info */}
          <div className="space-y-4">
            {/* Live Preview Tabs */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowOriginal(true);
                    setPreviewZoom(1);
                    setPreviewPan({ x: 0, y: 0 });
                  }}
                  className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
                    showOriginal 
                      ? 'bg-accent-primary text-white' 
                      : 'bg-bg-tertiary text-text-secondary hover:bg-border'
                  }`}
                >
                  Original
                </button>
                <button
                  onClick={() => {
                    setShowOriginal(false);
                    setPreviewZoom(1);
                    setPreviewPan({ x: 0, y: 0 });
                  }}
                  className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
                    !showOriginal 
                      ? 'bg-accent-primary text-white' 
                      : 'bg-bg-tertiary text-text-secondary hover:bg-border'
                  }`}
                >
                  Live Preview
                </button>
              </div>
              
              {/* Preview Container with Zoom */}
              <div className="bg-bg-tertiary rounded-lg relative overflow-hidden aspect-square">
                {/* Zoom Controls */}
                <div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-bg-primary/90 backdrop-blur rounded-lg p-1">
                  <button
                    onClick={() => setPreviewZoom(Math.min(previewZoom * 1.5, 5))}
                    className="w-8 h-8 hover:bg-bg-tertiary rounded transition-colors text-sm font-bold"
                    title="Zoom in (scroll up)"
                  >
                    +
                  </button>
                  <div className="px-2 text-xs font-mono text-text-secondary min-w-[3rem] text-center">
                    {Math.round(previewZoom * 100)}%
                  </div>
                  <button
                    onClick={() => {
                      setPreviewZoom(1);
                      setPreviewPan({ x: 0, y: 0 });
                    }}
                    className="w-8 h-8 hover:bg-bg-tertiary rounded transition-colors text-xs"
                    title="Reset zoom and pan"
                  >
                    1:1
                  </button>
                  <button
                    onClick={() => setPreviewZoom(Math.max(previewZoom / 1.5, 0.5))}
                    className="w-8 h-8 hover:bg-bg-tertiary rounded transition-colors text-sm font-bold"
                    title="Zoom out (scroll down)"
                  >
                    −
                  </button>
                </div>

                <div 
                  className={`w-full h-full p-4 flex items-center justify-center ${
                    previewZoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
                  }`}
                  onMouseDown={(e) => {
                    if (previewZoom > 1) {
                      setIsDragging(true);
                      setDragStart({ x: e.clientX - previewPan.x, y: e.clientY - previewPan.y });
                    }
                  }}
                  onMouseMove={(e) => {
                    if (isDragging && previewZoom > 1) {
                      setPreviewPan({
                        x: e.clientX - dragStart.x,
                        y: e.clientY - dragStart.y
                      });
                    }
                  }}
                  onMouseUp={() => setIsDragging(false)}
                  onMouseLeave={() => setIsDragging(false)}
                  onWheel={(e) => {
                    const delta = e.deltaY > 0 ? 0.9 : 1.1;
                    setPreviewZoom(Math.min(Math.max(previewZoom * delta, 0.5), 5));
                  }}
                >
                {previewLoading && !showOriginal && (
                  <div className="absolute inset-0 bg-bg-tertiary/90 flex items-center justify-center rounded-lg z-10">
                    <div className="text-center space-y-2">
                      <div className="text-3xl animate-pulse">🔄</div>
                      <div className="text-sm text-text-secondary">Generating preview...</div>
                    </div>
                  </div>
                )}
                
                {showOriginal ? (
                  previewUrl && (
                    <img 
                      src={previewUrl} 
                      alt="Original" 
                      className="max-w-full max-h-full object-contain transition-transform"
                      style={{
                        transform: `scale(${previewZoom}) translate(${previewPan.x / previewZoom}px, ${previewPan.y / previewZoom}px)`,
                        transformOrigin: 'center'
                      }}
                    />
                  )
                ) : previewSvg ? (
                  <div 
                    className="max-w-full max-h-full [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:w-auto [&>svg]:h-auto transition-transform"
                    style={{
                      transform: `scale(${previewZoom}) translate(${previewPan.x / previewZoom}px, ${previewPan.y / previewZoom}px)`,
                      transformOrigin: 'center'
                    }}
                    dangerouslySetInnerHTML={{ __html: previewSvg }}
                  />
                ) : (
                  <div className="text-center space-y-2 text-text-secondary">
                    <div className="text-3xl">⏳</div>
                    <div className="text-sm">Adjust settings to generate preview</div>
                  </div>
                )}
                </div>
              </div>
            </div>
            
            {/* File Info */}
            <div className="p-4 bg-bg-tertiary rounded-lg space-y-2">
              <div className="font-medium truncate">{imageFile.name}</div>
              <div className="text-sm text-text-secondary">
                Size: {(imageFile.size / 1024).toFixed(1)} KB
              </div>
              <button
                onClick={() => {
                  setImageFile(null);
                  setPreviewUrl(null);
                  setError(null);
                  setAnalysisResult(null);
                }}
                className="w-full mt-2 px-3 py-2 text-sm bg-bg-secondary hover:bg-border rounded transition-colors"
              >
                ← Change Image
              </button>
            </div>

            {/* Live Preview Stats */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg space-y-2">
              <div className="font-medium text-blue-400 flex items-center gap-2">
                <Eye size={16} strokeWidth={1.5} />
                <span>{previewStats ? 'Preview Stats' : 'Estimated Output'}</span>
              </div>
              <div className="text-sm space-y-1.5">
                {previewStats ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Paths:</span>
                      <span className="font-mono text-green-400">{previewStats.paths}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">File Size:</span>
                      <span className="font-mono text-green-400">{previewStats.size}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Mode:</span>
                      <span className="font-mono capitalize">{config.mode}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Colors:</span>
                      <span className="font-mono">~{estimatedComplexity.colors}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Layers:</span>
                      <span className="font-mono">~{estimatedComplexity.layers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Quality:</span>
                      <span className="font-mono">{estimatedComplexity.quality}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Mode:</span>
                      <span className="font-mono capitalize">{config.mode}</span>
                    </div>
                  </>
                )}
              </div>
              <div className="pt-2 border-t border-blue-500/20 text-xs text-blue-300">
                {previewLoading ? '⏳ Generating preview...' : previewStats ? '✅ Live preview ready' : '💡 Adjust settings to see preview'}
              </div>
            </div>
          </div>

          {/* Right Column: Settings */}
          <div className="space-y-4">
          {/* Presets */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Preset</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handlePresetChange('logo')}
                className={`px-3 py-2 rounded transition-colors ${
                  selectedPreset === 'logo' 
                    ? 'bg-accent-primary text-white' 
                    : 'bg-bg-secondary hover:bg-bg-tertiary'
                }`}
              >
                <div className="font-medium">Logo</div>
                <div className="text-xs opacity-80">Simple, clean</div>
              </button>
              <button
                onClick={() => handlePresetChange('photo')}
                className={`px-3 py-2 rounded transition-colors ${
                  selectedPreset === 'photo' 
                    ? 'bg-accent-primary text-white' 
                    : 'bg-bg-secondary hover:bg-bg-tertiary'
                }`}
              >
                <div className="font-medium">Photo</div>
                <div className="text-xs opacity-80">Detailed, rich</div>
              </button>
              <button
                onClick={() => handlePresetChange('detailed')}
                className={`px-3 py-2 rounded transition-colors ${
                  selectedPreset === 'detailed' 
                    ? 'bg-accent-primary text-white' 
                    : 'bg-bg-secondary hover:bg-bg-tertiary'
                }`}
              >
                <div className="font-medium">Detailed</div>
                <div className="text-xs opacity-80">High precision</div>
              </button>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Advanced Settings</label>
              <button
                onClick={() => setSelectedPreset('custom')}
                className="text-xs text-accent-primary hover:underline"
              >
                Customize
              </button>
            </div>

            {/* Mode */}
            <div className="space-y-1.5">
              <label className="text-xs text-text-secondary">Mode</label>
              <select
                value={config.mode}
                onChange={(e) => {
                  setSelectedPreset('custom');
                  setConfig({ ...config, mode: e.target.value as 'polygon' | 'spline' | 'pixel' });
                }}
                className="w-full px-3 py-2 bg-bg-secondary rounded border border-border focus:border-accent-primary focus:outline-none"
              >
                <option value="spline">Spline (Smooth curves)</option>
                <option value="polygon">Polygon (Sharp edges)</option>
                <option value="pixel">Pixel (Pixelated)</option>
              </select>
            </div>

            {/* Color Precision */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline">
                <label className="text-xs text-text-secondary">Color Precision</label>
                <span className="text-xs font-mono">{config.colorPrecision}</span>
              </div>
              <input
                type="range"
                min="1"
                max="6"
                value={config.colorPrecision}
                onChange={(e) => {
                  setSelectedPreset('custom');
                  setConfig({ ...config, colorPrecision: parseInt(e.target.value) });
                }}
                className="w-full"
              />
              <div className="text-[10px] text-text-secondary flex justify-between">
                <span>More colors</span>
                <span>Fewer (stable)</span>
              </div>
            </div>

            {/* Layer Difference */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline">
                <label className="text-xs text-text-secondary">Layer Difference</label>
                <span className="text-xs font-mono">{config.layerDifference}</span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={config.layerDifference}
                onChange={(e) => {
                  setSelectedPreset('custom');
                  setConfig({ ...config, layerDifference: parseInt(e.target.value) });
                }}
                className="w-full"
              />
              <div className="text-[10px] text-text-secondary flex justify-between">
                <span>More layers</span>
                <span>Fewer layers</span>
              </div>
            </div>

            {/* Filter Speckle */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline">
                <label className="text-xs text-text-secondary">Noise Reduction</label>
                <span className="text-xs font-mono">{config.filterSpeckle}</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={config.filterSpeckle}
                onChange={(e) => {
                  setSelectedPreset('custom');
                  setConfig({ ...config, filterSpeckle: parseInt(e.target.value) });
                }}
                className="w-full"
              />
              <div className="text-[10px] text-text-secondary flex justify-between">
                <span>Keep details</span>
                <span>Remove noise</span>
              </div>
            </div>

            {/* Advanced Settings Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full py-2 text-sm text-accent-primary hover:text-accent-secondary transition-colors flex items-center justify-between"
            >
              <span>Advanced Settings</span>
              <span className={`transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {/* Advanced Settings - Collapsible */}
            <div className={`overflow-hidden transition-all duration-300 ${
              showAdvanced ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
            }`}>
              <div className="space-y-3 pt-2 border-t border-border">
                {/* Corner Threshold */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-baseline">
                    <label className="text-xs text-text-secondary">Corner Smoothness</label>
                    <span className="text-xs font-mono">{config.cornerThreshold}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="180"
                    value={config.cornerThreshold}
                    onChange={(e) => {
                      setSelectedPreset('custom');
                      setConfig({ ...config, cornerThreshold: parseInt(e.target.value) });
                    }}
                    className="w-full"
                  />
                  <div className="text-[10px] text-text-secondary flex justify-between">
                    <span>Sharp corners</span>
                    <span>Smooth corners</span>
                  </div>
                </div>

                {/* Length Threshold */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-baseline">
                    <label className="text-xs text-text-secondary">Minimum Path Length</label>
                    <span className="text-xs font-mono">{config.lengthThreshold}px</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={config.lengthThreshold}
                    onChange={(e) => {
                      setSelectedPreset('custom');
                      setConfig({ ...config, lengthThreshold: parseInt(e.target.value) });
                    }}
                    className="w-full"
                  />
                  <div className="text-[10px] text-text-secondary flex justify-between">
                    <span>More detail</span>
                    <span>Simpler paths</span>
                  </div>
                </div>

                {/* Splice Threshold */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-baseline">
                    <label className="text-xs text-text-secondary">Path Join Angle</label>
                    <span className="text-xs font-mono">{config.spliceThreshold}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="180"
                    value={config.spliceThreshold}
                    onChange={(e) => {
                      setSelectedPreset('custom');
                      setConfig({ ...config, spliceThreshold: parseInt(e.target.value) });
                    }}
                    className="w-full"
                  />
                  <div className="text-[10px] text-text-secondary flex justify-between">
                    <span>More joins</span>
                    <span>Fewer joins</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Convert Button */}
          <button
            onClick={() => convertImage(imageFile, config)}
            disabled={converting}
            className="w-full py-3 bg-accent-primary hover:bg-accent-secondary disabled:bg-bg-tertiary disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {converting ? '🔄 Converting...' : '✨ Convert to SVG'}
          </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Success Analysis */}
      {analysisResult && (
        <div className="p-4 bg-green-500/10 border border-green-500/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">✅</span>
            <span className="font-semibold text-green-400">Conversion Complete!</span>
          </div>
          <div className="space-y-1 text-sm text-text-secondary">
            <div>📊 Generated <span className="font-bold text-white">{analysisResult.points.toLocaleString()}</span> points</div>
            <div>💾 Estimated size: <span className="font-bold text-white">{analysisResult.size}</span></div>
            <div className="mt-3 pt-3 border-t border-green-500/30 text-green-400">
              💡 Tip: Press <kbd className="px-2 py-0.5 bg-bg-tertiary rounded border border-border">X</kbd> to see complexity heatmap
            </div>
          </div>
          <button
            onClick={() => {
              setImageFile(null);
              setPreviewUrl(null);
              setError(null);
              setAnalysisResult(null);
            }}
            className="w-full mt-3 py-2 bg-bg-secondary hover:bg-bg-tertiary rounded transition-colors text-sm"
          >
            Convert Another Image
          </button>
        </div>
      )}

      {/* Instructions */}
      {!imageFile && !analysisResult && (
        <div className="text-xs text-text-secondary space-y-1">
          <div className="font-medium mb-2">What happens next?</div>
          <div>1. VTracer converts your image to vector paths</div>
          <div>2. Optimization Score shows how bloated it is</div>
          <div className="flex items-center gap-2">3. Use Smart Heal (<Activity size={14} strokeWidth={1.5} className="inline" />) to remove unnecessary points</div>
          <div>4. Export your optimized SVG</div>
        </div>
      )}
    </div>
  );
};
