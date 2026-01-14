import React from 'react';
import { GeometricShape, Point, ShapeType } from '../../types';
import { COLORS } from '../../constants';
import { distance, getLineEnds } from '../../utils/geometry';

interface ShapeRendererProps {
  shape: GeometricShape;
  p1: Point;
  p2: Point;
  strokeWidth: number;
  isGhost?: boolean;
}

export const ShapeRenderer: React.FC<ShapeRendererProps> = React.memo(({ shape, p1, p2, strokeWidth, isGhost = false }) => {
  const color = isGhost ? COLORS.accent : COLORS.primary;
  const opacity = isGhost ? 0.6 : 1;
  const dash = isGhost ? `${5 * strokeWidth},${5 * strokeWidth}` : undefined;

  switch (shape.type) {
    case 'segment':
      return (
        <line
          x1={p1.x} y1={p1.y}
          x2={p2.x} y2={p2.y}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={dash}
          opacity={opacity}
        />
      );
    case 'line':
      const { x1, y1, x2, y2 } = getLineEnds(p1, p2, 0, 0);
      return (
        <line
          x1={x1} y1={y1}
          x2={x2} y2={y2}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={dash}
          opacity={opacity}
        />
      );
    case 'circle':
      const r = distance(p1, p2);
      return (
        <circle
          cx={p1.x} cy={p1.y}
          r={r}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={dash}
          opacity={opacity}
        />
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
}

export const GhostShapeRenderer: React.FC<GhostShapeProps> = ({ type, p1, cursor, strokeWidth, visualScale }) => {
    // Construct a temporary shape object to reuse the renderer logic
    // We mock the ID and p2 since render logic depends on Point objects
    const tempShape: GeometricShape = { id: 'ghost', type, p1: p1.id, p2: 'cursor' };
    const p2: Point = { id: 'cursor', x: cursor.x, y: cursor.y };

    return (
        <ShapeRenderer 
            shape={tempShape} 
            p1={p1} 
            p2={p2} 
            strokeWidth={strokeWidth} 
            isGhost={true} 
        />
    );
};