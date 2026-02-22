/**
 * Single source of truth for responsive breakpoints.
 * All components that need device-tier logic import from here.
 */

export const BREAKPOINTS = {
  /** Below this width: mobile tier — triage-only, bottom drawer */
  mobile: 768,
  /** Below this AND above mobile: tablet tier — full editing, touch toolbar */
  tablet: 1024,
} as const;

export type DeviceTier = 'desktop' | 'tablet' | 'mobile';

export function getDeviceTier(width: number): DeviceTier {
  if (width < BREAKPOINTS.mobile) return 'mobile';
  if (width < BREAKPOINTS.tablet) return 'tablet';
  return 'desktop';
}
