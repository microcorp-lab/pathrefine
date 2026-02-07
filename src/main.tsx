import React, { createContext } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary.tsx'
import type { ProFeaturesContextType, OrganicSmoothPathFn, AutoRefinePathFn } from './types/proFeatures'

// Import stub components (these return null in open source version)
import { ProFeatureModal } from './components/ProFeatureModal/ProFeatureModal'
import { AuthModal } from './components/AuthModal/AuthModal'
import { UpgradeModal } from './components/UpgradeModal'
import { WelcomeProModal } from './components/WelcomeProModal/WelcomeProModal'
import { ExportModal } from './components/ExportModal/ExportModal'
import { ImageExportModal } from './components/ImageExportModal'
import { UserMenu } from './components/UserMenu'
import { useAuthStore } from './store/authStore'

// Stub PRO engine functions (return input unchanged in open source version)
const organicSmoothPathStub: OrganicSmoothPathFn = (path) => {
  console.warn('organicSmoothPath is a PRO feature');
  return path;
};

const autoRefinePathStub: AutoRefinePathFn = (path) => {
  console.warn('autoRefinePath is a PRO feature');
  const pointCount = path.commands.length;
  return { path, originalPoints: pointCount, newPoints: pointCount };
};

// Create ProFeatures context with stub implementations
export const ProFeaturesContext = createContext<ProFeaturesContextType>({
  components: {
    ProFeatureModal,
    AuthModal,
    UpgradeModal,
    WelcomeProModal,
    ExportModal,
    ImageExportModal,
    UserMenu,
  },
  hooks: {
    useAuthStore,
  },
  engine: {
    organicSmoothPath: organicSmoothPathStub,
    autoRefinePath: autoRefinePathStub,
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ProFeaturesContext.Provider value={{
          components: {
            ProFeatureModal,
            AuthModal,
            UpgradeModal,
            WelcomeProModal,
            ExportModal,
            ImageExportModal,
            UserMenu,
          },
          hooks: {
            useAuthStore,
          },
          engine: {
            organicSmoothPath: organicSmoothPathStub,
            autoRefinePath: autoRefinePathStub,
          },
        }}>
          <App />
        </ProFeaturesContext.Provider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
