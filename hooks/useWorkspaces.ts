import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Workspace, Point, GeometricShape, TextLabel, BoardState } from '../types';
import { generateId } from '../utils/geometry';
import { storage } from '../utils/storage';
import { getBrowserLanguage, t } from '../utils/i18n';
import { applyBoardOps, diffBoards, type CollabOps } from '../services/collabProtocol';

const createNewWorkspace = (name: string, roomId?: string): Workspace => ({
  id: generateId(),
  name,
  points: {},
  shapes: [],
  texts: {},
  createdAt: Date.now(),
  roomId,
});

interface HistorySnapshot {
  points: Record<string, Point>;
  shapes: GeometricShape[];
  texts: Record<string, TextLabel>;
}

interface WorkspaceHistory {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
}

const resolveStateAction = <T>(action: React.SetStateAction<T>, current: T): T =>
  typeof action === 'function' ? (action as (previous: T) => T)(current) : action;

export const useWorkspaces = () => {
  const localOpsHandlerRef = useRef<((workspaceId: string, ops: CollabOps) => void) | null>(null);
  // --- State ---

  // Initialize state from storage or defaults
  const [workspaces, setWorkspacesState] = useState<Workspace[]>(() => {
    const saved = storage.load();
    if (saved && saved.workspaces.length > 0) {
      // Backwards compatibility: ensure 'texts' exists if loading old data
      return saved.workspaces.map(ws => ({
        ...ws,
        texts: ws.texts || {}
      }));
    }
    // Detect language for the very first workspace creation
    const lang = getBrowserLanguage();
    return [createNewWorkspace(`${t[lang].tabs.untitled} 1`)];
  });
  const workspacesRef = useRef(workspaces);
  const setWorkspaces = useCallback((action: React.SetStateAction<Workspace[]>) => {
    const next = typeof action === 'function'
      ? (action as (previous: Workspace[]) => Workspace[])(workspacesRef.current)
      : action;
    workspacesRef.current = next;
    setWorkspacesState(next);
  }, []);

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
  const saveSnapshot = useCallback((wsId: string, currentPoints: Record<string, Point>, currentShapes: GeometricShape[], currentTexts: Record<string, TextLabel>) => {
    setHistory(prev => {
      const wsHistory = prev[wsId] || { past: [], future: [] };
      // Limit history size to 50 steps to prevent memory issues
      const newPast = [...wsHistory.past, { points: currentPoints, shapes: currentShapes, texts: currentTexts }].slice(-50);
      return {
        ...prev,
        [wsId]: {
          past: newPast,
          future: [] // Clear future when a new action is taken
        }
      };
    });
  }, []);

  const setLocalOpsHandler = useCallback((handler: ((workspaceId: string, ops: CollabOps) => void) | null) => {
    localOpsHandlerRef.current = handler;
  }, []);

  const emitLocalChange = useCallback((workspaceId: string, previous: BoardState, current: BoardState) => {
    const ops = diffBoards(previous, current);
    localOpsHandlerRef.current?.(workspaceId, ops);
  }, []);

  // --- Actions ---

  const undo = useCallback(() => {
    // Use activeWorkspace.id to ensure we operate on the visible workspace
    const targetId = activeWorkspace.id;
    const currentWorkspace = workspacesRef.current.find(ws => ws.id === targetId) || activeWorkspace;
    const wsHistory = getHistory(targetId);
    
    if (wsHistory.past.length === 0) return;

    const previous = wsHistory.past[wsHistory.past.length - 1];
    const newPast = wsHistory.past.slice(0, -1);

    // Save current state to future
    const currentSnapshot: HistorySnapshot = { 
      points: currentWorkspace.points,
      shapes: currentWorkspace.shapes,
      texts: currentWorkspace.texts
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
      return { ...ws, points: previous.points, shapes: previous.shapes, texts: previous.texts };
    }));

    emitLocalChange(targetId, currentSnapshot, previous);
  }, [activeWorkspace, getHistory, emitLocalChange]);

  const redo = useCallback(() => {
    const targetId = activeWorkspace.id;
    const currentWorkspace = workspacesRef.current.find(ws => ws.id === targetId) || activeWorkspace;
    const wsHistory = getHistory(targetId);
    
    if (wsHistory.future.length === 0) return;

    const next = wsHistory.future[0];
    const newFuture = wsHistory.future.slice(1);

    // Save current state to past
    const currentSnapshot: HistorySnapshot = { 
      points: currentWorkspace.points,
      shapes: currentWorkspace.shapes,
      texts: currentWorkspace.texts
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
      return { ...ws, points: next.points, shapes: next.shapes, texts: next.texts };
    }));

    emitLocalChange(targetId, currentSnapshot, next);
  }, [activeWorkspace, getHistory, emitLocalChange]);

  // --- State Modifiers (Wrapped to support Undo) ---

  const updateBoard = useCallback((action: React.SetStateAction<BoardState>) => {
    const targetId = activeWorkspace.id;
    const currentWorkspace = workspacesRef.current.find(ws => ws.id === targetId) || activeWorkspace;
    const current: BoardState = {
      points: currentWorkspace.points,
      shapes: currentWorkspace.shapes,
      texts: currentWorkspace.texts
    };
    const next = resolveStateAction(action, current);
    if (current.points === next.points && current.shapes === next.shapes && current.texts === next.texts) return;

    saveSnapshot(targetId, current.points, current.shapes, current.texts);
    setWorkspaces(prev => prev.map(ws => ws.id === targetId ? { ...ws, ...next } : ws));
    emitLocalChange(targetId, current, next);
  }, [activeWorkspace, saveSnapshot, emitLocalChange]);

  const updatePoints = useCallback((action: React.SetStateAction<Record<string, Point>>) => {
    updateBoard(current => ({ ...current, points: resolveStateAction(action, current.points) }));
  }, [updateBoard]);

  const updateShapes = useCallback((action: React.SetStateAction<GeometricShape[]>) => {
    updateBoard(current => ({ ...current, shapes: resolveStateAction(action, current.shapes) }));
  }, [updateBoard]);

  const updateTexts = useCallback((action: React.SetStateAction<Record<string, TextLabel>>) => {
    updateBoard(current => ({ ...current, texts: resolveStateAction(action, current.texts) }));
  }, [updateBoard]);

  const clearActiveWorkspace = useCallback(() => {
    const targetId = activeWorkspace.id;
    const currentWorkspace = workspacesRef.current.find(ws => ws.id === targetId) || activeWorkspace;
    
    // Check if already empty
    const isEmpty = Object.keys(currentWorkspace.points).length === 0 && currentWorkspace.shapes.length === 0 && Object.keys(currentWorkspace.texts || {}).length === 0;
    if (isEmpty) return;

    saveSnapshot(targetId, currentWorkspace.points, currentWorkspace.shapes, currentWorkspace.texts);

    const cleared: BoardState = { points: {}, shapes: [], texts: {} };

    setWorkspaces(prev => prev.map(ws => {
      if (ws.id !== targetId) return ws;
      return { ...ws, ...cleared };
    }));

    emitLocalChange(targetId, currentWorkspace, cleared);
  }, [activeWorkspace, saveSnapshot, emitLocalChange]);

  const deleteSelection = useCallback((selectedIds: string[]) => {
    if (selectedIds.length === 0) return;
    const targetId = activeWorkspace.id;
    const currentWorkspace = workspacesRef.current.find(ws => ws.id === targetId) || activeWorkspace;
    const shapesToDelete = new Set<string>();
    const pointsToDelete = new Set<string>();
    const textsToDelete = new Set<string>();

    selectedIds.forEach(id => {
      if (currentWorkspace.points[id]) pointsToDelete.add(id);
      if (currentWorkspace.texts?.[id]) textsToDelete.add(id);
      if (currentWorkspace.shapes.some(shape => shape.id === id)) shapesToDelete.add(id);
    });

    currentWorkspace.shapes.forEach(shape => {
      if (pointsToDelete.has(shape.p1) || pointsToDelete.has(shape.p2)) shapesToDelete.add(shape.id);
    });

    const points = { ...currentWorkspace.points };
    pointsToDelete.forEach(id => delete points[id]);
    const texts = { ...currentWorkspace.texts };
    textsToDelete.forEach(id => delete texts[id]);
    const next: BoardState = {
      points,
      shapes: currentWorkspace.shapes.filter(shape => !shapesToDelete.has(shape.id)),
      texts
    };

    saveSnapshot(targetId, currentWorkspace.points, currentWorkspace.shapes, currentWorkspace.texts);
    setWorkspaces(prev => prev.map(ws => ws.id === targetId ? { ...ws, ...next } : ws));
    emitLocalChange(targetId, currentWorkspace, next);
  }, [activeWorkspace, saveSnapshot, emitLocalChange]);

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

  const setWorkspaceRoom = useCallback((workspaceId: string, roomId: string | null) => {
    setWorkspaces(prev => prev.map(ws =>
      ws.id === workspaceId ? { ...ws, roomId: roomId || undefined } : ws
    ));
  }, []);

  const joinRoom = useCallback((roomId: string, defaultName: string) => {
    const existing = workspaces.find(ws => ws.roomId === roomId);
    if (existing) {
      setActiveWorkspaceId(existing.id);
      return;
    }

    const canReuseActive = !activeWorkspace.roomId &&
      Object.keys(activeWorkspace.points).length === 0 &&
      activeWorkspace.shapes.length === 0 &&
      Object.keys(activeWorkspace.texts || {}).length === 0;

    if (canReuseActive) {
      setWorkspaceRoom(activeWorkspace.id, roomId);
      return;
    }

    const sharedWorkspace = createNewWorkspace(defaultName, roomId);
    setWorkspaces(prev => [...prev, sharedWorkspace]);
    setActiveWorkspaceId(sharedWorkspace.id);
  }, [workspaces, activeWorkspace, setWorkspaceRoom]);

  const applyRemoteOpsToRoom = useCallback((roomId: string, ops: CollabOps) => {
    const workspace = workspacesRef.current.find(ws => ws.roomId === roomId);
    if (!workspace) return;

    setWorkspaces(prev => prev.map(ws =>
      ws.id === workspace.id ? { ...ws, ...applyBoardOps(ws, ops) } : ws
    ));
    // Rebase remote changes through local history so undo never deletes peer work.
    setHistory(prev => {
      const current = prev[workspace.id];
      if (!current) return prev;
      return {
        ...prev,
        [workspace.id]: {
          past: current.past.map(snapshot => applyBoardOps(snapshot, ops)),
          future: current.future.map(snapshot => applyBoardOps(snapshot, ops))
        }
      };
    });
  }, []);

  const applyRemoteStateToRoom = useCallback((roomId: string, state: BoardState) => {
    const workspace = workspacesRef.current.find(ws => ws.roomId === roomId);
    if (!workspace) return;
    setWorkspaces(prev => prev.map(ws => ws.id === workspace.id ? { ...ws, ...state } : ws));
    // A full snapshot has no safe inverse relative to existing local history.
    setHistory(prev => ({ ...prev, [workspace.id]: { past: [], future: [] } }));
  }, []);

  return {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    setActiveWorkspaceId,
    addWorkspace,
    removeWorkspace,
    renameWorkspace,
    updatePoints,
    updateShapes,
    updateTexts,
    updateBoard,
    setLocalOpsHandler,
    setWorkspaceRoom,
    joinRoom,
    applyRemoteOpsToRoom,
    applyRemoteStateToRoom,
    clearActiveWorkspace,
    deleteSelection,
    undo,
    redo,
    canUndo: (history[activeWorkspace.id]?.past.length || 0) > 0,
    canRedo: (history[activeWorkspace.id]?.future.length || 0) > 0
  };
};
