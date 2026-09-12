import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CollabSession,
  CollabStatus,
  PeerPresence,
  getRoomFromUrl,
  setRoomInUrl
} from '../services/collab';
import { BoardState, CollabOps } from '../services/collabProtocol';
import { Workspace } from '../types';
import { Language, t } from '../utils/i18n';

interface UseCollabProps {
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  setLocalOpsHandler: (handler: ((workspaceId: string, ops: CollabOps) => void) | null) => void;
  setWorkspaceRoom: (workspaceId: string, roomId: string | null) => void;
  joinRoom: (roomId: string, defaultName: string) => void;
  applyRemoteOpsToRoom: (roomId: string, ops: CollabOps) => void;
  applyRemoteStateToRoom: (roomId: string, state: BoardState) => void;
  cursorWorld: { x: number; y: number } | null;
  lang: Language;
}

export const useCollab = ({
  workspaces,
  activeWorkspace,
  setLocalOpsHandler,
  setWorkspaceRoom,
  joinRoom,
  applyRemoteOpsToRoom,
  applyRemoteStateToRoom,
  cursorWorld,
  lang
}: UseCollabProps) => {
  const [pendingInitialRoom, setPendingInitialRoom] = useState<string | null>(() => getRoomFromUrl());
  const [peers, setPeers] = useState<PeerPresence[]>([]);
  const [status, setStatus] = useState<CollabStatus>('offline');
  const sessionRef = useRef<CollabSession | null>(null);
  const newRoomsRef = useRef(new Set<string>());
  const initialRoomIsBound = !!pendingInitialRoom && workspaces.some(ws => ws.roomId === pendingInitialRoom);
  const roomId = pendingInitialRoom
    ? (initialRoomIsBound ? pendingInitialRoom : null)
    : activeWorkspace.roomId;
  const roomIdRef = useRef(roomId);
  const workspacesRef = useRef(workspaces);
  const actionsRef = useRef({ applyRemoteOpsToRoom, applyRemoteStateToRoom });

  roomIdRef.current = roomId;
  workspacesRef.current = workspaces;
  actionsRef.current = { applyRemoteOpsToRoom, applyRemoteStateToRoom };

  // A shared URL opens in a dedicated/reusable workspace before remote state arrives.
  useEffect(() => {
    if (!pendingInitialRoom) return;
    if (workspaces.some(ws => ws.roomId === pendingInitialRoom)) {
      setPendingInitialRoom(null);
      return;
    }
    joinRoom(pendingInitialRoom, t[lang].tabs.untitled);
  }, [pendingInitialRoom, workspaces, joinRoom, lang]);

  // The URL follows the active tab. Only the active shared tab owns a channel.
  useEffect(() => {
    if (pendingInitialRoom) return;
    setRoomInUrl(activeWorkspace.roomId || null);
  }, [activeWorkspace.id, activeWorkspace.roomId, pendingInitialRoom]);

  // Local mutations emit explicit operations. Remote mutation paths bypass this handler.
  useEffect(() => {
    setLocalOpsHandler((workspaceId, ops) => {
      const currentRoom = roomIdRef.current;
      if (!currentRoom) return;
      const sharedWorkspace = workspacesRef.current.find(ws => ws.roomId === currentRoom);
      if (sharedWorkspace?.id !== workspaceId) return;
      sessionRef.current?.sendOps(ops);
    });
    return () => setLocalOpsHandler(null);
  }, [setLocalOpsHandler]);

  useEffect(() => {
    if (!roomId) {
      void sessionRef.current?.disconnect();
      sessionRef.current = null;
      setPeers([]);
      setStatus('offline');
      return;
    }

    let disposed = false;
    const isNewRoom = newRoomsRef.current.has(roomId);
    const session = new CollabSession(roomId, {
      onRemoteOps: ops => {
        if (!disposed) actionsRef.current.applyRemoteOpsToRoom(roomId, ops);
      },
      onRemoteFullState: state => {
        if (!disposed) actionsRef.current.applyRemoteStateToRoom(roomId, state);
      },
      onRequestFullState: requestId => {
        if (disposed) return;
        const workspace = workspacesRef.current.find(ws => ws.roomId === roomId);
        if (!workspace) return;
        session.sendFullState({
          points: workspace.points,
          shapes: workspace.shapes,
          texts: workspace.texts || {}
        }, requestId);
      },
      onRemoteCursor: remotePeer => {
        if (disposed) return;
        setPeers(current => {
          const existing = current.some(peer => peer.id === remotePeer.id);
          return existing
            ? current.map(peer => peer.id === remotePeer.id ? { ...peer, ...remotePeer } : peer)
            : [...current, remotePeer];
        });
      },
      onPeersChanged: currentPeers => {
        if (disposed) return;
        setPeers(previous => {
          const cursors = new Map(previous.map(peer => [peer.id, peer.cursor]));
          return currentPeers.map(peer => ({ ...peer, cursor: cursors.get(peer.id) || null }));
        });
      },
      onStatusChanged: nextStatus => {
        if (!disposed) setStatus(nextStatus);
      }
    }, undefined, { requestInitialState: !isNewRoom });

    sessionRef.current = session;
    setStatus('connecting');
    // Deferring one tick prevents React StrictMode's probe mount from joining
    // and immediately leaving a paid Realtime channel in development.
    const connectTimer = globalThis.setTimeout(() => {
      if (!disposed) {
        newRoomsRef.current.delete(roomId);
        void session.connect();
      }
    }, 0);

    return () => {
      disposed = true;
      globalThis.clearTimeout(connectTimer);
      if (sessionRef.current === session) sessionRef.current = null;
      void session.disconnect();
    };
  }, [roomId]);

  // Cursors are Broadcast messages scoped by room, never Presence updates.
  useEffect(() => {
    if (!roomId || activeWorkspace.roomId !== roomId) return;
    sessionRef.current?.sendCursor(cursorWorld);
  }, [cursorWorld, roomId, activeWorkspace.roomId]);

  const startSharing = useCallback(() => {
    const room = crypto.randomUUID().slice(0, 8);
    newRoomsRef.current.add(room);
    setWorkspaceRoom(activeWorkspace.id, room);
    setRoomInUrl(room);
  }, [activeWorkspace.id, setWorkspaceRoom]);

  const stopSharing = useCallback(() => {
    setWorkspaceRoom(activeWorkspace.id, null);
    setRoomInUrl(null);
  }, [activeWorkspace.id, setWorkspaceRoom]);

  const copyShareLink = useCallback(() => {
    if (!roomId) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    void navigator.clipboard.writeText(url);
  }, [roomId]);

  const localPeerId = sessionRef.current?.info.peerId;
  const remotePeers = peers.filter(peer => peer.id !== localPeerId);

  return {
    peers: remotePeers,
    status,
    isSharing: !!roomId,
    roomId,
    shareLink: roomId ? `${window.location.origin}${window.location.pathname}?room=${roomId}` : null,
    startSharing,
    stopSharing,
    copyShareLink
  };
};
