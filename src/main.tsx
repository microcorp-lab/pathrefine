import React, { createContext } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary.tsx'
import type { ProFeaturesContextType } from './types/proFeatures'

// Import stub components (these return null in open source version)
import { ProFeatureModal } from './components/ProFeatureModal/ProFeatureModal'
import { AuthModal } from './components/AuthModal/AuthModal'
import { UpgradeModal } from './components/UpgradeModal'
import { WelcomeProModal } from './components/WelcomeProModal/WelcomeProModal'
import { ExportModal } from './components/ExportModal/ExportModal'
import { ImageExportModal } from './components/ImageExportModal'
import { UserMenu } from './components/UserMenu'
import { useAuthStore } from './store/authStore'

// Create ProFeatures context (PRO engine functions are undefined in open source version)
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
    // PRO features are undefined in open source version
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
            // PRO features are undefined in open source version
          },
        }}>
          <App />
        </ProFeaturesContext.Provider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
