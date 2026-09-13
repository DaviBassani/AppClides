import { Workspace } from '../types';
import { isSafeId, sanitizeBoardState } from '../services/collabProtocol';

const STORAGE_KEY = 'euclides_workspaces_v1';
const MAX_WORKSPACES = 50;
const MAX_WORKSPACE_NAME_LENGTH = 100;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const parseStoredState = (value: unknown): { workspaces: Workspace[]; activeId: string } | null => {
  if (!isRecord(value) || !Array.isArray(value.workspaces) || value.workspaces.length === 0 || value.workspaces.length > MAX_WORKSPACES) return null;

  const workspaces: Workspace[] = [];
  for (const candidate of value.workspaces) {
    if (!isRecord(candidate) || !isSafeId(candidate.id)) continue;
    if (typeof candidate.name !== 'string' || !candidate.name.trim() || candidate.name.length > MAX_WORKSPACE_NAME_LENGTH) continue;
    if (typeof candidate.createdAt !== 'number' || !Number.isFinite(candidate.createdAt)) continue;
    const board = sanitizeBoardState({ points: candidate.points, shapes: candidate.shapes, texts: candidate.texts || {} });
    if (!board) continue;
    const roomId = candidate.roomId !== undefined && isSafeId(candidate.roomId) && candidate.roomId.length >= 8
      ? candidate.roomId
      : undefined;
    workspaces.push({
      id: candidate.id,
      name: candidate.name,
      createdAt: candidate.createdAt,
      ...(roomId === undefined ? {} : { roomId }),
      ...board
    });
  }

  if (workspaces.length === 0) return null;

  const activeId = isSafeId(value.activeId) && workspaces.some(workspace => workspace.id === value.activeId)
    ? value.activeId
    : workspaces[0].id;
  return { workspaces, activeId };
};

export const storage = {
  save: (workspaces: Workspace[], activeId: string) => {
    try {
      const data = JSON.stringify({ workspaces, activeId });
      localStorage.setItem(STORAGE_KEY, data);
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  },

  load: (): { workspaces: Workspace[]; activeId: string } | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return parseStoredState(JSON.parse(raw));
    } catch (e) {
      console.warn('Failed to load from localStorage:', e);
      return null;
    }
  },

  clear: () => {
    localStorage.removeItem(STORAGE_KEY);
  }
};
