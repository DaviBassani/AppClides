import React from 'react';
import { COLORS } from '../../constants';

interface GridProps {
  size: number;
  show: boolean;
  axisWidth: number;
  visualScale: number;
}

const Grid: React.FC<GridProps> = React.memo(({ size, show, axisWidth, visualScale }) => {
  // Dynamic stroke widths to maintain hairline appearance during zoom
  const smallGridStroke = 0.5 * visualScale;
  const largeGridStroke = 1.0 * visualScale;
  
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
          {/* Infinite Grid Background */}
          <rect x={-50000} y={-50000} width={100000} height={100000} fill="url(#grid)" opacity={0.6} pointerEvents="none" />
          
          {/* Axes */}
          <line x1={-50000} x2={50000} y1={0} y2={0} stroke="#94a3b8" strokeWidth={axisWidth} />
          <line x1={0} x2={0} y1={-50000} y2={50000} stroke="#94a3b8" strokeWidth={axisWidth} />
        </>
      )}
    </>
  );
});

export default Grid;