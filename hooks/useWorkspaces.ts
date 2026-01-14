import React, { useState, useEffect, useCallback } from 'react';
import { Workspace, Point, GeometricShape } from '../types';
import { generateId } from '../utils/geometry';
import { storage } from '../utils/storage';
import { getBrowserLanguage, t } from '../utils/i18n';

const createNewWorkspace = (name: string): Workspace => ({
  id: generateId(),
  name,
  points: {},
  shapes: [],
  createdAt: Date.now(),
});

interface HistorySnapshot {
  points: Record<string, Point>;
  shapes: GeometricShape[];
}

interface WorkspaceHistory {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
}

export const useWorkspaces = () => {
  // --- State ---

  // Initialize state from storage or defaults
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => {
    const saved = storage.load();
    if (saved && saved.workspaces.length > 0) {
      return saved.workspaces;
    }
    // Detect language for the very first workspace creation
    const lang = getBrowserLanguage();
    return [createNewWorkspace(`${t[lang].tabs.untitled} 1`)];
  });

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => {
    const saved = storage.load();
    if (saved && saved.activeId) {
      const exists = saved.workspaces.some(w => w.id === saved.activeId);
      if (exists) return saved.activeId;
    }
    return workspaces[0]?.id || ''; 
  });

  // History state (Runtime only, not persisted to localStorage to save space)
  const [history, setHistory] = useState<Record<string, WorkspaceHistory>>({});

  // Computed Active Workspace
  // Fallback to first workspace if ID is invalid guarantees we always have a workspace
  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];

  // --- Persistence Effect ---
  useEffect(() => {
    storage.save(workspaces, activeWorkspaceId);
  }, [workspaces, activeWorkspaceId]);

  // --- History Helpers ---

  // Ensures history object exists for the current workspace
  const getHistory = useCallback((wsId: string) => {
    return history[wsId] || { past: [], future: [] };
  }, [history]);

  // Push current state to 'past' before making changes
  const saveSnapshot = useCallback((wsId: string, currentPoints: Record<string, Point>, currentShapes: GeometricShape[]) => {
    setHistory(prev => {
      const wsHistory = prev[wsId] || { past: [], future: [] };
      // Limit history size to 50 steps to prevent memory issues
      const newPast = [...wsHistory.past, { points: currentPoints, shapes: currentShapes }].slice(-50);
      return {
        ...prev,
        [wsId]: {
          past: newPast,
          future: [] // Clear future when a new action is taken
        }
      };
    });
  }, []);

  // --- Actions ---

  const undo = useCallback(() => {
    // Use activeWorkspace.id to ensure we operate on the visible workspace
    const targetId = activeWorkspace.id;
    const wsHistory = getHistory(targetId);
    
    if (wsHistory.past.length === 0) return;

    const previous = wsHistory.past[wsHistory.past.length - 1];
    const newPast = wsHistory.past.slice(0, -1);

    // Save current state to future
    const currentSnapshot: HistorySnapshot = { 
      points: activeWorkspace.points, 
      shapes: activeWorkspace.shapes 
    };

    setHistory(prev => ({
      ...prev,
      [targetId]: {
        past: newPast,
        future: [currentSnapshot, ...wsHistory.future]
      }
    }));

    // Apply previous state
    setWorkspaces(prev => prev.map(ws => {
      if (ws.id !== targetId) return ws;
      return { ...ws, points: previous.points, shapes: previous.shapes };
    }));
  }, [activeWorkspace, getHistory]);

  const redo = useCallback(() => {
    const targetId = activeWorkspace.id;
    const wsHistory = getHistory(targetId);
    
    if (wsHistory.future.length === 0) return;

    const next = wsHistory.future[0];
    const newFuture = wsHistory.future.slice(1);

    // Save current state to past
    const currentSnapshot: HistorySnapshot = { 
      points: activeWorkspace.points, 
      shapes: activeWorkspace.shapes 
    };

    setHistory(prev => ({
      ...prev,
      [targetId]: {
        past: [...wsHistory.past, currentSnapshot],
        future: newFuture
      }
    }));

    // Apply next state
    setWorkspaces(prev => prev.map(ws => {
      if (ws.id !== targetId) return ws;
      return { ...ws, points: next.points, shapes: next.shapes };
    }));
  }, [activeWorkspace, getHistory]);

  // --- State Modifiers (Wrapped to support Undo) ---

  const updatePoints = useCallback((action: React.SetStateAction<Record<string, Point>>) => {
    const targetId = activeWorkspace.id;
    
    // 1. Calculate new state
    const currentPoints = activeWorkspace.points;
    const newPoints = typeof action === 'function' ? (action as Function)(currentPoints) : action;

    // If no change, do nothing
    if (currentPoints === newPoints) return;

    // 2. Save snapshot of OLD state
    saveSnapshot(targetId, currentPoints, activeWorkspace.shapes);

    // 3. Update state
    setWorkspaces(prev => prev.map(ws => {
      if (ws.id !== targetId) return ws;
      return { ...ws, points: newPoints };
    }));
  }, [activeWorkspace, saveSnapshot]);

  const updateShapes = useCallback((action: React.SetStateAction<GeometricShape[]>) => {
    const targetId = activeWorkspace.id;

    // 1. Calculate new state
    const currentShapes = activeWorkspace.shapes;
    const newShapes = typeof action === 'function' ? (action as Function)(currentShapes) : action;

    if (currentShapes === newShapes) return;

    // 2. Save snapshot of OLD state
    saveSnapshot(targetId, activeWorkspace.points, currentShapes);

    // 3. Update state
    setWorkspaces(prev => prev.map(ws => {
      if (ws.id !== targetId) return ws;
      return { ...ws, shapes: newShapes };
    }));
  }, [activeWorkspace, saveSnapshot]);

  const clearActiveWorkspace = useCallback(() => {
    const targetId = activeWorkspace.id;
    
    // Check if already empty to avoid redundant history entries
    const isEmpty = Object.keys(activeWorkspace.points).length === 0 && activeWorkspace.shapes.length === 0;
    if (isEmpty) return;

    // Save snapshot before clearing
    saveSnapshot(targetId, activeWorkspace.points, activeWorkspace.shapes);

    setWorkspaces(prev => prev.map(ws => {
      if (ws.id !== targetId) return ws;
      return { ...ws, points: {}, shapes: [] };
    }));
  }, [activeWorkspace, saveSnapshot]);

  // --- Workspace Management ---

  const addWorkspace = useCallback((defaultName?: string) => {
    const name = defaultName || `Untitled ${workspaces.length + 1}`;
    const newWs = createNewWorkspace(name);
    setWorkspaces(prev => [...prev, newWs]);
    setActiveWorkspaceId(newWs.id);
  }, [workspaces.length]);

  const removeWorkspace = useCallback((id: string) => {
    if (workspaces.length <= 1) return;
    
    setWorkspaces(prev => prev.filter(w => w.id !== id));
    
    // Also clean up history
    setHistory(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
    });

    if (activeWorkspaceId === id) {
      const index = workspaces.findIndex(w => w.id === id);
      const nextWs = workspaces[index - 1] || workspaces[index + 1];
      if (nextWs) setActiveWorkspaceId(nextWs.id);
    }
  }, [workspaces, activeWorkspaceId]);

  const renameWorkspace = useCallback((id: string, newName: string) => {
    setWorkspaces(prev => prev.map(ws => ws.id === id ? { ...ws, name: newName } : ws));
  }, []);

  return {
    workspaces,
    activeWorkspaceId,
    activeWorkspace, // Make sure to consume activeWorkspace from the hook to get the fallback
    setActiveWorkspaceId,
    addWorkspace,
    removeWorkspace,
    renameWorkspace,
    updatePoints,
    updateShapes,
    clearActiveWorkspace,
    undo,
    redo,
    // Use targetId to check history availability
    canUndo: (history[activeWorkspace.id]?.past.length || 0) > 0,
    canRedo: (history[activeWorkspace.id]?.future.length || 0) > 0
  };
};