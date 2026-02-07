import React, { useState, useEffect } from 'react';
import { Smartphone, X } from 'lucide-react';

export const MobileNotice: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if user previously dismissed
    const wasDismissed = localStorage.getItem('mobileNoticeDismissed') === 'true';
    setDismissed(wasDismissed);

    // Detect mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('mobileNoticeDismissed', 'true');
  };

  if (!isMobile || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md bg-gradient-to-r from-amber-500/90 to-orange-500/90 backdrop-blur-sm text-white p-4 rounded-lg shadow-2xl z-50 border border-amber-300/30">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-white/80 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        <X size={18} />
      </button>
      
      <div className="flex gap-3 items-start pr-6">
        <div className="flex-shrink-0 mt-0.5">
          <Smartphone size={20} strokeWidth={2} />
        </div>
        <div className="space-y-1">
          <div className="font-semibold text-sm">Mobile Detected</div>
          <div className="text-xs leading-relaxed opacity-95">
            PathRefine works on mobile, but editing SVG paths with precision is best on desktop with a mouse and keyboard shortcuts.
          </div>
          <button
            onClick={handleDismiss}
            className="text-xs underline hover:no-underline mt-2 font-medium"
          >
            Got it, continue anyway
          </button>
        </div>
      </div>
    </div>
  );
};
