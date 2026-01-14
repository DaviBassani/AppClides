import React, { useRef } from 'react';
import { ToolType, Point, GeometricShape } from '../types';
import clsx from 'clsx';
import { useCanvasInteraction } from '../hooks/useCanvasInteraction';
import Grid from './canvas/Grid';
import { ShapeRenderer, GhostShapeRenderer } from './canvas/ShapeRenderer';
import PointRenderer from './canvas/PointRenderer';

interface CanvasProps {
  tool: ToolType;
  points: Record<string, Point>;
  shapes: GeometricShape[];
  setPoints: React.Dispatch<React.SetStateAction<Record<string, Point>>>;
  setShapes: React.Dispatch<React.SetStateAction<GeometricShape[]>>;
  view: { x: number; y: number; k: number };
  setView: React.Dispatch<React.SetStateAction<{ x: number; y: number; k: number }>>;
  showGrid: boolean;
  snapToGrid: boolean;
}

const Canvas: React.FC<CanvasProps> = ({ 
  tool, 
  points, 
  shapes, 
  setPoints, 
  setShapes,
  view,
  setView,
  showGrid,
  snapToGrid
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const {
    handleMouseDown, handleMouseMove, handleMouseUp,
    handleTouchStart, handleTouchMove, handleTouchEnd,
    handleWheel,
    cursor, draftStartId, draggingId, hoveredId, hoveredIntersection, isPanning
  } = useCanvasInteraction({
    tool, points, shapes, setPoints, setShapes, view, setView, snapToGrid, containerRef
  });

  // Effective visual sizes
  const visualScale = 1 / view.k;
  const strokeWidth = 2 * visualScale;
  const pointRadius = 4 * visualScale;
  const pointHoverRadius = 8 * visualScale;
  const axisWidth = 1.5 * visualScale;
  const intersectionRadius = 3 * visualScale;

  return (
    <div 
      ref={containerRef}
      className={clsx(
        "relative w-full h-full overflow-hidden touch-none select-none",
        isPanning ? "cursor-grabbing" : (tool === ToolType.SELECT ? "cursor-default" : "cursor-crosshair")
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <svg className="w-full h-full pointer-events-none">
        
        <g transform={`translate(${view.x}, ${view.y}) scale(${view.k})`}>
            {/* Grid must be inside the transform to move/scale with the world */}
            <Grid size={20} show={showGrid} axisWidth={axisWidth} visualScale={visualScale} />

            {/* Render Existing Shapes */}
            {shapes.map(shape => {
                const p1 = points[shape.p1];
                const p2 = points[shape.p2];
                if (!p1 || !p2) return null;
                return <ShapeRenderer key={shape.id} shape={shape} p1={p1} p2={p2} strokeWidth={strokeWidth} />;
            })}
            
            {/* Render Ghost Shape (Drafting) */}
            {draftStartId && points[draftStartId] && (
                <GhostShapeRenderer 
                    type={tool.toLowerCase() as any}
                    p1={points[draftStartId]}
                    cursor={cursor}
                    strokeWidth={strokeWidth}
                    visualScale={visualScale}
                />
            )}

            {/* Render Snap Intersection Marker */}
            {hoveredIntersection && (
               <circle 
                  cx={hoveredIntersection.x} 
                  cy={hoveredIntersection.y} 
                  r={intersectionRadius} 
                  fill="#64748b"
                  opacity={0.7}
                  className="pointer-events-none"
               />
            )}

            {/* Render Points */}
            {Object.values(points).map(p => (
                <PointRenderer
                    key={p.id}
                    point={p}
                    radius={pointRadius}
                    hoverRadius={pointHoverRadius}
                    isActive={hoveredId === p.id || draftStartId === p.id || draggingId === p.id}
                    isDraftStart={draftStartId === p.id}
                    strokeWidth={strokeWidth}
                    visualScale={visualScale}
                />
            ))}
        </g>
      </svg>

      <div className="absolute bottom-6 left-6 text-xs text-slate-400 select-none pointer-events-none z-10 hidden md:block">
         <div className="font-medium text-slate-500 mb-1">Scale: {view.k.toFixed(2)}x</div>
         {tool === ToolType.POINT && "Clique para criar pontos"}
         {tool === ToolType.SELECT && "Arraste pontos para mover, ou o fundo para navegar"}
         {tool === ToolType.SEGMENT && "Selecione dois pontos"}
         {tool === ToolType.CIRCLE && "Selecione centro e raio"}
         <div className="mt-1 opacity-50">Euclides Web v1.5</div>
      </div>
    </div>
  );
};

export default Canvas;