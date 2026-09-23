import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, Download, FileUp, Image } from 'lucide-react';

export interface MenuItem {
  id: string;
  label: string;
  icon: (props?: { size?: number }) => React.ReactNode;
  /** Shown but disabled when the guard returns false. */
  enabled?: () => boolean;
  action: () => void;
}

interface HamburgerMenuProps {
  items: MenuItem[];
  lang: string;
}

/**
 * Floating hamburger menu, top-left corner. Items are declarative so new
 * entries can be added without touching the component.
 */
const HamburgerMenu: React.FC<HamburgerMenuProps> = ({ items, lang }) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="absolute top-4 left-4 z-20" data-hamburger-menu>
      <button
        onClick={() => setIsOpen(current => !current)}
        aria-expanded={isOpen}
        aria-label="Menu"
        className={clsx(
          "flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md shadow-lg px-2.5 py-2.5 text-slate-600 transition-all active:scale-95 hover:bg-slate-50",
          isOpen && "bg-slate-50"
        )}
      >
        {/* Hamburger icon inside a small rounded square */}
        <span className={clsx(
          "flex items-center justify-center w-6 h-6 rounded-lg border transition-colors",
          isOpen ? "border-blue-200 bg-blue-50 text-blue-600" : "border-slate-200 bg-white text-slate-600"
        )}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 3.5H12M2 7H12M2 10.5H12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <ChevronDown
          size={13}
          className={clsx("text-slate-400 transition-transform duration-200", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md shadow-xl overflow-hidden"
          role="menu"
          data-menu-items
        >
          {items.map(item => {
            const enabled = item.enabled ? item.enabled() : true;
            return (
              <button
                key={item.id}
                role="menuitem"
                disabled={!enabled}
                onClick={() => {
                  setIsOpen(false);
                  item.action();
                }}
                className={clsx(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-left transition-colors",
                  enabled
                    ? "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    : "text-slate-300 cursor-not-allowed"
                )}
              >
                {item.icon({ size: 16 })}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HamburgerMenu;