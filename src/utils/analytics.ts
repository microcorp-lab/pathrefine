/**
 * analytics.ts — Thin, typed wrapper around GA4 (already loaded via index.html).
 *
 * Usage:
 *   import { track } from '../../utils/analytics';
 *   track({ name: 'smart_heal_applied', reduction_pct: 71 });
 *
 * Events are silenced in development so local usage never pollutes real data.
 * Every call is try/catch'd — analytics must never crash the product.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// ─── Event catalogue ──────────────────────────────────────────────────────────

export type AnalyticsEvent =
  /** User loaded an SVG into the canvas. */
  | { name: 'svg_loaded'; source: 'demo' | 'file' | 'image_converter' }

  /** Smart Heal modal opened for a single path. */
  | { name: 'smart_heal_opened' }

  /** User applied Smart Heal to a single path. */
  | { name: 'smart_heal_applied'; reduction_pct: number }

  /** User applied Heal All across every path. */
  | { name: 'heal_all_applied'; paths_count: number; total_reduction_pct: number }

  /** User applied Smooth Path (polish or organic). */
  | { name: 'smooth_applied'; mode: 'polish' | 'organic' }

  /** Auto Refine modal opened (PRO feature). */
  | { name: 'auto_refine_opened' }

  /** Auto Colorize modal opened (PRO feature). */
  | { name: 'auto_colorize_opened' }

  /** User triggered an export. */
  | { name: 'export_triggered'; format: 'svg' | 'component' | 'image' }

  /** Upgrade modal was displayed to the user. */
  | { name: 'upgrade_modal_shown' }

  /** User clicked the "Upgrade to Pro" CTA. */
  | { name: 'upgrade_clicked' };

// ─── Core send function ───────────────────────────────────────────────────────

/**
 * Fire a typed GA4 event. No-ops in development.
 */
export function track(event: AnalyticsEvent): void {
  if (import.meta.env.DEV) return; // Keep dev noise out of GA4

  const { name, ...params } = event;
  try {
    window.gtag?.('event', name, params);
  } catch {
    // Analytics must never crash the product.
  }
}
