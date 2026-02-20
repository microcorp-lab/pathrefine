/**
 * Test helpers for component tests.
 *
 * Provides:
 * - createTestPath / createTestDocument — minimal SVG fixture factories
 * - buildProFeaturesContext — a free-tier mock of ProFeaturesContextType
 * - renderWithProviders — RTL render wrapped with ProFeaturesContext
 * - resetEditorStore — reset Zustand store + localStorage between tests
 */
import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { ProFeaturesContext } from '../../context/ProFeaturesContext';
import { useEditorStore } from '../../store/editorStore';
import type { Path, SVGDocument } from '../../types/svg';
import type { ProFeaturesContextType } from '../../types/proFeatures';
import { useAuthStore } from '../../store/authStore';

// ── SVG test fixtures ─────────────────────────────────────────────────────────

let _pathIdCounter = 0;

/** Create a minimal valid Path for use in tests. */
export function createTestPath(overrides: Partial<Path> = {}): Path {
  _pathIdCounter += 1;
  return {
    id: `path-${_pathIdCounter}`,
    d: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
    fill: '#ff0000',
    segments: [
      { type: 'M', start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, points: [] },
      { type: 'L', start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, points: [] },
      { type: 'L', start: { x: 100, y: 0 }, end: { x: 100, y: 100 }, points: [] },
      { type: 'L', start: { x: 100, y: 100 }, end: { x: 0, y: 100 }, points: [] },
      { type: 'Z', start: { x: 0, y: 100 }, end: { x: 0, y: 0 }, points: [] },
    ],
    ...overrides,
  };
}

/** Create a minimal valid SVGDocument with one or more test paths. */
export function createTestDocument(paths?: Path[]): SVGDocument {
  return {
    width: 100,
    height: 100,
    viewBox: { x: 0, y: 0, width: 100, height: 100 },
    paths: paths ?? [createTestPath()],
    groups: [],
  };
}

// ── ProFeaturesContext mock (free tier) ───────────────────────────────────────

const NullComponent = () => null;

export function buildProFeaturesContext(): ProFeaturesContextType {
  return {
    isProVersion: false,
    components: {
      ProFeatureModal: NullComponent as any,
      AuthModal: NullComponent as any,
      UpgradeModal: NullComponent as any,
      WelcomeProModal: NullComponent as any,
      ExportModal: NullComponent as any,
      ImageExportModal: NullComponent as any,
      UserMenu: NullComponent as any,
      AutoColorizeModal: NullComponent as any,
      AutoRefineModal: NullComponent as any,
    },
    hooks: {
      useAuthStore,
    },
    engine: {
      // PRO engine functions undefined on free tier
    },
  };
}

// ── Store reset ───────────────────────────────────────────────────────────────

/**
 * Reset the Zustand editor store and localStorage to a clean empty state.
 * Call this in beforeEach for any test that mutates store state.
 */
export function resetEditorStore() {
  localStorage.clear();
  useEditorStore.setState({
    svgDocument: null,
    selectedPathIds: [],
    editingPathId: null,
    selectedPointIndex: null,
    selectedPointIndices: [],
    history: [],
    historyIndex: -1,
    snapToGrid: false,
    showHeatmap: false,
    showUpgradeModal: false,
    pathAlignmentPreview: null,
    pathAlignmentSelectionMode: 'none',
    codeMappings: null,
    alignment: null,
    hoveredPoint: null,
    activeTool: 'edit',
    zoom: 1,
    pan: { x: 0, y: 0 },
  });
}

// ── render wrapper ────────────────────────────────────────────────────────────

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  proFeatures?: ProFeaturesContextType;
}

/**
 * Render a component with all required context providers.
 * Equivalent to the setup in core/src/main.tsx.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  { proFeatures, ...renderOptions }: RenderWithProvidersOptions = {},
) {
  const contextValue = proFeatures ?? buildProFeaturesContext();

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ProFeaturesContext.Provider value={contextValue}>
        {children}
      </ProFeaturesContext.Provider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}
