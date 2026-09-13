import { BoardState, GeometricShape, Point, TextLabel } from '../types';
export type { BoardState } from '../types';

const MAX_ID_LENGTH = 128;
export const MAX_OP_ENTITIES = 500;
export const MAX_OP_TEXT_SIZE = 50_000;
const MAX_BOARD_ENTITIES = 5_000;
const MAX_TEXT_LENGTH = 2_000;
const MAX_LABEL_LENGTH = 64;
export const MAX_PEER_NAME_LENGTH = 32;
const MAX_ABS_COORDINATE = 1_000_000_000;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const SAFE_ID = /^[A-Za-z0-9_-]+$/;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const SHAPE_TYPES = new Set(['segment', 'line', 'circle', 'ray']);
const OPS_KEYS = new Set([
  'pointsUpsert', 'pointsDelete', 'shapesUpsert',
  'shapesDelete', 'textsUpsert', 'textsDelete'
]);

export interface CollabOps {
  pointsUpsert?: Record<string, Point>;
  pointsDelete?: string[];
  shapesUpsert?: GeometricShape[];
  shapesDelete?: string[];
  textsUpsert?: Record<string, TextLabel>;
  textsDelete?: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export const isSafeId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH && SAFE_ID.test(value);

export const isSafeCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_ABS_COORDINATE;

const parseColor = (value: unknown) => value === undefined
  ? undefined
  : typeof value === 'string' && HEX_COLOR.test(value) ? value : null;

const parsePoint = (value: unknown): Point | null => {
  if (!isRecord(value) || !isSafeId(value.id) || !isSafeCoordinate(value.x) || !isSafeCoordinate(value.y)) return null;
  const label = value.label;
  if (label !== undefined && (typeof label !== 'string' || label.length > MAX_LABEL_LENGTH)) return null;
  const color = parseColor(value.color);
  if (color === null) return null;
  const point: Point = { id: value.id, x: value.x, y: value.y };
  if (typeof label === 'string') point.label = label;
  if (color !== undefined) point.color = color;
  return point;
};

const parseShape = (value: unknown): GeometricShape | null => {
  if (!isRecord(value) || !isSafeId(value.id) || !isSafeId(value.p1) || !isSafeId(value.p2)) return null;
  if (typeof value.type !== 'string' || !SHAPE_TYPES.has(value.type)) return null;
  const color = parseColor(value.color);
  if (color === null) return null;
  return {
    id: value.id,
    type: value.type as GeometricShape['type'],
    p1: value.p1,
    p2: value.p2,
    ...(color === undefined ? {} : { color })
  };
};

const parseText = (value: unknown): TextLabel | null => {
  if (!isRecord(value) || !isSafeId(value.id) || !isSafeCoordinate(value.x) || !isSafeCoordinate(value.y)) return null;
  if (typeof value.content !== 'string' || value.content.length > MAX_TEXT_LENGTH) return null;
  const color = parseColor(value.color);
  if (color === null) return null;
  return {
    id: value.id,
    x: value.x,
    y: value.y,
    content: value.content,
    ...(color === undefined ? {} : { color })
  };
};

const parseEntityRecord = <T>(value: unknown, limit: number, parser: (entry: unknown) => T | null): Record<string, T> | null => {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > limit) return null;
  const result: Record<string, T> = {};
  for (const [key, entry] of entries) {
    if (!isSafeId(key) || FORBIDDEN_KEYS.has(key)) return null;
    const parsed = parser(entry);
    if (!parsed || (parsed as { id?: string }).id !== key) return null;
    result[key] = parsed;
  }
  return result;
};

const parseIdArray = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || value.length > MAX_OP_ENTITIES || value.some(id => !isSafeId(id) || FORBIDDEN_KEYS.has(id))) return null;
  return Array.from(new Set(value));
};

export const parseCollabOps = (value: unknown): CollabOps | null => {
  if (!isRecord(value) || Object.keys(value).some(key => !OPS_KEYS.has(key))) return null;
  const ops: CollabOps = {};

  if (value.pointsUpsert !== undefined) {
    const parsed = parseEntityRecord(value.pointsUpsert, MAX_OP_ENTITIES, parsePoint);
    if (!parsed) return null;
    ops.pointsUpsert = parsed;
  }
  if (value.pointsDelete !== undefined) {
    const parsed = parseIdArray(value.pointsDelete);
    if (!parsed) return null;
    ops.pointsDelete = parsed;
  }
  if (value.shapesUpsert !== undefined) {
    if (!Array.isArray(value.shapesUpsert) || value.shapesUpsert.length > MAX_OP_ENTITIES) return null;
    const parsed = value.shapesUpsert.map(parseShape);
    if (parsed.some(shape => !shape)) return null;
    ops.shapesUpsert = parsed as GeometricShape[];
  }
  if (value.shapesDelete !== undefined) {
    const parsed = parseIdArray(value.shapesDelete);
    if (!parsed) return null;
    ops.shapesDelete = parsed;
  }
  if (value.textsUpsert !== undefined) {
    const parsed = parseEntityRecord(value.textsUpsert, MAX_OP_ENTITIES, parseText);
    if (!parsed) return null;
    ops.textsUpsert = parsed;
  }
  if (value.textsDelete !== undefined) {
    const parsed = parseIdArray(value.textsDelete);
    if (!parsed) return null;
    ops.textsDelete = parsed;
  }

  const total = Object.keys(ops.pointsUpsert || {}).length + (ops.pointsDelete?.length || 0) +
    (ops.shapesUpsert?.length || 0) + (ops.shapesDelete?.length || 0) +
    Object.keys(ops.textsUpsert || {}).length + (ops.textsDelete?.length || 0);
  const textSize = Object.values(ops.textsUpsert || {}).reduce((sum, text) => sum + text.content.length, 0);
  return total <= MAX_OP_ENTITIES && textSize <= MAX_OP_TEXT_SIZE ? ops : null;
};

export const parseBoardState = (value: unknown): BoardState | null => {
  if (!isRecord(value)) return null;
  const points = parseEntityRecord(value.points, MAX_BOARD_ENTITIES, parsePoint);
  const texts = parseEntityRecord(value.texts, MAX_BOARD_ENTITIES, parseText);
  if (!points || !texts || !Array.isArray(value.shapes) || value.shapes.length > MAX_BOARD_ENTITIES) return null;
  const shapes = value.shapes.map(parseShape);
  if (shapes.some(shape => !shape)) return null;
  const total = Object.keys(points).length + Object.keys(texts).length + shapes.length;
  const textSize = Object.values(texts).reduce((sum, text) => sum + text.content.length, 0);
  const parsedShapes = shapes as GeometricShape[];
  const hasMissingPoint = parsedShapes.some(shape => !points[shape.p1] || !points[shape.p2]);
  return total <= MAX_BOARD_ENTITIES && textSize <= 100_000 && !hasMissingPoint
    ? { points, texts, shapes: parsedShapes }
    : null;
};

// Local persistence is recovered defensively: invalid entities are dropped while
// valid work survives. Remote payloads use parseBoardState and remain all-or-nothing.
export const sanitizeBoardState = (value: unknown): BoardState | null => {
  if (!isRecord(value) || !isRecord(value.points) || !isRecord(value.texts) || !Array.isArray(value.shapes)) return null;
  const points: Record<string, Point> = {};
  const texts: Record<string, TextLabel> = {};
  const shapes: GeometricShape[] = [];
  let entityCount = 0;
  let textSize = 0;

  for (const [key, candidate] of Object.entries(value.points)) {
    if (entityCount >= MAX_BOARD_ENTITIES) break;
    const point = parsePoint(candidate);
    if (!isSafeId(key) || FORBIDDEN_KEYS.has(key) || !point || point.id !== key) continue;
    points[key] = point;
    entityCount++;
  }

  for (const [key, candidate] of Object.entries(value.texts)) {
    if (entityCount >= MAX_BOARD_ENTITIES) break;
    const text = parseText(candidate);
    if (!isSafeId(key) || FORBIDDEN_KEYS.has(key) || !text || text.id !== key) continue;
    if (textSize + text.content.length > 100_000) break;
    texts[key] = text;
    textSize += text.content.length;
    entityCount++;
  }

  for (const candidate of value.shapes) {
    if (entityCount >= MAX_BOARD_ENTITIES) break;
    const shape = parseShape(candidate);
    if (!shape || !points[shape.p1] || !points[shape.p2]) continue;
    shapes.push(shape);
    entityCount++;
  }

  return { points, shapes, texts };
};

export const sanitizePeer = (value: unknown): { id: string; name: string; color: string; cursor?: { x: number; y: number } | null } | null => {
  if (!isRecord(value) || !isSafeId(value.id) || typeof value.name !== 'string') return null;
  const name = value.name.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, MAX_PEER_NAME_LENGTH);
  const color = parseColor(value.color);
  if (!name || !color) return null;
  if (value.cursor === undefined || value.cursor === null) return { id: value.id, name, color, cursor: value.cursor as null | undefined };
  if (!isRecord(value.cursor) || !isSafeCoordinate(value.cursor.x) || !isSafeCoordinate(value.cursor.y)) return null;
  return { id: value.id, name, color, cursor: { x: value.cursor.x, y: value.cursor.y } };
};

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

export const splitCollabOps = (ops: CollabOps, limit = MAX_OP_ENTITIES): CollabOps[] => {
  if (limit < 1) throw new Error('Operation chunk limit must be positive');
  const chunks: CollabOps[] = [];
  let chunk: CollabOps = {};
  let size = 0;
  let textSize = 0;

  const ensureSpace = (additionalTextSize = 0) => {
    if (size < limit && (size === 0 || textSize + additionalTextSize <= MAX_OP_TEXT_SIZE)) return;
    chunks.push(chunk);
    chunk = {};
    size = 0;
    textSize = 0;
  };

  for (const [id, point] of Object.entries(ops.pointsUpsert || {})) {
    ensureSpace();
    (chunk.pointsUpsert ||= {})[id] = point;
    size++;
  }
  for (const id of ops.pointsDelete || []) {
    ensureSpace();
    (chunk.pointsDelete ||= []).push(id);
    size++;
  }
  for (const shape of ops.shapesUpsert || []) {
    ensureSpace();
    (chunk.shapesUpsert ||= []).push(shape);
    size++;
  }
  for (const id of ops.shapesDelete || []) {
    ensureSpace();
    (chunk.shapesDelete ||= []).push(id);
    size++;
  }
  for (const [id, text] of Object.entries(ops.textsUpsert || {})) {
    ensureSpace(text.content.length);
    (chunk.textsUpsert ||= {})[id] = text;
    size++;
    textSize += text.content.length;
  }
  for (const id of ops.textsDelete || []) {
    ensureSpace();
    (chunk.textsDelete ||= []).push(id);
    size++;
  }
  if (size > 0) chunks.push(chunk);
  return chunks;
};

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

  const validShapes = Array.from(shapes.values()).filter(shape => points[shape.p1] && points[shape.p2]);
  return { points, shapes: validShapes, texts };
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
