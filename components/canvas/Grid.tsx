import React from 'react';
import { COLORS } from '../../constants';
import { ViewportBounds, clipLine } from '../../utils/geometry';

interface GridProps {
  size: number;
  show: boolean;
  axisWidth: number;
  visualScale: number;
  viewportBounds?: ViewportBounds;
}

// Fallback for when bounds are not available (e.g., before first measure)
const FALLBACK_BOUNDS: ViewportBounds = {
  minX: -100000,
  minY: -100000,
  maxX: 100000,
  maxY: 100000,
};

const Grid: React.FC<GridProps> = React.memo(({ size, show, axisWidth, visualScale, viewportBounds }) => {
  // Dynamic stroke widths to maintain hairline appearance during zoom
  const smallGridStroke = 0.5 * visualScale;
  const largeGridStroke = 1.0 * visualScale;
  const bounds = viewportBounds || FALLBACK_BOUNDS;

  // Axes clipped to the visible area (infinite lines)
  const xAxis = show ? clipLine({ x: bounds.minX, y: 0 }, { x: bounds.maxX, y: 0 }, bounds) : null;
  const yAxis = show ? clipLine({ x: 0, y: bounds.minY }, { x: 0, y: bounds.maxY }, bounds) : null;

  return (
    <>
      <defs>
        <pattern id="smallGrid" width={size} height={size} patternUnits="userSpaceOnUse">
          <path d={`M ${size} 0 L 0 0 0 ${size}`} fill="none" stroke={COLORS.grid} strokeWidth={smallGridStroke} />
        </pattern>
        <pattern id="grid" width={size * 5} height={size * 5} patternUnits="userSpaceOnUse">
          <rect width={size * 5} height={size * 5} fill="url(#smallGrid)" />
          <path d={`M ${size * 5} 0 L 0 0 0 ${size * 5}`} fill="none" stroke="#cbd5e1" strokeWidth={largeGridStroke} />
        </pattern>
      </defs>

      {show && (
        <>
          {/* Grid background covering exactly the visible area; the pattern tiles it seamlessly */}
          <rect
            x={bounds.minX}
            y={bounds.minY}
            width={bounds.maxX - bounds.minX}
            height={bounds.maxY - bounds.minY}
            fill="url(#grid)"
            opacity={0.6}
            pointerEvents="none"
          />

          {/* Axes */}
          {xAxis && <line x1={xAxis.x1} x2={xAxis.x2} y1={xAxis.y1} y2={xAxis.y2} stroke="#94a3b8" strokeWidth={axisWidth} />}
          {yAxis && <line x1={yAxis.x1} x2={yAxis.x2} y1={yAxis.y1} y2={yAxis.y2} stroke="#94a3b8" strokeWidth={axisWidth} />}
        </>
      )}
    </>
  );
});

export default Grid;