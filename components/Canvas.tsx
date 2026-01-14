import React, { useRef, useMemo, useState } from 'react';
import { ToolType, Point, GeometricShape, ShapeType } from '../types';
import { COLORS, SNAP_DISTANCE } from '../constants';
import { generateId, distance, findNearestPoint, getLineEnds, getAllIntersections } from '../utils/geometry';
import clsx from 'clsx';

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

const GRID_SIZE = 20;

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
  
  // Interaction State
  const [cursor, setCursor] = useState({ x: 0, y: 0 }); 
  const [draftStartId, setDraftStartId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredIntersection, setHoveredIntersection] = useState<{x: number, y: number} | null>(null);
  
  // Mouse Panning State
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });

  // Touch Gesture State
  const touchRef = useRef<{
    dist: number;
    center: { x: number; y: number };
    mode: 'none' | 'drawing' | 'gesture';
  }>({ dist: 0, center: { x: 0, y: 0 }, mode: 'none' });

  // Effective visual sizes
  const visualScale = 1 / view.k;
  const effectiveSnapDistance = SNAP_DISTANCE * visualScale;
  const strokeWidth = 2 * visualScale;
  const pointRadius = 4 * visualScale;
  const pointHoverRadius = 8 * visualScale; // Larger for touch feel
  const axisWidth = 1.5 * visualScale;
  const intersectionRadius = 3 * visualScale;

  // Memoize intersections
  const intersections = useMemo(() => {
    return getAllIntersections(shapes, points);
  }, [shapes, points]);

  // --- Coordinate Systems ---
  
  const toWorld = (screenX: number, screenY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = screenX - rect.left;
    const relativeY = screenY - rect.top;
    return {
      x: (relativeX - view.x) / view.k,
      y: (relativeY - view.y) / view.k
    };
  };

  // --- Core Snap Logic ---
  
  const getEffectiveCoordinates = (clientX: number, clientY: number, excludePointId: string | null = null) => {
    let { x, y } = toWorld(clientX, clientY);
    
    // Priority 1: Snap to Points
    const nearestPointId = findNearestPoint(x, y, points, excludePointId, effectiveSnapDistance);
    
    if (nearestPointId) {
      const p = points[nearestPointId];
      return { x: p.x, y: p.y, snappedId: nearestPointId, isIntersection: false };
    }

    // Priority 2: Snap to Intersections
    if (snapToGrid) {
      let nearestInt: {x: number, y: number} | null = null;
      let minIntDist = effectiveSnapDistance;

      for (const int of intersections) {
        const d = Math.sqrt(Math.pow(x - int.x, 2) + Math.pow(y - int.y, 2));
        if (d < minIntDist) {
          minIntDist = d;
          nearestInt = int;
        }
      }

      if (nearestInt) {
        return { x: nearestInt.x, y: nearestInt.y, snappedId: null, isIntersection: true };
      }
    }

    // Priority 3: Snap to Grid
    if (snapToGrid) {
      const gridX = Math.round(x / GRID_SIZE) * GRID_SIZE;
      const gridY = Math.round(y / GRID_SIZE) * GRID_SIZE;
      const dGrid = Math.sqrt(Math.pow(x - gridX, 2) + Math.pow(y - gridY, 2));
      if (dGrid < effectiveSnapDistance) {
         x = gridX;
         y = gridY;
      }
    }

    return { x, y, snappedId: null, isIntersection: false };
  };

  // --- Action Logic (Shared between Mouse and Touch) ---

  const handleStartAction = (clientX: number, clientY: number) => {
    const { x, y, snappedId } = getEffectiveCoordinates(clientX, clientY);

    if (tool === ToolType.SELECT) {
      if (snappedId) {
        setDraggingId(snappedId);
      } else {
        // Background drag implies pan start (handled by callers usually, but backup here)
      }
      return;
    }

    if (tool === ToolType.ERASER) {
      if (snappedId) {
        setShapes(prev => prev.filter(s => s.p1 !== snappedId && s.p2 !== snappedId));
        setPoints(prev => {
          const next = { ...prev };
          delete next[snappedId];
          return next;
        });
      }
      return;
    }

    if (tool === ToolType.POINT) {
      if (!snappedId) createPoint(x, y);
      return;
    }

    // Shape Creation (Segment, Line, Circle)
    if (!draftStartId) {
      const target = getTargetPoint(x, y, snappedId);
      setDraftStartId(target.id);
    } else {
      const target = getTargetPoint(x, y, snappedId);
      if (draftStartId !== target.id) {
        const newShape: GeometricShape = {
          id: generateId(),
          type: tool.toLowerCase() as ShapeType,
          p1: draftStartId,
          p2: target.id,
        };
        setShapes(prev => [...prev, newShape]);
      }
      setDraftStartId(null);
    }
  };

  const handleMoveAction = (clientX: number, clientY: number) => {
    const { x, y, snappedId, isIntersection } = getEffectiveCoordinates(clientX, clientY, draggingId);
    
    setCursor({ x, y });
    setHoveredId(snappedId);
    setHoveredIntersection(isIntersection ? {x, y} : null);

    if (draggingId && tool === ToolType.SELECT) {
      setPoints(prev => ({
        ...prev,
        [draggingId]: { ...prev[draggingId], x, y }
      }));
    }
  };

  // --- Mouse Handlers ---

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (tool === ToolType.SELECT && !getEffectiveCoordinates(e.clientX, e.clientY).snappedId)) {
      e.preventDefault();
      setIsPanning(true);
      setLastPanPos({ x: e.clientX, y: e.clientY });
      return;
    }
    handleStartAction(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastPanPos.x;
      const dy = e.clientY - lastPanPos.y;
      setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
      setLastPanPos({ x: e.clientX, y: e.clientY });
      return;
    }
    handleMoveAction(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    setDraggingId(null);
    setIsPanning(false);
  };

  // --- Touch Handlers (Gestures) ---

  const getTouchDist = (t1: React.Touch, t2: React.Touch) => {
    return Math.sqrt(Math.pow(t1.clientX - t2.clientX, 2) + Math.pow(t1.clientY - t2.clientY, 2));
  };

  const getTouchCenter = (t1: React.Touch, t2: React.Touch) => {
    return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // Prevent default to stop scrolling/zooming the whole page
    // e.preventDefault(); // Commented out because we sometimes want default tap behavior, but mostly no

    if (e.touches.length === 2) {
      // Start Gesture (Zoom/Pan)
      touchRef.current.mode = 'gesture';
      touchRef.current.dist = getTouchDist(e.touches[0], e.touches[1]);
      touchRef.current.center = getTouchCenter(e.touches[0], e.touches[1]);
      setDraftStartId(null); // Cancel any drawing
      setDraggingId(null);
    } else if (e.touches.length === 1) {
      // Start Drawing/Selecting
      touchRef.current.mode = 'drawing';
      const t = e.touches[0];
      handleStartAction(t.clientX, t.clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchRef.current.mode === 'gesture' && e.touches.length === 2) {
      const newDist = getTouchDist(e.touches[0], e.touches[1]);
      const newCenter = getTouchCenter(e.touches[0], e.touches[1]);

      const oldDist = touchRef.current.dist;
      const oldCenter = touchRef.current.center;

      // 1. Calculate Pan
      const dx = newCenter.x - oldCenter.x;
      const dy = newCenter.y - oldCenter.y;

      // 2. Calculate Zoom
      // prevent division by zero or extreme zooms
      const scaleFactor = Math.max(0.1, Math.min(newDist / oldDist, 10)); 
      
      // Update View
      setView(prev => {
        // Apply Pan
        let vx = prev.x + dx;
        let vy = prev.y + dy;

        // Apply Zoom relative to center
        if (Math.abs(1 - scaleFactor) > 0.01) {
             const kNew = Math.max(0.1, Math.min(50, prev.k * scaleFactor));
             
             // To zoom into the "center" of the pinch, we need world coordinates of that center
             if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const centerScreenX = newCenter.x - rect.left;
                const centerScreenY = newCenter.y - rect.top;
                
                const centerWorldX = (centerScreenX - vx) / prev.k;
                const centerWorldY = (centerScreenY - vy) / prev.k;

                vx = centerScreenX - centerWorldX * kNew;
                vy = centerScreenY - centerWorldY * kNew;
                return { x: vx, y: vy, k: kNew };
             }
        }

        return { ...prev, x: vx, y: vy };
      });

      // Update ref for next frame
      touchRef.current.dist = newDist;
      touchRef.current.center = newCenter;

    } else if (touchRef.current.mode === 'drawing' && e.touches.length === 1) {
      const t = e.touches[0];
      handleMoveAction(t.clientX, t.clientY);
    }
  };

  const handleTouchEnd = () => {
    touchRef.current.mode = 'none';
    setDraggingId(null);
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation(); 
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newK = Math.max(0.1, Math.min(50, view.k * zoomFactor));
    
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = (mouseX - view.x) / view.k;
    const worldY = (mouseY - view.y) / view.k;
    
    const newX = mouseX - worldX * newK;
    const newY = mouseY - worldY * newK;

    setView({ k: newK, x: newX, y: newY });
  };

  // --- Helpers ---

  const createPoint = (x: number, y: number): string => {
    const id = generateId();
    const label = String.fromCharCode(65 + (Object.keys(points).length % 26)); 
    setPoints(prev => ({ ...prev, [id]: { id, x, y, label } }));
    return id;
  };

  const getTargetPoint = (x: number, y: number, existingId: string | null): { id: string } => {
    if (existingId) return { id: existingId };
    return { id: createPoint(x, y) };
  };

  // --- Renderers ---

  const renderIntersectionMarker = () => {
    if (!hoveredIntersection) return null;
    return (
      <circle 
        cx={hoveredIntersection.x} 
        cy={hoveredIntersection.y} 
        r={intersectionRadius} 
        fill="#64748b"
        opacity={0.7}
        className="pointer-events-none"
      />
    );
  };

  const renderPoint = (p: Point) => {
    const isHovered = hoveredId === p.id;
    const isDraftStart = draftStartId === p.id;
    const isDragging = draggingId === p.id;
    const active = isHovered || isDraftStart || isDragging;

    return (
      <g key={p.id} className="cursor-pointer transition-colors duration-200" style={{ pointerEvents: 'none' }}>
        {/* Transparent hit area for easier touch selection */}
        <circle cx={p.x} cy={p.y} r={Math.max(effectiveSnapDistance, 15 * visualScale)} fill="transparent" />
        
        <circle 
          cx={p.x} 
          cy={p.y} 
          r={active ? pointHoverRadius : pointRadius} 
          fill={isDraftStart ? COLORS.accent : COLORS.point}
          stroke="white"
          strokeWidth={strokeWidth}
        />
        
        <text 
          x={p.x + (pointRadius * 2)} 
          y={p.y - (pointRadius * 2)} 
          fontSize={12 * visualScale}
          className="font-medium fill-slate-500 select-none font-sans"
          style={{ textShadow: '0 1px 2px white' }}
        >
          {p.label}
        </text>
      </g>
    );
  };

  const renderShape = (shape: GeometricShape, isGhost = false) => {
    const p1 = points[shape.p1];
    const p2 = points[shape.p2];
    if (!p1 || !p2) return null;

    const color = isGhost ? COLORS.accent : COLORS.primary;
    const opacity = isGhost ? 0.6 : 1;

    switch (shape.type) {
      case 'segment':
        return (
          <line
            key={shape.id}
            x1={p1.x} y1={p1.y}
            x2={p2.x} y2={p2.y}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            opacity={opacity}
          />
        );
      case 'line':
        const { x1, y1, x2, y2 } = getLineEnds(p1, p2, 0, 0); 
        return (
          <line
            key={shape.id}
            x1={x1} y1={y1}
            x2={x2} y2={y2}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            opacity={opacity}
          />
        );
      case 'circle':
        const r = distance(p1, p2);
        return (
          <circle
            key={shape.id}
            cx={p1.x} cy={p1.y}
            r={r}
            fill="transparent"
            stroke={color}
            strokeWidth={strokeWidth}
            opacity={opacity}
          />
        );
      default:
        return null;
    }
  };

  const renderGhostShape = () => {
    if (!draftStartId) return null;
    const p1 = points[draftStartId];
    if (!p1) return null;
    
    const p2 = { x: cursor.x, y: cursor.y };

    const type = tool.toLowerCase() as ShapeType;
    const color = COLORS.accent;
    const dash = `${5 * visualScale},${5 * visualScale}`;

    if (type === 'segment') {
      return <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={strokeWidth} strokeDasharray={dash} />;
    }
    if (type === 'line') {
      const { x1, y1, x2, y2 } = getLineEnds(p1, p2, 0, 0);
      return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={strokeWidth} strokeDasharray={dash} />;
    }
    if (type === 'circle') {
      const r = distance(p1, p2);
      return <circle cx={p1.x} cy={p1.y} r={r} fill="transparent" stroke={color} strokeWidth={strokeWidth} strokeDasharray={dash} />;
    }
    return null;
  };

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
      // Touch Events
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <svg className="w-full h-full pointer-events-none">
        <defs>
            <pattern id="smallGrid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
               <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke={COLORS.grid} strokeWidth="0.5"/>
            </pattern>
            <pattern id="grid" width={GRID_SIZE * 5} height={GRID_SIZE * 5} patternUnits="userSpaceOnUse">
               <rect width={GRID_SIZE * 5} height={GRID_SIZE * 5} fill="url(#smallGrid)"/>
               <path d={`M ${GRID_SIZE * 5} 0 L 0 0 0 ${GRID_SIZE * 5}`} fill="none" stroke="#cbd5e1" strokeWidth="1"/>
            </pattern>
        </defs>

        <g transform={`translate(${view.x}, ${view.y}) scale(${view.k})`}>
            {showGrid && (
              <>
                <rect x={-50000} y={-50000} width={100000} height={100000} fill="url(#grid)" opacity={0.6} />
                <line x1={-50000} x2={50000} y1={0} y2={0} stroke="#94a3b8" strokeWidth={axisWidth} />
                <line x1={0} x2={0} y1={-50000} y2={50000} stroke="#94a3b8" strokeWidth={axisWidth} />
              </>
            )}
            
            {shapes.map(s => renderShape(s))}
            {renderGhostShape()}
            {renderIntersectionMarker()}
            {Object.values(points).map(renderPoint)}
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