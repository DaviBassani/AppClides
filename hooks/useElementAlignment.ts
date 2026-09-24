import { useEffect, useState } from 'react';

/**
 * Measures the top offset of an element relative to `layerSelector` on desktop
 * widths. Returns null on mobile (caller falls back to its own layout) or
 * while the anchor is absent. Re-measures on element resize and window resize.
 *
 * Used to keep floating UI (ShareBar) aligned with the toolbar row without
 * guessing fixed offsets per breakpoint.
 */
export const useElementAlignment = (
  anchorSelector: string,
  layerSelector: string,
  { desktopOnly = true, minWidth = 768 }: { desktopOnly?: boolean; minWidth?: number } = {}
): number | null => {
  const [topOffset, setTopOffset] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      if (desktopOnly && !window.matchMedia(`(min-width: ${minWidth}px)`).matches) {
        setTopOffset(null);
        return;
      }
      const anchor = document.querySelector(anchorSelector);
      if (!anchor) return;
      const anchorRect = anchor.getBoundingClientRect();
      const layer = document.querySelector(layerSelector);
      const layerRect = layer?.getBoundingClientRect();
      setTopOffset(layerRect ? anchorRect.top - layerRect.top : anchorRect.top);
    };

    update();
    const anchor = document.querySelector(anchorSelector);
    const resizeObserver = new ResizeObserver(update);
    if (anchor) resizeObserver.observe(anchor);
    window.addEventListener('resize', update);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [anchorSelector, layerSelector, desktopOnly, minWidth]);

  return topOffset;
};