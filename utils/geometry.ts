import { Point, GeometricShape, TextLabel } from '../types';
import { SNAP_DISTANCE } from '../constants';

export const generateId = () => crypto.randomUUID();

export const distance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

export const findNearestPoint = (
  x: number,
  y: number,
  points: Record<string, Point>,
  excludeId: string | null = null,
  threshold: number = SNAP_DISTANCE
): string | null => {
  let nearestId: string | null = null;
  let minDist = threshold;

  Object.values(points).forEach((p) => {
    if (excludeId && p.id === excludeId) return;
    const d = distance({ x, y }, p);
    if (d < minDist) {
      minDist = d;
      nearestId = p.id;
    }
  });

  return nearestId;
};

export const findNearestText = (
  x: number,
  y: number,
  texts: Record<string, TextLabel>,
  threshold: number = SNAP_DISTANCE
): string | null => {
  let nearestId: string | null = null;
  let minDist = threshold;

  Object.values(texts).forEach((t) => {
    const d = distance({ x, y }, t);
    // Give texts a slightly larger hit area since they are larger visually
    if (d < minDist + 10) {
      minDist = d;
      nearestId = t.id;
    }
  });

  return nearestId;
};
export interface ViewportBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface LineSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Visible rectangle in world coordinates, with margin (in world units)
export const getViewportBounds = (
  view: { x: number; y: number; k: number },
  widthPx: number,
  heightPx: number,
  marginPx: number = 200
): ViewportBounds => {
  const margin = marginPx / view.k;
  return {
    minX: (-view.x - margin) / view.k,
    minY: (-view.y - margin) / view.k,
    maxX: (widthPx - view.x + margin) / view.k,
    maxY: (heightPx - view.y + margin) / view.k,
  };
};

// Liang-Barsky parametric clipping of the infinite line through a→b against bounds
export const clipLine = (
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  bounds: ViewportBounds
): LineSegment | null => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  if (Math.abs(dx) < 1e-12 && Math.abs(dy) < 1e-12) {
    // Degenerate: coincident points, render a dot-like segment at p1 if visible
    if (p1.x >= bounds.minX && p1.x <= bounds.maxX && p1.y >= bounds.minY && p1.y <= bounds.maxY) {
      return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
    }
    return null;
  }

  let t0 = -Infinity;
  let t1 = Infinity;

  // Liang-Barsky slab test: intersect parameter range [t0,t1] with [ta,tb]
  const clipSlab = (p: number, d: number, min: number, max: number): boolean => {
    if (Math.abs(d) < 1e-12) {
      return p >= min && p <= max;
    }
    let ta = (min - p) / d;
    let tb = (max - p) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    return t0 <= t1;
  };

  if (!clipSlab(p1.x, dx, bounds.minX, bounds.maxX)) return null;
  if (!clipSlab(p1.y, dy, bounds.minY, bounds.maxY)) return null;

  if (t1 <= t0) return null;

  return {
    x1: p1.x + t0 * dx,
    y1: p1.y + t0 * dy,
    x2: p1.x + t1 * dx,
    y2: p1.y + t1 * dy,
  };
};

// Clip the ray starting at p1 through p2 (extends only in direction p1→p2)
export const clipRay = (
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  bounds: ViewportBounds
): LineSegment | null => {
  // Clip the infinite line to bounds, then restrict the parameter to [0, +Inf)
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  if (Math.abs(dx) < 1e-12 && Math.abs(dy) < 1e-12) {
    if (p1.x >= bounds.minX && p1.x <= bounds.maxX && p1.y >= bounds.minY && p1.y <= bounds.maxY) {
      return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
    }
    return null;
  }

  let t0 = 0; // ray starts at p1
  let t1 = Infinity;

  const clipSlab = (p: number, d: number, min: number, max: number): boolean => {
    if (Math.abs(d) < 1e-12) {
      return p >= min && p <= max;
    }
    let ta = (min - p) / d;
    let tb = (max - p) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    return t0 <= t1;
  };

  if (!clipSlab(p1.x, dx, bounds.minX, bounds.maxX)) return null;
  if (!clipSlab(p1.y, dy, bounds.minY, bounds.maxY)) return null;

  if (t1 <= t0) return null;

  return {
    x1: p1.x + t0 * dx,
    y1: p1.y + t0 * dy,
    x2: p1.x + t1 * dx,
    y2: p1.y + t1 * dy,
  };
};

// --- Projection Logic (Snap to Shape) ---

interface Point2D { x: number; y: number; }

const projectOnLine = (p: Point2D, a: Point2D, b: Point2D, clamp: boolean): Point2D => {
    const atob = { x: b.x - a.x, y: b.y - a.y };
    const atop = { x: p.x - a.x, y: p.y - a.y };
    const lenSq = atob.x * atob.x + atob.y * atob.y;
    
    if (lenSq === 0) return a;

    let dot = atop.x * atob.x + atop.y * atob.y;
    let t = dot / lenSq;

    if (clamp) {
        t = Math.max(0, Math.min(1, t));
    }

    return {
        x: a.x + atob.x * t,
        y: a.y + atob.y * t
    };
};

const projectOnCircle = (p: Point2D, center: Point2D, radiusPoint: Point2D): Point2D => {
    const r = distance(center, radiusPoint);
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    const currentDist = Math.sqrt(dx * dx + dy * dy);

    if (currentDist === 0) return { x: center.x + r, y: center.y }; // Degenerate case

    const scale = r / currentDist;
    return {
        x: center.x + dx * scale,
        y: center.y + dy * scale
    };
};

// Returns both the point and the shape ID it belongs to
export const getNearestPointOnShape = (
    x: number, 
    y: number, 
    shape: GeometricShape, 
    points: Record<string, Point>, 
    threshold: number
): { point: Point2D, shapeId: string } | null => {
    const p1 = points[shape.p1];
    const p2 = points[shape.p2];
    if (!p1 || !p2) return null;

    let proj: Point2D;

    if (shape.type === 'segment') {
        proj = projectOnLine({ x, y }, p1, p2, true);
    } else if (shape.type === 'line') {
        proj = projectOnLine({ x, y }, p1, p2, false);
    } else if (shape.type === 'circle') {
        proj = projectOnCircle({ x, y }, p1, p2);
    } else {
        return null;
    }

    const d = distance({ x, y }, proj);
    return d <= threshold ? { point: proj, shapeId: shape.id } : null;
};

// --- Intersection Logic ---

const onSegment = (p: Point2D, a: Point2D, b: Point2D): boolean => {
  const buffer = 0.001;
  return p.x >= Math.min(a.x, b.x) - buffer && p.x <= Math.max(a.x, b.x) + buffer &&
         p.y >= Math.min(a.y, b.y) - buffer && p.y <= Math.max(a.y, b.y) + buffer;
};

const getLineIntersection = (
  p1: Point2D, p2: Point2D, type1: 'line' | 'segment',
  p3: Point2D, p4: Point2D, type2: 'line' | 'segment'
): Point2D[] => {
  const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;

  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (denom === 0) return []; // Parallel

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const x = x1 + ua * (x2 - x1);
  const y = y1 + ua * (y2 - y1);
  const p = { x, y };

  if (type1 === 'segment' && !onSegment(p, p1, p2)) return [];
  if (type2 === 'segment' && !onSegment(p, p3, p4)) return [];

  return [p];
};

const getLineCircleIntersection = (
  p1: Point2D, p2: Point2D, type1: 'line' | 'segment',
  cCenter: Point2D, cRadiusPoint: Point2D
): Point2D[] => {
  const r = distance(cCenter, cRadiusPoint);
  const x1 = p1.x - cCenter.x;
  const y1 = p1.y - cCenter.y;
  const x2 = p2.x - cCenter.x;
  const y2 = p2.y - cCenter.y;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const dr = Math.sqrt(dx * dx + dy * dy);
  const D = x1 * y2 - x2 * y1;

  const discriminant = r * r * dr * dr - D * D;

  if (discriminant < 0) return [];

  const points: Point2D[] = [];
  const rootDisc = Math.sqrt(discriminant);

  const solX1 = (D * dy + (dy < 0 ? -1 : 1) * dx * rootDisc) / (dr * dr);
  const solY1 = (-D * dx + Math.abs(dy) * rootDisc) / (dr * dr);
  const solX2 = (D * dy - (dy < 0 ? -1 : 1) * dx * rootDisc) / (dr * dr);
  const solY2 = (-D * dx - Math.abs(dy) * rootDisc) / (dr * dr);

  const intersect1 = { x: solX1 + cCenter.x, y: solY1 + cCenter.y };
  const intersect2 = { x: solX2 + cCenter.x, y: solY2 + cCenter.y };

  if (type1 === 'line' || onSegment(intersect1, p1, p2)) points.push(intersect1);
  if (discriminant > 0.001) {
    if (type1 === 'line' || onSegment(intersect2, p1, p2)) points.push(intersect2);
  }

  return points;
};

const getCircleCircleIntersection = (
  c1Center: Point2D, c1RadiusPoint: Point2D,
  c2Center: Point2D, c2RadiusPoint: Point2D
): Point2D[] => {
  const r1 = distance(c1Center, c1RadiusPoint);
  const r2 = distance(c2Center, c2RadiusPoint);
  const d = distance(c1Center, c2Center);

  if (d > r1 + r2 || d < Math.abs(r1 - r2) || d === 0) return [];

  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));

  const x2 = c1Center.x + a * (c2Center.x - c1Center.x) / d;
  const y2 = c1Center.y + a * (c2Center.y - c1Center.y) / d;

  const intersect1 = {
    x: x2 + h * (c2Center.y - c1Center.y) / d,
    y: y2 - h * (c2Center.x - c1Center.x) / d
  };
  const intersect2 = {
    x: x2 - h * (c2Center.y - c1Center.y) / d,
    y: y2 + h * (c2Center.x - c1Center.x) / d
  };

  if (d === r1 + r2 || d === Math.abs(r1 - r2)) return [intersect1];
  return [intersect1, intersect2];
};

export const getAllIntersections = (
  shapes: GeometricShape[],
  points: Record<string, Point>
): Point2D[] => {
  const intersections: Point2D[] = [];

  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      const s1 = shapes[i];
      const s2 = shapes[j];
      const p1 = points[s1.p1];
      const p2 = points[s1.p2];
      const p3 = points[s2.p1];
      const p4 = points[s2.p2];

      if (!p1 || !p2 || !p3 || !p4) continue;

      let results: Point2D[] = [];

      if ((s1.type === 'line' || s1.type === 'segment') && (s2.type === 'line' || s2.type === 'segment')) {
        results = getLineIntersection(p1, p2, s1.type, p3, p4, s2.type);
      } else if ((s1.type === 'line' || s1.type === 'segment') && s2.type === 'circle') {
        results = getLineCircleIntersection(p1, p2, s1.type, p3, p4);
      } else if (s1.type === 'circle' && (s2.type === 'line' || s2.type === 'segment')) {
        results = getLineCircleIntersection(p3, p4, s2.type, p1, p2);
      } else if (s1.type === 'circle' && s2.type === 'circle') {
        results = getCircleCircleIntersection(p1, p2, p3, p4);
      }
      intersections.push(...results);
    }
  }
  return intersections;
};
