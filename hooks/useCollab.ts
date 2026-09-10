import { useEffect, useRef, useState, useCallback } from 'react';
import { CollabSession, CollabOps, PeerPresence, getRoomFromUrl, setRoomInUrl } from '../services/collab';
import { Workspace, Point, GeometricShape, TextLabel } from '../types';
import { t, Language } from '../utils/i18n';

interface UseCollabProps {
  activeWorkspace: Workspace;
  updatePoints: (action: React.SetStateAction<Record<string, Point>>) => void;
  updateShapes: (action: React.SetStateAction<GeometricShape[]>) => void;
  updateTexts: (action: React.SetStateAction<Record<string, TextLabel>>) => void;
  applyRemoteOps: (apply: (ref: React.MutableRefObject<boolean>) => void) => void;
  cursorWorld: { x: number; y: number } | null;
  lang: Language;
}

interface PeerWithWorkspace extends PeerPresence {
  isLocal: boolean;
}

export const useCollab = ({
  activeWorkspace,
  updatePoints,
  updateShapes,
  updateTexts,
  applyRemoteOps,
  cursorWorld,
  lang
}: UseCollabProps) => {
  const [peers, setPeers] = useState<PeerWithWorkspace[]>([]);
  const [status, setStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const [roomId, setRoomId] = useState<string | null>(() => getRoomFromUrl());
  const [isSharing, setIsSharing] = useState<boolean>(() => !!getRoomFromUrl());
  const sessionRef = useRef<CollabSession | null>(null);
  const activeWorkspaceRef = useRef<Workspace>(activeWorkspace);
  const langRef = useRef<Language>(lang);

  // Keep refs fresh without re-subscribing the channel
  useEffect(() => { activeWorkspaceRef.current = activeWorkspace; }, [activeWorkspace]);
  useEffect(() => { langRef.current = lang; }, [lang]);

  // Connect/Disconnect when sharing state changes
  useEffect(() => {
    if (!isSharing || !roomId) {
      sessionRef.current?.disconnect();
      sessionRef.current = null;
      setPeers([]);
      setStatus('offline');
      return;
    }

    let disposed = false;

    const session = new CollabSession(roomId, {
      onRemoteOps: (ops) => {
        if (disposed) return;
        applyRemoteOps(() => {
          if (ops.pointsUpsert) updatePoints(prev => ({ ...prev, ...ops.pointsUpsert }));
          if (ops.pointsDelete) updatePoints(prev => {
            const next = { ...prev };
            ops.pointsDelete!.forEach(id => delete next[id]);
            return next;
          });
          if (ops.shapesUpsert) {
            const upserted = ops.shapesUpsert;
            updateShapes(prev => {
              const map = new Map(prev.map(s => [s.id, s]));
              upserted.forEach(s => map.set(s.id, s));
              return Array.from(map.values());
            });
          }
          if (ops.shapesDelete) updateShapes(prev => prev.filter(s => !ops.shapesDelete!.includes(s.id)));
          if (ops.textsUpsert) updateTexts(prev => ({ ...(prev || {}), ...ops.textsUpsert }));
          if (ops.textsDelete) updateTexts(prev => {
            const next = { ...(prev || {}) };
            ops.textsDelete!.forEach(id => delete next[id]);
            return next;
          });
        });
      },

      onRemoteFullState: (state) => {
        if (disposed) return;
        applyRemoteOps(() => {
          updatePoints(state.points || {});
          updateShapes(state.shapes || []);
          updateTexts(state.texts || {});
        });
      },

      onRequestFullState: () => {
        if (disposed) return;
        const ws = activeWorkspaceRef.current;
        session.sendFullState({ points: ws.points, shapes: ws.shapes, texts: ws.texts || {} });
      },

      onPeersChanged: (remotePeers) => {
        if (disposed) return;
        const local = sessionRef.current;
        if (!local) return;
        const info = local.info;
        setPeers(remotePeers.map(p => ({ ...p, isLocal: p.id === info.peerId })));
      },

      onStatusChanged: (s) => {
        if (disposed) return;
        setStatus(s);
      }
    });

    sessionRef.current = session;
    session.connect();

    return () => {
      disposed = true;
      session.disconnect();
      sessionRef.current = null;
    };
  }, [isSharing, roomId, applyRemoteOps, updatePoints, updateShapes, updateTexts]);

  // Broadcast local mutations: diff current workspace against last-synced snapshot
  const lastSyncedRef = useRef<{ points: Record<string, Point>; shapes: GeometricShape[]; texts: Record<string, TextLabel> }>({ points: {}, shapes: [], texts: {} });

  useEffect(() => {
    const session = sessionRef.current;
    if (!session || !isSharing) {
      lastSyncedRef.current = { points: activeWorkspace.points, shapes: activeWorkspace.shapes, texts: activeWorkspace.texts || {} };
      return;
    }

    const prev = lastSyncedRef.current;
    const ops: CollabOps = {};

    // Points: upserts + deletes
    const pointsUpsert: Record<string, Point> = {};
    Object.entries(activeWorkspace.points).forEach(([id, p]) => {
      if (prev.points[id] !== p) pointsUpsert[id] = p;
    });
    const pointsDelete = Object.keys(prev.points).filter(id => !activeWorkspace.points[id]);
    if (Object.keys(pointsUpsert).length) ops.pointsUpsert = pointsUpsert;
    if (pointsDelete.length) ops.pointsDelete = pointsDelete;

    // Shapes: LWW upserts + deletes (reference equality via memoized objects)
    const shapesUpsert = activeWorkspace.shapes.filter(s => prev.shapes.find(old => old.id === s.id) !== s);
    const shapesDelete = prev.shapes.filter(s => !activeWorkspace.shapes.find(neu => neu.id === s.id)).map(s => s.id);
    if (shapesUpsert.length) ops.shapesUpsert = shapesUpsert;
    if (shapesDelete.length) ops.shapesDelete = shapesDelete;

    // Texts: upserts + deletes
    const textsUpsert: Record<string, TextLabel> = {};
    const currentTexts = activeWorkspace.texts || {};
    Object.entries(currentTexts).forEach(([id, tx]) => {
      if ((prev.texts || {})[id] !== tx) textsUpsert[id] = tx;
    });
    const textsDelete = Object.keys(prev.texts || {}).filter(id => !currentTexts[id]);
    if (Object.keys(textsUpsert).length) ops.textsUpsert = textsUpsert;
    if (textsDelete.length) ops.textsDelete = textsDelete;

    lastSyncedRef.current = { points: activeWorkspace.points, shapes: activeWorkspace.shapes, texts: currentTexts };

    if (ops.pointsUpsert || ops.pointsDelete || ops.shapesUpsert || ops.shapesDelete || ops.textsUpsert || ops.textsDelete) {
      session.sendOps(ops);
    }
  }, [activeWorkspace.points, activeWorkspace.shapes, activeWorkspace.texts, isSharing]);

  // Cursor presence (throttled inside the session)
  useEffect(() => {
    sessionRef.current?.updateCursor(cursorWorld);
  }, [cursorWorld]);

  // Announce which workspace we are looking at (for per-tab filtering on the peers UI)
  useEffect(() => {
    sessionRef.current?.setActiveWorkspace(isSharing ? activeWorkspace.id : null);
    lastSyncedRef.current = { points: activeWorkspace.points, shapes: activeWorkspace.shapes, texts: activeWorkspace.texts || {} };
  }, [activeWorkspace.id, isSharing]);

  const startSharing = useCallback(() => {
    const room = crypto.randomUUID().slice(0, 8);
    setRoomId(room);
    setRoomInUrl(room);
    setIsSharing(true);
  }, []);

  const stopSharing = useCallback(() => {
    setIsSharing(false);
    setRoomId(null);
    setRoomInUrl(null);
  }, []);

  const copyShareLink = useCallback(() => {
    if (!roomId) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(url).catch(() => {});
  }, [roomId]);

  return {
    peers: peers.filter(p => !p.isLocal),
    status: isSharing ? status : 'offline',
    isSharing,
    roomId,
    peerInfo: sessionRef.current?.info || null,
    shareLink: roomId ? `${window.location.origin}${window.location.pathname}?room=${roomId}` : null,
    startSharing,
    stopSharing,
    copyShareLink
  };
};