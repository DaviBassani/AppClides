import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Menu, X } from 'lucide-react';

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
 * Floating morphing menu, top-left corner. The hamburger button itself expands
 * into the item list (one animated container, no nested dropdown) and collapses
 * back on the next click, outside click, or Escape. Items are declarative so
 * new entries can be added without touching the component.
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
      {/* Single morphing container: closed = square chip, open = full item stack */}
      <div
        className={clsx(
          "flex flex-col rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md shadow-lg overflow-hidden transition-all duration-300 ease-out",
          isOpen ? "w-56 shadow-xl" : "w-[46px] h-[46px]"
        )}
      >
        <button
          onClick={() => setIsOpen(current => !current)}
          aria-expanded={isOpen}
          aria-label="Menu"
          data-menu-toggle
          className={clsx(
            "flex items-center transition-all duration-300 active:scale-95 shrink-0",
            isOpen
              ? "justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/90 text-slate-500 hover:text-slate-700 w-full"
              : "justify-center w-[46px] h-[46px] text-slate-600 hover:bg-slate-50 border-transparent"
          )}
        >
          {/* Icon morphs: hamburger lines when closed, X when open — no inner box */}
          {isOpen ? <X size={16} /> : <Menu size={18} />}
        </button>

        {/* Items grow out of the same container; collapsed hides completely */}
        <div
          className={clsx(
            "flex flex-col transition-all duration-300 ease-out",
            isOpen ? "max-h-64 opacity-100" : "max-h-0 opacity-0 invisible pointer-events-none"
          )}
          aria-hidden={!isOpen}
          role={isOpen ? 'menu' : undefined}
          data-menu-items
        >
          {items.map((item, index) => {
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
                style={{
                  transitionDelay: isOpen ? `${index * 40}ms` : '0ms'
                }}
                className={clsx(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-left transition-all duration-200",
                  enabled
                    ? "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    : "text-slate-300 cursor-not-allowed",
                  isOpen ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                )}
              >
                {item.icon({ size: 16 })}
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HamburgerMenu;