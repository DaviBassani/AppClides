import type { BoardState, GeometricShape, Point, TextLabel } from '../types';
import { isSafeCoordinate, isSafeId } from './collabProtocol';
import type { GeminiFunctionCall } from './gemini';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const optionalColor = (value: unknown) =>
  typeof value === 'string' && HEX_COLOR.test(value) ? value : undefined;

export const applyGeminiFunctionCalls = (
  current: BoardState,
  functionCalls: GeminiFunctionCall[],
  createId: () => string
): BoardState => {
  const idMap: Record<string, string> = Object.create(null);
  const newPoints: Record<string, Point> = {};
  const newShapes: GeometricShape[] = [];
  const newTexts: Record<string, TextLabel> = {};
  let shouldClear = false;

  for (const call of functionCalls) {
    const args = call.args;
    if (call.name === 'clear_board') shouldClear = true;

    if (call.name === 'create_point') {
      const x = Number(args.x);
      const y = Number(args.y);
      if (!isSafeId(args.id) || !isSafeCoordinate(x) || !isSafeCoordinate(y)) continue;
      const realId = createId();
      idMap[args.id] = realId;
      newPoints[realId] = {
        id: realId,
        x,
        y,
        label: typeof args.label === 'string' ? args.label.slice(0, 64) : '',
        color: optionalColor(args.color)
      };
    }

    if (call.name === 'create_text') {
      const x = Number(args.x);
      const y = Number(args.y);
      if (!isSafeCoordinate(x) || !isSafeCoordinate(y) || typeof args.content !== 'string') continue;
      const realId = createId();
      newTexts[realId] = { id: realId, x, y, content: args.content.slice(0, 2_000) };
    }
  }

  const availablePointIds = new Set([
    ...(shouldClear ? [] : Object.keys(current.points)),
    ...Object.keys(newPoints)
  ]);

  for (const call of functionCalls) {
    if (call.name !== 'create_shape') continue;
    const args = call.args;
    if (!isSafeId(args.p1_id) || !isSafeId(args.p2_id)) continue;
    if (args.type !== 'segment' && args.type !== 'line' && args.type !== 'ray' && args.type !== 'circle') continue;
    const p1 = idMap[args.p1_id] || args.p1_id;
    const p2 = idMap[args.p2_id] || args.p2_id;
    if (!availablePointIds.has(p1) || !availablePointIds.has(p2)) continue;
    newShapes.push({ id: createId(), type: args.type, p1, p2, color: optionalColor(args.color) });
  }

  if (shouldClear) return { points: newPoints, shapes: newShapes, texts: newTexts };
  if (Object.keys(newPoints).length === 0 && newShapes.length === 0 && Object.keys(newTexts).length === 0) return current;
  return {
    points: { ...current.points, ...newPoints },
    shapes: [...current.shapes, ...newShapes],
    texts: { ...current.texts, ...newTexts }
  };
};
