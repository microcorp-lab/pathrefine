import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary.tsx'
import { ProFeaturesContext } from './context/ProFeaturesContext'

// Import stub components (these return null in open source version)
import { ProFeatureModal } from './components/ProFeatureModal/ProFeatureModal'
import { AuthModal } from './components/AuthModal/AuthModal'
import { UpgradeModal } from './components/UpgradeModal'
import { WelcomeProModal } from './components/WelcomeProModal/WelcomeProModal'
import { ExportModal } from './components/ExportModal/ExportModal'
import { ImageExportModal } from './components/ImageExportModal'
import { UserMenu } from './components/UserMenu'
import { AutoColorizeModal } from './components/AutoColorizeModal/AutoColorizeModal'
import { AutoRefineModal } from './components/AutoRefineModal/AutoRefineModal'
import { useAuthStore } from './store/authStore'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ProFeaturesContext.Provider value={{
          isProVersion: false, // This is the open source build
          components: {
            ProFeatureModal,
            AuthModal,
            UpgradeModal,
            WelcomeProModal,
            ExportModal,
            ImageExportModal,
            UserMenu,
            AutoColorizeModal,
            AutoRefineModal,
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
