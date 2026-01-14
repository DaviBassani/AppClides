import React, { useState, useRef, useMemo } from 'react';
import { ToolType, Point, GeometricShape, ShapeType } from '../types';
import { generateId, findNearestPoint, getAllIntersections } from '../utils/geometry';
import { SNAP_DISTANCE } from '../constants';

interface UseCanvasInteractionProps {
  tool: ToolType;
  points: Record<string, Point>;
  shapes: GeometricShape[];
  setPoints: React.Dispatch<React.SetStateAction<Record<string, Point>>>;
  setShapes: React.Dispatch<React.SetStateAction<GeometricShape[]>>;
  view: { x: number; y: number; k: number };
  setView: React.Dispatch<React.SetStateAction<{ x: number; y: number; k: number }>>;
  snapToGrid: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const GRID_SIZE = 20;

export const useCanvasInteraction = ({
  tool,
  points,
  shapes,
  setPoints,
  setShapes,
  view,
  setView,
  snapToGrid,
  containerRef
}: UseCanvasInteractionProps) => {
  
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

  // Derived Values
  const visualScale = 1 / view.k;
  const effectiveSnapDistance = SNAP_DISTANCE * visualScale;
  
  const intersections = useMemo(() => {
    return getAllIntersections(shapes, points);
  }, [shapes, points]);

  // --- Helpers ---

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

  // --- Actions ---

  const handleStartAction = (clientX: number, clientY: number) => {
    const { x, y, snappedId } = getEffectiveCoordinates(clientX, clientY);

    if (tool === ToolType.SELECT) {
      if (snappedId) {
        setDraggingId(snappedId);
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

  // --- Event Handlers ---

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

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      touchRef.current.mode = 'gesture';
      touchRef.current.dist = Math.sqrt(Math.pow(e.touches[0].clientX - e.touches[1].clientX, 2) + Math.pow(e.touches[0].clientY - e.touches[1].clientY, 2));
      touchRef.current.center = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 };
      setDraftStartId(null);
      setDraggingId(null);
    } else if (e.touches.length === 1) {
      touchRef.current.mode = 'drawing';
      const t = e.touches[0];
      handleStartAction(t.clientX, t.clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchRef.current.mode === 'gesture' && e.touches.length === 2) {
      const newDist = Math.sqrt(Math.pow(e.touches[0].clientX - e.touches[1].clientX, 2) + Math.pow(e.touches[0].clientY - e.touches[1].clientY, 2));
      const newCenter = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 };

      const dx = newCenter.x - touchRef.current.center.x;
      const dy = newCenter.y - touchRef.current.center.y;
      const scaleFactor = Math.max(0.1, Math.min(newDist / touchRef.current.dist, 10)); 
      
      setView(prev => {
        let vx = prev.x + dx;
        let vy = prev.y + dy;
        if (Math.abs(1 - scaleFactor) > 0.01) {
             const kNew = Math.max(0.1, Math.min(50, prev.k * scaleFactor));
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

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleWheel,
    // State exposed for rendering
    cursor,
    draftStartId,
    draggingId,
    hoveredId,
    hoveredIntersection,
    isPanning
  };
};