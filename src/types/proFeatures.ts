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
  onOpenAuth: () => void;
  featureName: string;
  description: string;
  previewContent: React.ReactNode;
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
export type OrganicSmoothPathFn = (
  path: Path,
  smoothness: number,
  preserveCorners: boolean,
  cornerAngleThreshold: number
) => Path;

export type AutoRefinePathFn = (
  path: Path,
  targetQuality: number
) => { path: Path; originalPoints: number; newPoints: number };

// PRO Features Context Type
export interface ProFeaturesContextType {
  components: {
    ProFeatureModal: React.FC<ProFeatureModalProps>;
    AuthModal: React.FC<AuthModalProps>;
    UpgradeModal: React.FC<UpgradeModalProps>;
    WelcomeProModal: React.FC<WelcomeProModalProps>;
    ExportModal: React.FC<ExportModalProps>;
    ImageExportModal: React.FC<ImageExportModalProps>;
    UserMenu: React.FC<UserMenuProps>;
  };
  hooks: {
    useAuthStore: () => AuthStore;
  };
  engine: {
    organicSmoothPath: OrganicSmoothPathFn;
    autoRefinePath: AutoRefinePathFn;
  };
}
