import React from 'react';
import { Point } from '../../types';
import { COLORS } from '../../constants';

interface PointRendererProps {
  point: Point;
  radius: number;
  hoverRadius: number;
  isActive: boolean;
  isSelected: boolean;
  isDraftStart: boolean;
  strokeWidth: number;
  visualScale: number;
}

const PointRenderer: React.FC<PointRendererProps> = React.memo(({ 
  point, 
  radius, 
  hoverRadius, 
  isActive, 
  isSelected,
  isDraftStart, 
  strokeWidth, 
  visualScale 
}) => {
  return (
    <g className="cursor-pointer transition-colors duration-200" style={{ pointerEvents: 'none' }}>
      {/* Transparent hit area for easier touch selection */}
      <circle cx={point.x} cy={point.y} r={Math.max(15, 15 * visualScale)} fill="transparent" />
      
      {isSelected && (
         <circle 
            cx={point.x} 
            cy={point.y} 
            r={hoverRadius * 1.5} 
            fill="transparent" 
            stroke={COLORS.selection} 
            strokeWidth={strokeWidth * 1.5}
            opacity={0.6}
         />
      )}

      <circle 
        cx={point.x} 
        cy={point.y} 
        r={isActive ? hoverRadius : radius} 
        fill={isDraftStart ? COLORS.accent : (point.color || COLORS.point)}
        stroke="white"
        strokeWidth={strokeWidth}
      />
      
      <text 
        x={point.x + (radius * 2)} 
        y={point.y - (radius * 2)} 
        fontSize={12 * visualScale}
        className="font-medium fill-slate-500 select-none font-sans"
        style={{ textShadow: '0 1px 2px white' }}
      >
        {point.label}
      </text>
    </g>
  );
});

export default PointRenderer;