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
 * Floating morphing menu, top-left corner. The square chip stays anchored in
 * place while the panel expands *from behind it*; the toggle icon never moves.
 * Items fade in place (no slide-from-above), so nothing reads as falling.
 * Closes on toggle, outside click, or Escape. Items are declarative.
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
      {/* Anchored toggle: never moves. The panel expands from behind it. */}
      <button
        onClick={() => setIsOpen(current => !current)}
        aria-expanded={isOpen}
        aria-label="Menu"
        data-menu-toggle
        className="relative z-10 flex items-center justify-center w-[46px] h-[46px] rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md shadow-lg text-slate-600 hover:bg-slate-50 transition-colors active:scale-95"
      >
        {/* Icon crossfades in place: Menu when closed, X when open */}
        <span className="relative flex items-center justify-center w-[18px] h-[18px]">
          <Menu
            size={18}
            className={clsx(
              "absolute transition-all duration-200",
              isOpen ? "opacity-0 rotate-90" : "opacity-100 rotate-0"
            )}
          />
          <X
            size={18}
            className={clsx(
              "absolute transition-all duration-200",
              isOpen ? "opacity-100 rotate-0" : "opacity-0 -rotate-90"
            )}
          />
        </span>
      </button>

      {/* Panel expands rightward from the chip's left edge; items fade in place */}
      <div
        className={clsx(
          "absolute top-0 left-0 w-56 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md shadow-xl transition-all duration-300 ease-out origin-top-left",
          isOpen ? "opacity-100 scale-x-100 scale-y-100" : "opacity-0 scale-x-[0.205] scale-y-[0.826] pointer-events-none invisible"
        )}
        aria-hidden={!isOpen}
        data-menu-panel
      >
        <div className="h-[46px]" aria-hidden="true" />
        <div
          className={clsx(
            "flex flex-col pb-1.5 transition-opacity duration-200",
            isOpen ? "opacity-100" : "opacity-0"
          )}
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
                style={{ transitionDelay: isOpen ? `${120 + index * 40}ms` : '0ms' }}
                className={clsx(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-left transition-all duration-200",
                  enabled
                    ? "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    : "text-slate-300 cursor-not-allowed",
                  isOpen ? "opacity-100" : "opacity-0"
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