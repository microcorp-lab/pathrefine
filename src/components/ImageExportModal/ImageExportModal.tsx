import React, { useState, useCallback, useEffect } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { exportSVG } from '../../engine/parser';
import { Download, Loader2 } from 'lucide-react';

interface ImageExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ImageFormat = 'webp' | 'png' | 'ico';

const formatLabels: Record<ImageFormat, string> = {
  webp: 'WebP (Modern web format)',
  png: 'PNG (Universal compatibility)',
  ico: 'ICO (Favicon format)'
};

const sizePresets = [
  { label: '16×16', value: 16, description: 'Small favicon' },
  { label: '32×32', value: 32, description: 'Standard favicon' },
  { label: '64×64', value: 64, description: 'High-DPI favicon' },
  { label: '128×128', value: 128, description: 'App icon' },
  { label: '256×256', value: 256, description: 'Large icon' },
  { label: '512×512', value: 512, description: 'HD icon' },
  { label: 'Custom', value: 0, description: 'Custom size' }
];

export const ImageExportModal: React.FC<ImageExportModalProps> = ({ isOpen, onClose }) => {
  const svgDocument = useEditorStore(state => state.svgDocument);
  
  const [format, setFormat] = useState<ImageFormat>('webp');
  const [size, setSize] = useState(256);
  const [customSize, setCustomSize] = useState(256);
  const [filename, setFilename] = useState('icon');
  const [isExporting, setIsExporting] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormat('webp');
      setSize(256);
      setCustomSize(256);
      setFilename('icon');
      setIsExporting(false);
    }
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  const handleExport = useCallback(async () => {
    if (!svgDocument) return;

    setIsExporting(true);
    try {
      // Get SVG markup
      const svgMarkup = exportSVG(svgDocument);
      
      // Determine actual size
      const actualSize = size === 0 ? customSize : size;
      
      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = actualSize;
      canvas.height = actualSize;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Create image from SVG
      const img = new Image();
      const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        // Draw SVG to canvas
        ctx.drawImage(img, 0, 0, actualSize, actualSize);
        URL.revokeObjectURL(url);

        // Convert to desired format
        const mimeType = format === 'webp' ? 'image/webp' : 
                        format === 'png' ? 'image/png' : 
                        'image/x-icon';
        
        canvas.toBlob((blob) => {
          if (!blob) {
            throw new Error('Failed to create image');
          }

          // Download
          const downloadUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `${filename}.${format}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(downloadUrl);

          setIsExporting(false);
          onClose();
        }, mimeType);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        throw new Error('Failed to load SVG');
      };

      img.src = url;
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export image. Please try again.');
      setIsExporting(false);
    }
  }, [svgDocument, format, size, customSize, filename, onClose]);

  if (!isOpen || !svgDocument) return null;

  const actualSize = size === 0 ? customSize : size;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-secondary rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-semibold">Export as Image</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium mb-3">Image Format</label>
            <div className="space-y-2">
              {(['webp', 'png', 'ico'] as ImageFormat[]).map(fmt => (
                <label key={fmt} className="flex items-center gap-3 p-3 bg-bg-tertiary rounded cursor-pointer hover:bg-border transition-colors">
                  <input
                    type="radio"
                    checked={format === fmt}
                    onChange={() => setFormat(fmt)}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="font-medium uppercase">{fmt}</div>
                    <div className="text-xs text-text-secondary">{formatLabels[fmt]}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Size Selection */}
          <div>
            <label className="block text-sm font-medium mb-3">Image Size</label>
            <div className="grid grid-cols-2 gap-2">
              {sizePresets.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => setSize(preset.value)}
                  className={`
                    p-3 rounded text-left transition-colors
                    ${size === preset.value 
                      ? 'bg-accent-primary text-white' 
                      : 'bg-bg-tertiary text-text-secondary hover:bg-border'
                    }
                  `}
                >
                  <div className="font-medium">{preset.label}</div>
                  <div className="text-xs opacity-75">{preset.description}</div>
                </button>
              ))}
            </div>
            
            {size === 0 && (
              <div className="mt-3">
                <label className="block text-sm mb-2">Custom Size (pixels)</label>
                <input
                  type="number"
                  min="16"
                  max="2048"
                  value={customSize}
                  onChange={(e) => setCustomSize(parseInt(e.target.value) || 256)}
                  className="w-full px-3 py-2 bg-bg-primary text-white rounded border border-border focus:outline-none focus:border-accent-primary"
                />
              </div>
            )}
          </div>

          {/* Filename */}
          <div>
            <label className="block text-sm font-medium mb-2">Filename</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="flex-1 px-3 py-2 bg-bg-primary text-white rounded border border-border focus:outline-none focus:border-accent-primary"
                placeholder="icon"
              />
              <span className="text-text-secondary">.{format}</span>
            </div>
          </div>

          {/* Preview Info */}
          <div className="bg-bg-tertiary rounded p-4 space-y-2 text-sm">
            <h3 className="font-medium">Export Preview</h3>
            <div className="text-text-secondary space-y-1">
              <div>• Format: {format.toUpperCase()}</div>
              <div>• Size: {actualSize}×{actualSize}px</div>
              <div>• Output: {filename}.{format}</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-border flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 bg-bg-tertiary hover:bg-border rounded transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-2 bg-accent-primary hover:bg-indigo-600 rounded transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download size={16} />
                Export Image
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
