import { createContext } from 'react';
import type { ProFeaturesContextType } from '../types/proFeatures';

/**
 * ProFeaturesContext - Shared context for PRO features
 * 
 * This context is defined in the public repo (core/) and used by all components.
 * Different implementations provide different values:
 * - Public repo (core/src/main.tsx): Provides stub components and null auth
 * - Private repo (src/main.tsx): Provides real PRO components and auth
 * 
 * Components import this context and use it transparently in both repos.
 */
export const ProFeaturesContext = createContext<ProFeaturesContextType | null>(null);
