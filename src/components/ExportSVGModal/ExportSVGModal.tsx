import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { AutoColorizePanel, type ColorMapping } from '../AutoColorizePanel';
import { extractUniqueColors, generateDefaultVariables, applyColorMappings } from '../../engine/colorMapping';
import { exportSVG } from '../../engine/parser';
import { applySvgo, formatBytes, svgByteSize } from '../../engine/svgoOptimize';
import { Modal } from '../Modal/Modal';

interface ExportSVGModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportSVGModal: React.FC<ExportSVGModalProps> = ({ isOpen, onClose }) => {
  const svgDocument = useEditorStore(state => state.svgDocument);
  const selectedPathIds = useEditorStore(state => state.selectedPathIds);
  
  // Initialize state lazily when modal opens - use isOpen as reset trigger
  const [step, setStep] = useState<1 | 2>(1);
  const [filename, setFilename] = useState('icon');
  const [useAutoColorize, setUseAutoColorize] = useState(false);
  const [useAdvancedOptimization, setUseAdvancedOptimization] = useState(true);

  // Pre-computed SVG strings for Step 2 — computed once on entry, reused on download
  const [step2Svgs, setStep2Svgs] = useState<{ raw: string; optimized: string } | null>(null);
  
  // Color mappings state - updates when SVG changes
  const currentMappings = useMemo(() => {
    if (!svgDocument) return [];
    const colors = extractUniqueColors(svgDocument);
    return generateDefaultVariables(colors);
  }, [svgDocument]);
  
  const [colorMappings, setColorMappings] = useState<ColorMapping[]>(currentMappings);
  const [useCssVariables, setUseCssVariables] = useState(true);

  // Sync color mappings when they change (derived state)
  useEffect(() => {
    setColorMappings(currentMappings);
  }, [currentMappings]);

  // Pre-compute SVG strings whenever Step 2 is active.
  // We compute both raw and optimized so the size delta is always visible,
  // regardless of which toggle state the user is in.
  useEffect(() => {
    if (step !== 2 || !svgDocument) {
      setStep2Svgs(null);
      return;
    }
    let documentToExport = svgDocument;
    if (useAutoColorize) {
      documentToExport = applyColorMappings(svgDocument, colorMappings, useCssVariables, selectedPathIds);
    }
    const raw = exportSVG(documentToExport);
    const optimized = applySvgo(raw);
    setStep2Svgs({ raw, optimized });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, svgDocument, useAutoColorize, useCssVariables]);

  // Update variable name for a specific color
  const updateVariableName = useCallback((originalColor: string, newName: string) => {
    setColorMappings(prev => 
      prev.map(mapping => 
        mapping.originalColor === originalColor 
          ? { ...mapping, variableName: newName }
          : mapping
      )
    );
  }, []);

  const handleNext = useCallback(() => {
    setStep(2);
  }, []);

  const handleBack = useCallback(() => {
    setStep(1);
  }, []);

  // Escape in step 2 goes back to step 1 rather than closing
  const handleClose = useCallback(() => {
    if (step === 2) {
      setStep(1);
    } else {
      onClose();
    }
  }, [step, onClose]);

  const handleDownload = useCallback(() => {
    if (!svgDocument || !step2Svgs) return;

    const svgMarkup = useAdvancedOptimization ? step2Svgs.optimized : step2Svgs.raw;

    // Create download
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onClose();
  }, [svgDocument, step2Svgs, useAdvancedOptimization, filename, onClose]);

  return (
    <Modal
      isOpen={isOpen && !!svgDocument}
      onClose={handleClose}
      title="Export to SVG"
      size="lg"
      footer={
        <div className="flex gap-2 justify-between">
          <button
            onClick={step === 2 ? handleBack : onClose}
            className="px-4 py-2 bg-bg-tertiary hover:bg-border rounded transition-colors"
          >
            {step === 2 ? '← Back' : 'Cancel'}
          </button>
          <button
            onClick={step === 1 ? handleNext : handleDownload}
            className="px-4 py-2 bg-accent-primary hover:bg-indigo-600 rounded transition-colors"
          >
            {step === 1 ? 'Next →' : '💾 Download SVG'}
          </button>
        </div>
      }
    >
      {/* Step indicator */}
      <p className="text-sm text-text-secondary mb-5">
        Step {step} of 2: {step === 1 ? 'Color Settings (Optional)' : 'Download'}
      </p>

      {step === 1 ? (
        <div className="space-y-6">
          {/* Enable Auto-Colorize Checkbox */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="use-auto-colorize"
              checked={useAutoColorize}
              onChange={(e) => setUseAutoColorize(e.target.checked)}
              className="mt-1 w-4 h-4"
            />
            <div>
              <label htmlFor="use-auto-colorize" className="font-medium cursor-pointer">
                Use CSS Variables for Colors
              </label>
              <p className="text-sm text-text-secondary mt-1">
                Replace hardcoded colors with CSS variables for dynamic theming
              </p>
            </div>
          </div>

          {/* Auto-Colorize Panel (when enabled) */}
          {useAutoColorize && (
            <div className="pl-7">
              <AutoColorizePanel
                colorMappings={colorMappings}
                useCssVariables={useCssVariables}
                onUseCssVariablesChange={setUseCssVariables}
                onVariableNameChange={updateVariableName}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
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
              <span className="text-text-secondary">.svg</span>
            </div>
          </div>

          {/* Advanced optimization toggle */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="use-advanced-optimization"
              checked={useAdvancedOptimization}
              onChange={(e) => setUseAdvancedOptimization(e.target.checked)}
              className="mt-1 w-4 h-4"
            />
            <div>
              <label htmlFor="use-advanced-optimization" className="font-medium cursor-pointer">
                Advanced optimization
              </label>
              <p className="text-sm text-text-secondary mt-1">
                Strip IDs, remove whitespace, optimise coordinates and colours via SVGO
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-bg-tertiary rounded p-4 space-y-2 text-sm">
            <h3 className="font-medium">Export Summary</h3>
            <div className="text-text-secondary space-y-1">
              <div>• Paths: {svgDocument!.paths.length}</div>
              {useAutoColorize && (
                <div>• Color mapping: {useCssVariables ? `${colorMappings.length} CSS variables` : 'currentColor'}</div>
              )}
              {step2Svgs && (() => {
                const rawSize = svgByteSize(step2Svgs.raw);
                const optSize = svgByteSize(step2Svgs.optimized);
                const saving = Math.round((1 - optSize / rawSize) * 100);
                return useAdvancedOptimization ? (
                  <div>
                    • File size:{' '}
                    <span className="line-through text-text-secondary/50">{formatBytes(rawSize)}</span>
                    {' → '}
                    <span className="text-green-400 font-medium">{formatBytes(optSize)}</span>
                    {saving > 0 && (
                      <span className="ml-1 text-green-400">−{saving}%</span>
                    )}
                  </div>
                ) : (
                  <div>• File size: {formatBytes(rawSize)}</div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
