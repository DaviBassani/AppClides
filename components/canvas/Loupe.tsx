import React from 'react';
import { Point, GeometricShape } from '../../types';
import Grid from './Grid';
import { ShapeRenderer } from './ShapeRenderer';
import PointRenderer from './PointRenderer';

interface LoupeProps {
  screenX: number;
  screenY: number;
  view: { x: number; y: number; k: number };
  points: Record<string, Point>;
  shapes: GeometricShape[];
  showGrid: boolean;
  selectedIds: string[];
}

const LOUPE_SIZE = 120;
const ZOOM_LEVEL = 2.5;
// Offset increased to 110px to ensure the loupe clears the finger/thumb visibility
const OFFSET_Y = 110;

const Loupe: React.FC<LoupeProps> = ({ 
  screenX, 
  screenY, 
  view, 
  points, 
  shapes, 
  showGrid, 
  selectedIds 
}) => {
  // 1. Calculate the World Coordinates of the finger
  const worldX = (screenX - view.x) / view.k;
  const worldY = (screenY - view.y) / view.k;

  // 2. We want to render the world such that (worldX, worldY) is at the center of the Loupe
  const loupeScale = view.k * ZOOM_LEVEL;
  
  // Translate Logic: 
  const tx = (LOUPE_SIZE / 2) - worldX * loupeScale;
  const ty = (LOUPE_SIZE / 2) - worldY * loupeScale;

  // Visual calculations for renderers (adjusting for zoom)
  const visualScale = 1 / loupeScale;
  const strokeWidth = 2 * visualScale;
  const pointRadius = 4 * visualScale;
  const pointHoverRadius = 8 * visualScale;
  const axisWidth = 1.5 * visualScale;

  return (
    <div 
      className="fixed pointer-events-none z-50 flex flex-col items-center"
      style={{
        width: LOUPE_SIZE,
        // Position the center of the loupe circle at screenY - OFFSET_Y
        left: screenX - LOUPE_SIZE / 2,
        top: screenY - OFFSET_Y - LOUPE_SIZE / 2,
      }}
    >
        {/* The Magnifying Glass Circle */}
        <div 
            className="rounded-full border-4 border-white shadow-2xl overflow-hidden bg-slate-50 relative box-content"
            style={{ width: LOUPE_SIZE, height: LOUPE_SIZE }}
        >
            <svg width="100%" height="100%" viewBox={`0 0 ${LOUPE_SIZE} ${LOUPE_SIZE}`}>
                <g transform={`translate(${tx}, ${ty}) scale(${loupeScale})`}>
                    <Grid size={20} show={showGrid} axisWidth={axisWidth} visualScale={visualScale} />

                    {shapes.map(shape => {
                        const p1 = points[shape.p1];
                        const p2 = points[shape.p2];
                        if (!p1 || !p2) return null;
                        return (
                            <ShapeRenderer 
                                key={shape.id} 
                                shape={shape} 
                                p1={p1} 
                                p2={p2} 
                                strokeWidth={strokeWidth} 
                                isSelected={selectedIds.includes(shape.id)}
                            />
                        );
                    })}
                    
                    {Object.values(points).map((p) => (
                        <PointRenderer
                            key={p.id}
                            point={p}
                            radius={pointRadius}
                            hoverRadius={pointHoverRadius}
                            isActive={false} // No interactions inside loupe
                            isSelected={selectedIds.includes(p.id)}
                            isDraftStart={false}
                            strokeWidth={strokeWidth}
                            visualScale={visualScale}
                        />
                    ))}
                </g>
                
                {/* Crosshair */}
                <line x1={LOUPE_SIZE/2 - 5} y1={LOUPE_SIZE/2} x2={LOUPE_SIZE/2 + 5} y2={LOUPE_SIZE/2} stroke="#ef4444" strokeWidth="2" />
                <line x1={LOUPE_SIZE/2} y1={LOUPE_SIZE/2 - 5} x2={LOUPE_SIZE/2} y2={LOUPE_SIZE/2 + 5} stroke="#ef4444" strokeWidth="2" />
            </svg>
        </div>

        {/* The Pointer Triangle */}
        <div 
            className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[12px] border-t-white drop-shadow-sm -mt-[2px] z-10" 
        />
    </div>
  );
};

export default Loupe;