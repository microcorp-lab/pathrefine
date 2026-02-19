import React, { useState, useRef, useEffect, useContext } from 'react';
import { ChevronDown } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { ProFeaturesContext } from '../../context/ProFeaturesContext';

interface DropdownItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  isPro?: boolean;
  disabled?: boolean;
  onRestrictedClick?: () => void;
}

interface DropdownProps {
  label: string;
  icon?: React.ReactNode;
  items: DropdownItem[];
  variant?: 'primary' | 'secondary';
}

export const Dropdown: React.FC<DropdownProps> = ({ label, icon, items, variant = 'primary' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const proFeatures = useContext(ProFeaturesContext);
  if (!proFeatures) throw new Error('ProFeaturesContext not found');
  const { useAuthStore } = proFeatures.hooks;
  const isPro = useAuthStore((state) => state.isPro);
  const toggleUpgradeModal = useEditorStore((state) => state.toggleUpgradeModal);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const buttonClasses = variant === 'primary'
    ? 'bg-accent-primary hover:bg-indigo-600'
    : 'bg-bg-tertiary hover:bg-border';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`px-2 sm:px-4 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 sm:gap-2 ${buttonClasses}`}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-bg-secondary border border-border rounded-lg shadow-xl py-1 min-w-[200px] z-50">
          {items.map((item, index) => (
            <button
              key={index}
              onClick={() => {
                if (item.disabled) return;
                
                if (item.isPro && !isPro) {
                  if (item.onRestrictedClick) {
                    item.onRestrictedClick();
                  } else {
                    toggleUpgradeModal();
                  }
                  setIsOpen(false);
                  return;
                }

                item.onClick();
                setIsOpen(false);
              }}
              disabled={item.disabled}
              className="w-full px-4 py-2 text-left text-sm hover:bg-border transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed relative"
            >
              {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
              <span className="flex-1">{item.label}</span>
              {item.isPro && (
                <span className="px-1.5 py-0.5 text-[8px] leading-none font-bold bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded">
                  PRO
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
