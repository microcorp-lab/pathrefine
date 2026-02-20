/**
 * Code-editor slice — tracks code ↔ canvas mapping state.
 *
 * Owns: codeMappings
 */
import type { PathCodeMapping } from '../../engine/codeMapping';

// ── Public interface ──────────────────────────────────────────────────────────

export interface CodeEditorSlice {
  codeMappings: Map<string, PathCodeMapping> | null;

  setCodeMappings: (mappings: Map<string, PathCodeMapping> | null) => void;
}

// ── Slice factory ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCodeEditorSlice(set: (fn: any) => void, _get: () => any): CodeEditorSlice {
  return {
    codeMappings: null,

    setCodeMappings: (mappings) => set(() => ({ codeMappings: mappings })),
  };
}
