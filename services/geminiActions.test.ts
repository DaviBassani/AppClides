import { describe, expect, it } from 'vitest';
import { applyGeminiFunctionCalls } from './geminiActions';

const emptyBoard = () => ({ points: {}, shapes: [], texts: {} });
const ids = () => {
  let index = 0;
  return () => `generated-${++index}`;
};

describe('Gemini board actions', () => {
  it('creates referenced points before shapes in one result', () => {
    const result = applyGeminiFunctionCalls(emptyBoard(), [
      { name: 'create_shape', args: { type: 'segment', p1_id: 'a', p2_id: 'b' } },
      { name: 'create_point', args: { id: 'a', x: 0, y: 0 } },
      { name: 'create_point', args: { id: 'b', x: 10, y: 10 } }
    ], ids());
    expect(Object.keys(result.points)).toHaveLength(2);
    expect(result.shapes).toHaveLength(1);
  });

  it('drops dangling shapes and unsafe coordinates', () => {
    const current = emptyBoard();
    const result = applyGeminiFunctionCalls(current, [
      { name: 'create_point', args: { id: 'unsafe', x: 1e300, y: 0 } },
      { name: 'create_shape', args: { type: 'line', p1_id: 'missing', p2_id: 'unsafe' } }
    ], ids());
    expect(result).toBe(current);
  });

  it('does not carry old references through clear_board', () => {
    const current = {
      points: { old: { id: 'old', x: 0, y: 0 } },
      shapes: [],
      texts: {}
    };
    const result = applyGeminiFunctionCalls(current, [
      { name: 'clear_board', args: {} },
      { name: 'create_shape', args: { type: 'line', p1_id: 'old', p2_id: 'old' } }
    ], ids());
    expect(result).toEqual(emptyBoard());
  });
});
