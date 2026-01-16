import React, { useRef, useState, useEffect } from 'react';
import { ToolType, Point, GeometricShape, TextLabel } from '../types';
import clsx from 'clsx';
import { useCanvasInteraction } from '../hooks/useCanvasInteraction';
import Grid from './canvas/Grid';
import { ShapeRenderer, GhostShapeRenderer } from './canvas/ShapeRenderer';
import PointRenderer from './canvas/PointRenderer';
import TextRenderer from './canvas/TextRenderer';
import StyleMenu from './StyleMenu';
import Loupe from './canvas/Loupe';
import { Language, t } from '../utils/i18n';

interface CanvasProps {
  tool: ToolType;
  points: Record<string, Point>;
  shapes: GeometricShape[];
  texts: Record<string, TextLabel>;
  setPoints: React.Dispatch<React.SetStateAction<Record<string, Point>>>;
  setShapes: React.Dispatch<React.SetStateAction<GeometricShape[]>>;
  setTexts: React.Dispatch<React.SetStateAction<Record<string, TextLabel>>>;
  view: { x: number; y: number; k: number };
  setView: React.Dispatch<React.SetStateAction<{ x: number; y: number; k: number }>>;
  showGrid: boolean;
  snapToGrid: boolean;
  lang: Language;
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
}

const Canvas: React.FC<CanvasProps> = ({ 
  tool, 
  points, 
  shapes,
  texts, 
  setPoints, 
  setShapes,
  setTexts,
  view,
  setView,
  showGrid, 
  snapToGrid,
  lang,
  selectedIds,
  setSelectedIds
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  
  const {
    handleMouseDown, handleMouseMove, handleMouseUp,
    handleTouchStart, handleTouchMove, handleTouchEnd,
    handleWheel,
    cursor, draftStartId, draggingId, hoveredId, hoveredIntersection, isPanning,
    touchPos, 
  } = useCanvasInteraction({
    tool, points, shapes, texts, setPoints, setShapes, setTexts, view, setView, snapToGrid, containerRef,
    externalSelection: { selectedIds, setSelectedIds, editingTextId, setEditingTextId }
  });

  const handleUpdateColor = (color: string) => {
      setPoints(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(id => {
              if (selectedIds.includes(id)) next[id] = { ...next[id], color };
          });
          return next;
      });
      setShapes(prev => prev.map(s => selectedIds.includes(s.id) ? { ...s, color } : s));
      setTexts(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(id => {
              if (selectedIds.includes(id)) next[id] = { ...next[id], color };
          });
          return next;
      });
  };

  // Focus textarea when editing starts
  useEffect(() => {
    if (editingTextId && textareaRef.current) {
        // Small timeout to ensure render is complete and keyboard pops up on mobile
        setTimeout(() => {
            textareaRef.current?.focus();
        }, 50);
    }
  }, [editingTextId]);

  // Effective visual sizes
  const visualScale = 1 / view.k;
  const strokeWidth = 2 * visualScale;
  const pointRadius = 4 * visualScale;
  const pointHoverRadius = 8 * visualScale;
  const axisWidth = 1.5 * visualScale;
  const intersectionRadius = 3 * visualScale;

  const instructions = t[lang].canvas.instructions;

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
      onClick={(e) => {
         // Deselect logic handled mostly in interaction hook, but safety check here
      }}
    >
      <svg className="w-full h-full pointer-events-none">
        
        <g transform={`translate(${view.x}, ${view.y}) scale(${view.k})`}>
            {/* Grid */}
            <Grid size={20} show={showGrid} axisWidth={axisWidth} visualScale={visualScale} />

            {/* Render Existing Shapes */}
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
            
            {/* Render Texts */}
            {texts && Object.values(texts).map(text => (
                editingTextId !== text.id && (
                    <TextRenderer 
                        key={text.id} 
                        text={text} 
                        visualScale={visualScale}
                        isSelected={selectedIds.includes(text.id)}
                    />
                )
            ))}

            {/* Render Ghost Shape */}
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
            {Object.values(points).map((p: Point) => (
                <PointRenderer
                    key={p.id}
                    point={p}
                    radius={pointRadius}
                    hoverRadius={pointHoverRadius}
                    isActive={hoveredId === p.id || draftStartId === p.id || draggingId === p.id}
                    isSelected={selectedIds.includes(p.id)}
                    isDraftStart={draftStartId === p.id}
                    strokeWidth={strokeWidth}
                    visualScale={visualScale}
                />
            ))}
        </g>
      </svg>

      {/* Text Editing Overlay */}
      {editingTextId && texts[editingTextId] && (
          <textarea
            ref={textareaRef}
            className="absolute bg-white/80 border border-blue-400 rounded p-1 outline-none resize-none overflow-hidden text-slate-800 shadow-sm z-10"
            style={{
                left: texts[editingTextId].x * view.k + view.x,
                top: texts[editingTextId].y * view.k + view.y - (16 * visualScale * view.k), // Adjust for font size scaling visual
                fontSize: 16, // Use standard px size for input for readability
                color: texts[editingTextId].color || '#334155',
                minWidth: '100px', // Ensure it is visible even if empty
                minHeight: '32px'
            }}
            value={texts[editingTextId].content}
            onChange={(e) => {
                setTexts(prev => ({
                    ...prev,
                    [editingTextId]: { ...prev[editingTextId], content: e.target.value }
                }));
            }}
            onBlur={() => {
                // Garbage collect empty texts on finish
                if (!texts[editingTextId].content || texts[editingTextId].content.trim() === '') {
                    setTexts(prev => {
                        const next = { ...prev };
                        delete next[editingTextId];
                        return next;
                    });
                }
                setEditingTextId(null);
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    // Trigger blur to save/cleanup
                    e.currentTarget.blur();
                }
                e.stopPropagation(); // Prevent global shortcuts like 'Delete' from triggering while typing
            }}
            onMouseDown={(e) => e.stopPropagation()} // Prevent creating new texts while clicking inside textarea
          />
      )}
      
      {/* Loupe for Mobile Precision */}
      {touchPos && (
        <Loupe 
            screenX={touchPos.x} 
            screenY={touchPos.y} 
            view={view}
            points={points}
            shapes={shapes}
            showGrid={showGrid}
            selectedIds={selectedIds}
        />
      )}

      {/* Style Menu Popup */}
      <StyleMenu selectedCount={selectedIds.length} onUpdateColor={handleUpdateColor} />

      <div className="absolute bottom-6 left-6 text-xs text-slate-400 select-none pointer-events-none z-10 hidden md:block">
         <div className="font-medium text-slate-500 mb-1">{t[lang].canvas.scale}: {view.k.toFixed(2)}x</div>
         {tool === ToolType.POINT && instructions.POINT}
         {tool === ToolType.SELECT && instructions.SELECT}
         {tool === ToolType.SEGMENT && instructions.SEGMENT}
         {tool === ToolType.LINE && instructions.LINE}
         {tool === ToolType.CIRCLE && instructions.CIRCLE}
         {tool === ToolType.TEXT && instructions.TEXT}
         
         <div 
             className="mt-2 pt-2 border-t border-slate-200/50 flex flex-col gap-1 pointer-events-auto opacity-70 hover:opacity-100 transition-opacity"
             onMouseDown={(e) => e.stopPropagation()}
         >
            <span className="font-medium">{t[lang].canvas.version}</span>
            <a 
              href="https://buymeacoffee.com/bassani" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-amber-600 hover:text-amber-500 transition-colors flex items-center gap-1.5"
            >
              <span>☕</span> {t[lang].canvas.support}
            </a>
         </div>
      </div>
    </div>
  );
};

export default Canvas;