import { describe, expect, it } from 'vitest';
import { applyBoardOps, diffBoards, isEmptyOps, mergeOps, type BoardState } from './collabProtocol';

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
});
