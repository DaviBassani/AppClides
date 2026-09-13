import { describe, expect, it } from 'vitest';
import {
  applyBoardOps,
  diffBoards,
  isEmptyOps,
  mergeOps,
  parseBoardState,
  parseCollabOps,
  sanitizePeer,
  splitCollabOps,
  type BoardState
} from './collabProtocol';

const emptyBoard = (): BoardState => ({ points: {}, shapes: [], texts: {} });

describe('collaboration protocol', () => {
  it('emits only changed entities', () => {
    const previous = emptyBoard();
    const current: BoardState = {
      points: { p1: { id: 'p1', x: 10, y: 20 } },
      shapes: [],
      texts: {}
    };

    expect(diffBoards(previous, current)).toEqual({ pointsUpsert: current.points });
  });

  it('does not echo a remote operation after applying it', () => {
    const previous = emptyBoard();
    const ops = { pointsUpsert: { p1: { id: 'p1', x: 10, y: 20 } } };
    const applied = applyBoardOps(previous, ops);

    expect(isEmptyOps(diffBoards(applied, applied))).toBe(true);
  });

  it('coalesces repeated cursor-adjacent board updates to the latest value', () => {
    const first = { pointsUpsert: { p1: { id: 'p1', x: 10, y: 20 } } };
    const second = { pointsUpsert: { p1: { id: 'p1', x: 30, y: 40 } } };

    expect(mergeOps(first, second)).toEqual({ pointsUpsert: second.pointsUpsert });
  });

  it('lets a later deletion override a pending upsert', () => {
    const pending = { pointsUpsert: { p1: { id: 'p1', x: 10, y: 20 } } };

    expect(mergeOps(pending, { pointsDelete: ['p1'] })).toEqual({ pointsDelete: ['p1'] });
  });

  it('rejects malformed or non-finite remote operations', () => {
    expect(parseCollabOps({ shapesUpsert: { id: 'shape' } })).toBeNull();
    expect(parseCollabOps({ pointsUpsert: { p1: { id: 'p1', x: Infinity, y: 0 } } })).toBeNull();
    expect(parseCollabOps({ unknownField: [] })).toBeNull();
  });

  it('rejects prototype keys and oversized text operations', () => {
    const polluted = JSON.parse('{"pointsUpsert":{"__proto__":{"id":"__proto__","x":0,"y":0}}}');
    expect(parseCollabOps(polluted)).toBeNull();
    expect(parseCollabOps({
      textsUpsert: Object.fromEntries(Array.from({ length: 30 }, (_, index) => [
        `t${index}`,
        { id: `t${index}`, x: 0, y: 0, content: 'x'.repeat(2_000) }
      ]))
    })).toBeNull();
  });

  it('validates full states and point references', () => {
    expect(parseBoardState({ points: {}, texts: {}, shapes: [{ id: 's1', type: 'line', p1: 'p1', p2: 'p2' }] })).toBeNull();
    expect(parseBoardState(emptyBoard())).toEqual(emptyBoard());
  });

  it('does not apply remote shapes with missing point references', () => {
    const result = applyBoardOps(emptyBoard(), {
      shapesUpsert: [{ id: 's1', type: 'line', p1: 'missing-1', p2: 'missing-2' }]
    });
    expect(result.shapes).toEqual([]);
  });

  it('sanitizes peer names and rejects unsafe colors', () => {
    expect(sanitizePeer({ id: 'peer-123', name: '  Davi\u0000 Bassani  ', color: '#3b82f6' })).toEqual({
      id: 'peer-123',
      name: 'Davi Bassani',
      color: '#3b82f6',
      cursor: undefined
    });
    expect(sanitizePeer({ id: 'peer-123', name: 'Davi', color: 'javascript:alert(1)' })).toBeNull();
  });

  it('chunks large operations without dropping entities', () => {
    const ops = { pointsDelete: Array.from({ length: 1_201 }, (_, index) => `p${index}`) };
    const chunks = splitCollabOps(ops);

    expect(chunks).toHaveLength(3);
    expect(chunks.flatMap(chunk => chunk.pointsDelete || [])).toEqual(ops.pointsDelete);
    expect(chunks.every(chunk => parseCollabOps(chunk) !== null)).toBe(true);
  });
});
