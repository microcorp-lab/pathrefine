// Stub component - PRO feature not available in open source version
import { ReactNode } from 'react';

interface RestrictedFeatureProps {
  children: ReactNode;
  featureId: string;
  name: string;
  description: string;
  mode: string;
  onRestrictedClick: () => void;
}

export const RestrictedFeature = ({ children }: RestrictedFeatureProps) => <>{children}</>;
