/**
 * ProFeatures slice — PRO tier status and upgrade modal.
 *
 * Owns: isPro, showUpgradeModal
 */

// ── Public interface ──────────────────────────────────────────────────────────

export interface ProFeaturesSlice {
  isPro:             boolean;
  showUpgradeModal:  boolean;

  toggleUpgradeModal: () => void;
}

// ── Slice factory ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createProFeaturesSlice(set: (fn: any) => void, _get: () => any): ProFeaturesSlice {
  return {
    isPro:            false,  // Free tier by default
    showUpgradeModal: false,

    toggleUpgradeModal: () =>
      set((state: ProFeaturesSlice) => ({ showUpgradeModal: !state.showUpgradeModal })),
  };
}
