import React from 'react';
import type { Path } from './svg';

/**
 * Type definitions for PRO features that can be injected via Context
 * This allows the public repo to define the contract while accepting
 * either stub or real implementations
 */

// PRO Component Types
export interface ProFeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth?: () => void;
  featureName: string;
  description: string;
  previewContent?: React.ReactNode;
}

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface UpgradeModalProps {
  onOpenAuth: () => void;
}

export interface WelcomeProModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface ImageExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface UserMenuProps {
  onManageSubscription: () => void;
}

export interface AutoColorizeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface AutoRefineModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetPathId?: string;
}

// Auth Store Types
export interface AuthUser {
  id: string;
  email?: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token?: string;
}

export interface AuthStore {
  user: AuthUser | null;
  session: AuthSession | null;
  isPro: boolean;
  initialize: () => void;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

// PRO Engine Functions Types
export interface SmoothedPathWithMetrics extends Path {
  jitterReduction?: number;
}

export type OrganicSmoothPathFn = (
  path: Path,
  smoothness: number,
  preserveCorners: boolean,
  cornerAngleThreshold: number
) => SmoothedPathWithMetrics;

export type AutoRefinePathFn = (
  path: Path,
  intensity?: 'strong' | 'medium' | 'light'
) => SmoothedPathWithMetrics;

// PRO Features Context Type
export interface ProFeaturesContextType {
  isProVersion: boolean; // Flag to indicate if this build includes PRO features
  components: {
    ProFeatureModal: React.FC<ProFeatureModalProps>;
    AuthModal: React.FC<AuthModalProps>;
    UpgradeModal: React.FC<UpgradeModalProps>;
    WelcomeProModal: React.FC<WelcomeProModalProps>;
    ExportModal: React.FC<ExportModalProps>;
    ImageExportModal: React.FC<ImageExportModalProps>;
    UserMenu: React.FC<UserMenuProps>;
    AutoColorizeModal: React.FC<AutoColorizeModalProps>;
    AutoRefineModal: React.FC<AutoRefineModalProps>;
  };
  hooks: {
    useAuthStore: {
      <T>(selector: (state: AuthStore) => T): T;
      getState(): AuthStore;
    };
  };
  engine: {
    organicSmoothPath?: OrganicSmoothPathFn;
    autoRefinePath?: AutoRefinePathFn;
  };
}
