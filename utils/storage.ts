import { Workspace } from '../types';

const STORAGE_KEY = 'euclides_workspaces_v1';

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
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Failed to load from localStorage:', e);
      return null;
    }
  },

  clear: () => {
    localStorage.removeItem(STORAGE_KEY);
  }
};