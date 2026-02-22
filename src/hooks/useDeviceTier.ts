import { useState, useEffect } from 'react';
import { getDeviceTier, type DeviceTier } from '../utils/breakpoints';

/**
 * Returns the current device tier ('desktop' | 'tablet' | 'mobile')
 * and re-renders on window resize (debounced to 100ms).
 *
 * Use this instead of scattered `window.innerWidth < 768` checks.
 */
export function useDeviceTier(): DeviceTier {
  const [tier, setTier] = useState<DeviceTier>(() =>
    getDeviceTier(window.innerWidth)
  );

  useEffect(() => {
    let rafId: ReturnType<typeof setTimeout>;

    const handleResize = () => {
      clearTimeout(rafId);
      rafId = setTimeout(() => {
        setTier(getDeviceTier(window.innerWidth));
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(rafId);
    };
  }, []);

  return tier;
}
