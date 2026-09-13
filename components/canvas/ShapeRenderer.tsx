import React from 'react';
import { GeometricShape, Point, ShapeType } from '../../types';
import { COLORS } from '../../constants';
import { distance, ViewportBounds, clipLine, clipRay, LineSegment } from '../../utils/geometry';

interface ShapeRendererProps {
  shape: GeometricShape;
  p1: Point;
  p2: Point;
  strokeWidth: number;
  isGhost?: boolean;
  isSelected?: boolean;
  viewportBounds?: ViewportBounds;
}

// Fallback for when bounds are not available (e.g., before first measure)
const FALLBACK_BOUNDS: ViewportBounds = {
  minX: -100000,
  minY: -100000,
  maxX: 100000,
  maxY: 100000,
};

export const ShapeRenderer: React.FC<ShapeRendererProps> = React.memo(({ shape, p1, p2, strokeWidth, isGhost = false, isSelected = false, viewportBounds }) => {
  const color = isGhost ? COLORS.accent : (shape.color || COLORS.primary);
  const opacity = isGhost ? 0.6 : 1;
  const dash = isGhost ? `${5 * strokeWidth},${5 * strokeWidth}` : undefined;
  const bounds = viewportBounds || FALLBACK_BOUNDS;

  // Resolve the drawable segment for infinite/semi-infinite shapes
  const infiniteSegment: LineSegment | null = React.useMemo(() => {
    if (shape.type === 'line') return clipLine(p1, p2, bounds);
    if (shape.type === 'ray') return clipRay(p1, p2, bounds);
    return null;
  }, [shape.type, p1.x, p1.y, p2.x, p2.y, bounds]);

  // Selection Highlight
  const shadowStroke = strokeWidth * 4;
  const Shadow = () => isSelected ? (
      <>
        {shape.type === 'segment' && <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={COLORS.selection} strokeWidth={shadowStroke} strokeLinecap="round" opacity={0.4} />}
        {shape.type === 'line' && infiniteSegment && (
             <line x1={infiniteSegment.x1} y1={infiniteSegment.y1} x2={infiniteSegment.x2} y2={infiniteSegment.y2} stroke={COLORS.selection} strokeWidth={shadowStroke} strokeLinecap="round" opacity={0.4} />
        )}
        {shape.type === 'ray' && infiniteSegment && (
             <line x1={infiniteSegment.x1} y1={infiniteSegment.y1} x2={infiniteSegment.x2} y2={infiniteSegment.y2} stroke={COLORS.selection} strokeWidth={shadowStroke} strokeLinecap="round" opacity={0.4} />
        )}
        {shape.type === 'circle' && <circle cx={p1.x} cy={p1.y} r={distance(p1, p2)} fill="transparent" stroke={COLORS.selection} strokeWidth={shadowStroke} opacity={0.4} />}
      </>
  ) : null;

  switch (shape.type) {
    case 'segment':
      return (
        <g>
            <Shadow />
            <line
              x1={p1.x} y1={p1.y}
              x2={p2.x} y2={p2.y}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={dash}
              opacity={opacity}
            />
        </g>
      );
    case 'line':
      if (!infiniteSegment) return null;
      return (
        <g>
            <Shadow />
            <line
              x1={infiniteSegment.x1} y1={infiniteSegment.y1}
              x2={infiniteSegment.x2} y2={infiniteSegment.y2}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={dash}
              opacity={opacity}
            />
        </g>
      );
    case 'ray':
      if (!infiniteSegment) return null;
      return (
        <g>
            <Shadow />
            <line
              x1={infiniteSegment.x1} y1={infiniteSegment.y1}
              x2={infiniteSegment.x2} y2={infiniteSegment.y2}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={dash}
              opacity={opacity}
            />
        </g>
      );
    case 'circle':
      const r = distance(p1, p2);
      return (
        <g>
            <Shadow />
            <circle
              cx={p1.x} cy={p1.y}
              r={r}
              fill="transparent"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={dash}
              opacity={opacity}
            />
        </g>
      );
    default:
      return null;
  }
});

interface GhostShapeProps {
    type: ShapeType;
    p1: Point;
    cursor: { x: number, y: number };
    strokeWidth: number;
    visualScale: number;
    viewportBounds?: ViewportBounds;
}

export const GhostShapeRenderer: React.FC<GhostShapeProps> = ({ type, p1, cursor, strokeWidth, visualScale, viewportBounds }) => {
    // Construct a temporary shape object to reuse the renderer logic
    const tempShape: GeometricShape = { id: 'ghost', type, p1: p1.id, p2: 'cursor' };
    const p2: Point = { id: 'cursor', x: cursor.x, y: cursor.y };

    return (
        <ShapeRenderer
            shape={tempShape}
            p1={p1}
            p2={p2}
            strokeWidth={strokeWidth}
            isGhost={true}
            viewportBounds={viewportBounds}
        />
    );
};