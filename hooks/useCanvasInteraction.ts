import React, { useState, useRef, useMemo } from 'react';
import { ToolType, Point, GeometricShape, ShapeType, TextLabel } from '../types';
import { generateId, findNearestPoint, findNearestText, getAllIntersections, getNearestPointOnShape, distance } from '../utils/geometry';
import { SNAP_DISTANCE } from '../constants';

interface UseCanvasInteractionProps {
  tool: ToolType;
  points: Record<string, Point>;
  shapes: GeometricShape[];
  texts: Record<string, TextLabel>;
  setPoints: React.Dispatch<React.SetStateAction<Record<string, Point>>>;
  setShapes: React.Dispatch<React.SetStateAction<GeometricShape[]>>;
  setTexts: React.Dispatch<React.SetStateAction<Record<string, TextLabel>>>;
  view: { x: number; y: number; k: number };
  setView: React.Dispatch<React.SetStateAction<{ x: number; y: number; k: number }>>;
  snapToGrid: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  // Add external selection control
  externalSelection?: {
      selectedIds: string[];
      setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
      editingTextId: string | null;
      setEditingTextId: React.Dispatch<React.SetStateAction<string | null>>;
  };
}

const GRID_SIZE = 20;

export const useCanvasInteraction = ({
  tool,
  points,
  shapes,
  texts,
  setPoints,
  setShapes,
  setTexts,
  view,
  setView,
  snapToGrid,
  containerRef,
  externalSelection
}: UseCanvasInteractionProps) => {
  
  // Interaction State
  const [cursor, setCursor] = useState({ x: 0, y: 0 }); 
  
  // Screen cursor for Loupe (null if not touching)
  const [touchPos, setTouchPos] = useState<{x: number, y: number} | null>(null);

  const [draftStartId, setDraftStartId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredIntersection, setHoveredIntersection] = useState<{x: number, y: number} | null>(null);
  
  // Selection State: Use external if available, otherwise internal (fallback)
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
  const selectedIds = externalSelection ? externalSelection.selectedIds : internalSelectedIds;
  const setSelectedIds = externalSelection ? externalSelection.setSelectedIds : setInternalSelectedIds;
  
  // Mouse Panning State
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });

  // Touch Gesture State
  const touchRef = useRef<{
    dist: number;
    center: { x: number; y: number };
    mode: 'none' | 'drawing' | 'gesture' | 'panning';
    startPos: { x: number; y: number } | null;
  }>({ dist: 0, center: { x: 0, y: 0 }, mode: 'none', startPos: null });

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
    let snappedId: string | null = null;
    let shapeId: string | null = null;
    let textId: string | null = null;
    
    // Priority 1: Snap to Points
    const nearestPointId = findNearestPoint(x, y, points, excludePointId, effectiveSnapDistance);
    
    if (nearestPointId) {
      const p = points[nearestPointId];
      return { x: p.x, y: p.y, snappedId: nearestPointId, shapeId: null, textId: null, isIntersection: false };
    }

    // Priority 1.5: Snap to Text (for selection/drag)
    const nearestTextId = findNearestText(x, y, texts || {}, effectiveSnapDistance);
    if (nearestTextId) {
        const t = texts[nearestTextId];
        return { x: t.x, y: t.y, snappedId: null, shapeId: null, textId: nearestTextId, isIntersection: false };
    }

    // Priority 2: Snap to Intersections
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
      return { x: nearestInt.x, y: nearestInt.y, snappedId: null, shapeId: null, textId: null, isIntersection: true };
    }

    // Priority 3: Snap to Shapes (Segments, Lines, Circles)
    let nearestShapePoint: {x: number, y: number} | null = null;
    let minShapeDist = effectiveSnapDistance;
    let foundShapeId: string | null = null;

    for (const shape of shapes) {
        const proj = getNearestPointOnShape(x, y, shape, points, effectiveSnapDistance);
        if (proj) {
            const d = Math.sqrt(Math.pow(x - proj.point.x, 2) + Math.pow(y - proj.point.y, 2));
            if (d < minShapeDist) {
                minShapeDist = d;
                nearestShapePoint = proj.point;
                foundShapeId = proj.shapeId;
            }
        }
    }

    if (nearestShapePoint && foundShapeId) {
         return { x: nearestShapePoint.x, y: nearestShapePoint.y, snappedId: null, shapeId: foundShapeId, textId: null, isIntersection: false };
    }

    // Priority 4: Snap to Grid
    if (snapToGrid) {
      const gridX = Math.round(x / GRID_SIZE) * GRID_SIZE;
      const gridY = Math.round(y / GRID_SIZE) * GRID_SIZE;
      const dGrid = Math.sqrt(Math.pow(x - gridX, 2) + Math.pow(y - gridY, 2));
      if (dGrid < effectiveSnapDistance) {
         x = gridX;
         y = gridY;
      }
    }

    return { x, y, snappedId: null, shapeId: null, textId: null, isIntersection: false };
  };

  // --- Actions ---

  const handleStartAction = (clientX: number, clientY: number, isShiftKey: boolean) => {
    const { x, y, snappedId, shapeId, textId } = getEffectiveCoordinates(clientX, clientY);

    if (tool === ToolType.SELECT) {
      // Selection Logic
      const targetId = snappedId || shapeId || textId;
      
      if (targetId) {
         if (isShiftKey) {
             // Toggle selection
             setSelectedIds(prev => prev.includes(targetId) 
                ? prev.filter(id => id !== targetId) 
                : [...prev, targetId]
             );
         } else {
             // If clicking an already selected item without shift, don't clear (might be starting a drag)
             if (!selectedIds.includes(targetId)) {
                setSelectedIds([targetId]);
             }
         }
         
         if (snappedId) setDraggingId(snappedId); // Drag points
         if (textId) setDraggingId(textId); // Drag texts
      } else {
         if (!isShiftKey) setSelectedIds([]);
      }
      return;
    }

    // Clear selection when using other tools
    if (selectedIds.length > 0) setSelectedIds([]);

    if (tool === ToolType.ERASER) {
      if (snappedId) {
        setShapes(prev => prev.filter(s => s.p1 !== snappedId && s.p2 !== snappedId));
        setPoints(prev => {
          const next = { ...prev };
          delete next[snappedId];
          return next;
        });
      } else if (shapeId) {
         setShapes(prev => prev.filter(s => s.id !== shapeId));
      } else if (textId) {
         setTexts(prev => {
             const next = { ...prev };
             delete next[textId];
             return next;
         });
      }
      return;
    }

    if (tool === ToolType.POINT) {
      if (!snappedId) createPoint(x, y);
      return;
    }

    if (tool === ToolType.TEXT) {
        // If clicking on existing text, maybe edit? For now, always create new if tool is Text.
        // Better UX: check if hitting text.
        if (textId) {
            // Edit existing
            if (externalSelection && externalSelection.setEditingTextId) {
                externalSelection.setEditingTextId(textId);
            }
        } else {
            // Create New Text
            const id = generateId();
            setTexts(prev => ({
                ...prev,
                [id]: { id, x, y, content: '' } // Empty initially, editing mode will focus input
            }));
            if (externalSelection && externalSelection.setEditingTextId) {
                externalSelection.setEditingTextId(id);
            }
        }
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
    const { x, y, snappedId, isIntersection, textId } = getEffectiveCoordinates(clientX, clientY, draggingId);
    
    setCursor({ x, y });
    setHoveredId(snappedId || textId);
    setHoveredIntersection(isIntersection ? {x, y} : null);

    if (draggingId && tool === ToolType.SELECT) {
      if (points[draggingId]) {
          setPoints(prev => ({
            ...prev,
            [draggingId]: { ...prev[draggingId], x, y }
          }));
      } else if (texts[draggingId]) {
          setTexts(prev => ({
              ...prev,
              [draggingId]: { ...prev[draggingId], x, y }
          }));
      }
    }
  };

  const finalizeDraft = (clientX: number, clientY: number) => {
      if (!draftStartId) return;
      const startPoint = points[draftStartId];
      if (!startPoint) {
          setDraftStartId(null);
          return;
      }

      const { x, y, snappedId } = getEffectiveCoordinates(clientX, clientY, draftStartId);
      const dist = Math.sqrt(Math.pow(x - startPoint.x, 2) + Math.pow(y - startPoint.y, 2));

      const dragThreshold = 20 * visualScale;

      if (dist > dragThreshold) {
          // For LINE and RAY, we don't need to create the second point visibly
          // We just use it for direction
          const isDirectionalShape = tool === ToolType.LINE || tool === ToolType.RAY;

          let targetId: string;

          if (isDirectionalShape) {
              // For directional shapes, only create a point if user explicitly snapped to one
              if (snappedId) {
                  targetId = snappedId;
              } else {
                  // Create a hidden point just for direction (won't be rendered)
                  targetId = generateId();
                  const tempPoint: Point = { id: targetId, x, y, hidden: true };
                  setPoints(prev => ({ ...prev, [targetId]: tempPoint }));
              }
          } else {
              // For SEGMENT and CIRCLE, create the target point normally
              const target = getTargetPoint(x, y, snappedId);
              targetId = target.id;
          }

          if (draftStartId !== targetId) {
              const newShape: GeometricShape = {
                id: generateId(),
                type: tool.toLowerCase() as ShapeType,
                p1: draftStartId,
                p2: targetId,
              };
              setShapes(prev => [...prev, newShape]);
              setDraftStartId(null);
          }
      }
  };

  // --- Event Handlers ---

  const handleMouseDown = (e: React.MouseEvent) => {
    // Determine if we are hitting anything selectable
    const coords = getEffectiveCoordinates(e.clientX, e.clientY);
    const hitAnything = coords.snappedId || coords.shapeId || coords.textId;

    if (e.button === 1 || (tool === ToolType.SELECT && !hitAnything)) {
      if (!e.shiftKey) { 
          e.preventDefault();
          setIsPanning(true);
          setLastPanPos({ x: e.clientX, y: e.clientY });
          if (!e.shiftKey) setSelectedIds([]);
          return;
      }
    }
    handleStartAction(e.clientX, e.clientY, e.shiftKey);
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

  const handleMouseUp = (e: React.MouseEvent) => {
    // "Drag-to-Create" logic
    if (draftStartId && !isPanning && !draggingId && (tool === ToolType.SEGMENT || tool === ToolType.LINE || tool === ToolType.RAY || tool === ToolType.CIRCLE)) {
        finalizeDraft(e.clientX, e.clientY);
    }

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
      setTouchPos(null);
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      const startX = t.clientX;
      const startY = t.clientY;
      
      setTouchPos({ x: startX, y: startY });

      // Check if touching background or an object
      const { snappedId, shapeId, textId } = getEffectiveCoordinates(startX, startY);
      const isHittingObject = snappedId || shapeId || textId;

      // Special Case: 1 finger pan in Select Mode if touching background
      if (tool === ToolType.SELECT && !isHittingObject) {
         touchRef.current.mode = 'panning';
         touchRef.current.startPos = { x: startX, y: startY };
         setLastPanPos({ x: startX, y: startY });
         setIsPanning(true);
         setTouchPos(null);
         return;
      }

      touchRef.current.mode = 'drawing';
      touchRef.current.startPos = { x: startX, y: startY };
      handleStartAction(startX, startY, false);
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
      setTouchPos(null); 

    } else if (touchRef.current.mode === 'panning' && e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - lastPanPos.x;
      const dy = t.clientY - lastPanPos.y;
      
      setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
      setLastPanPos({ x: t.clientX, y: t.clientY });
      setTouchPos(null); 
      
    } else if (touchRef.current.mode === 'drawing' && e.touches.length === 1) {
      const t = e.touches[0];
      setTouchPos({ x: t.clientX, y: t.clientY }); 
      handleMoveAction(t.clientX, t.clientY);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchRef.current.mode === 'drawing' && draftStartId && !draggingId && (tool === ToolType.SEGMENT || tool === ToolType.LINE || tool === ToolType.RAY || tool === ToolType.CIRCLE)) {
        const t = e.changedTouches[0];
        if (t) finalizeDraft(t.clientX, t.clientY);
    }
    
    // Tap to deselect logic on mobile
    if (touchRef.current.mode === 'panning' && tool === ToolType.SELECT && touchRef.current.startPos) {
        const t = e.changedTouches[0];
        if (t) {
            const d = Math.sqrt(Math.pow(t.clientX - touchRef.current.startPos.x, 2) + Math.pow(t.clientY - touchRef.current.startPos.y, 2));
            if (d < 5) {
                setSelectedIds([]);
            }
        }
    }

    touchRef.current.mode = 'none';
    touchRef.current.startPos = null;
    setDraggingId(null);
    setIsPanning(false);
    setTouchPos(null); 
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
    touchPos, 
    draftStartId,
    draggingId,
    hoveredId,
    hoveredIntersection,
    isPanning,
    selectedIds,
    setSelectedIds
  };
};