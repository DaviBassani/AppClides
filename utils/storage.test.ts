import { describe, expect, it } from 'vitest';
import { parseStoredState } from './storage';

const validState = () => ({
  workspaces: [{
    id: 'workspace-1',
    name: 'Board',
    createdAt: 1,
    points: {},
    shapes: [],
    texts: {}
  }],
  activeId: 'workspace-1'
});

describe('stored workspace validation', () => {
  it('accepts valid persisted state', () => {
    expect(parseStoredState(validState())).toEqual(validState());
  });

  it('falls back to the first workspace for an invalid active ID', () => {
    expect(parseStoredState({ ...validState(), activeId: '../../../etc/passwd' })?.activeId).toBe('workspace-1');
  });

  it('salvages valid data from malformed boards and drops invalid room IDs', () => {
    const malformedBoard = validState();
    malformedBoard.workspaces[0].points = { p1: { id: 'p1', x: Infinity, y: 0 } } as never;
    expect(parseStoredState(malformedBoard)?.workspaces[0].points).toEqual({});

    const malformedRoom = validState();
    (malformedRoom.workspaces[0] as typeof malformedRoom.workspaces[0] & { roomId: string }).roomId = '<script>';
    expect(parseStoredState(malformedRoom)?.workspaces[0].roomId).toBeUndefined();
  });

  it('preserves valid workspaces when another entry is corrupt', () => {
    const valid = validState().workspaces[0];
    const parsed = parseStoredState({
      workspaces: [{ id: '<invalid>', name: '', createdAt: 'never' }, valid],
      activeId: valid.id
    });
    expect(parsed?.workspaces).toEqual([valid]);
  });
});
