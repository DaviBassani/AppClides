import { GeometricShape, Point, TextLabel } from '../types';

export interface BoardState {
  points: Record<string, Point>;
  shapes: GeometricShape[];
  texts: Record<string, TextLabel>;
}

export interface CollabOps {
  pointsUpsert?: Record<string, Point>;
  pointsDelete?: string[];
  shapesUpsert?: GeometricShape[];
  shapesDelete?: string[];
  textsUpsert?: Record<string, TextLabel>;
  textsDelete?: string[];
}

const pointEquals = (a: Point | undefined, b: Point) =>
  !!a && a.x === b.x && a.y === b.y && a.label === b.label && a.color === b.color;

const shapeEquals = (a: GeometricShape | undefined, b: GeometricShape) =>
  !!a && a.type === b.type && a.p1 === b.p1 && a.p2 === b.p2 && a.color === b.color;

const textEquals = (a: TextLabel | undefined, b: TextLabel) =>
  !!a && a.x === b.x && a.y === b.y && a.content === b.content && a.color === b.color;

export const isEmptyOps = (ops: CollabOps) =>
  !ops.pointsUpsert && !ops.pointsDelete &&
  !ops.shapesUpsert && !ops.shapesDelete &&
  !ops.textsUpsert && !ops.textsDelete;

export const diffBoards = (previous: BoardState, current: BoardState): CollabOps => {
  const ops: CollabOps = {};

  const pointsUpsert = Object.fromEntries(
    Object.entries(current.points).filter(([id, point]) => !pointEquals(previous.points[id], point))
  );
  const pointsDelete = Object.keys(previous.points).filter(id => !current.points[id]);
  if (Object.keys(pointsUpsert).length) ops.pointsUpsert = pointsUpsert;
  if (pointsDelete.length) ops.pointsDelete = pointsDelete;

  const previousShapes = new Map(previous.shapes.map(shape => [shape.id, shape]));
  const currentShapeIds = new Set(current.shapes.map(shape => shape.id));
  const shapesUpsert = current.shapes.filter(shape => !shapeEquals(previousShapes.get(shape.id), shape));
  const shapesDelete = previous.shapes.filter(shape => !currentShapeIds.has(shape.id)).map(shape => shape.id);
  if (shapesUpsert.length) ops.shapesUpsert = shapesUpsert;
  if (shapesDelete.length) ops.shapesDelete = shapesDelete;

  const textsUpsert = Object.fromEntries(
    Object.entries(current.texts).filter(([id, text]) => !textEquals(previous.texts[id], text))
  );
  const textsDelete = Object.keys(previous.texts).filter(id => !current.texts[id]);
  if (Object.keys(textsUpsert).length) ops.textsUpsert = textsUpsert;
  if (textsDelete.length) ops.textsDelete = textsDelete;

  return ops;
};

export const applyBoardOps = (current: BoardState, ops: CollabOps): BoardState => {
  const points = { ...current.points, ...(ops.pointsUpsert || {}) };
  ops.pointsDelete?.forEach(id => delete points[id]);

  const shapes = new Map(current.shapes.map(shape => [shape.id, shape]));
  ops.shapesUpsert?.forEach(shape => shapes.set(shape.id, shape));
  ops.shapesDelete?.forEach(id => shapes.delete(id));

  const texts = { ...current.texts, ...(ops.textsUpsert || {}) };
  ops.textsDelete?.forEach(id => delete texts[id]);

  return { points, shapes: Array.from(shapes.values()), texts };
};

export const mergeOps = (current: CollabOps, incoming: CollabOps): CollabOps => {
  const next: CollabOps = {
    pointsUpsert: { ...(current.pointsUpsert || {}) },
    pointsDelete: [...(current.pointsDelete || [])],
    shapesUpsert: [...(current.shapesUpsert || [])],
    shapesDelete: [...(current.shapesDelete || [])],
    textsUpsert: { ...(current.textsUpsert || {}) },
    textsDelete: [...(current.textsDelete || [])]
  };

  const pointDeletes = new Set(next.pointsDelete);
  incoming.pointsDelete?.forEach(id => {
    pointDeletes.add(id);
    delete next.pointsUpsert![id];
  });
  Object.entries(incoming.pointsUpsert || {}).forEach(([id, point]) => {
    next.pointsUpsert![id] = point;
    pointDeletes.delete(id);
  });
  next.pointsDelete = Array.from(pointDeletes);

  const shapeUpserts = new Map(next.shapesUpsert!.map(shape => [shape.id, shape]));
  const shapeDeletes = new Set(next.shapesDelete);
  incoming.shapesDelete?.forEach(id => {
    shapeDeletes.add(id);
    shapeUpserts.delete(id);
  });
  incoming.shapesUpsert?.forEach(shape => {
    shapeUpserts.set(shape.id, shape);
    shapeDeletes.delete(shape.id);
  });
  next.shapesUpsert = Array.from(shapeUpserts.values());
  next.shapesDelete = Array.from(shapeDeletes);

  const textDeletes = new Set(next.textsDelete);
  incoming.textsDelete?.forEach(id => {
    textDeletes.add(id);
    delete next.textsUpsert![id];
  });
  Object.entries(incoming.textsUpsert || {}).forEach(([id, text]) => {
    next.textsUpsert![id] = text;
    textDeletes.delete(id);
  });
  next.textsDelete = Array.from(textDeletes);

  if (!Object.keys(next.pointsUpsert!).length) delete next.pointsUpsert;
  if (!next.pointsDelete.length) delete next.pointsDelete;
  if (!next.shapesUpsert.length) delete next.shapesUpsert;
  if (!next.shapesDelete.length) delete next.shapesDelete;
  if (!Object.keys(next.textsUpsert!).length) delete next.textsUpsert;
  if (!next.textsDelete.length) delete next.textsDelete;

  return next;
};
