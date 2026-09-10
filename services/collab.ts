import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Workspace, Point, GeometricShape, TextLabel } from '../types';

export interface PeerPresence {
  id: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  activeWorkspaceId: string | null;
}

export interface CollabOps {
  pointsUpsert?: Record<string, Point>;
  pointsDelete?: string[];
  shapesUpsert?: GeometricShape[];
  shapesDelete?: string[];
  textsUpsert?: Record<string, TextLabel>;
  textsDelete?: string[];
}

export interface CollabEvents {
  onRemoteOps: (ops: CollabOps) => void;
  onRemoteFullState: (state: { points: Record<string, Point>; shapes: GeometricShape[]; texts: Record<string, TextLabel> }) => void;
  onRequestFullState: () => void;
  onPeersChanged: (peers: PeerPresence[]) => void;
  onStatusChanged: (status: 'connecting' | 'online' | 'offline') => void;
}

const PEER_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f97316',
  '#a855f7', '#14b8a6', '#eab308', '#ec4899'
];

const randomPeerName = () => {
  const animals = ['Euclid', 'Pythagoras', 'Archimedes', 'Thales', 'Hypatia', 'Ptolemy', 'Aristotle', 'Plato'];
  return animals[Math.floor(Math.random() * animals.length)];
};

export const getRoomFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('room');
};

export const setRoomInUrl = (room: string | null) => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (room) {
    url.searchParams.set('room', room);
  } else {
    url.searchParams.delete('room');
  }
  window.history.replaceState({}, '', url.toString());
};

export class CollabSession {
  private client: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private events: CollabEvents;
  private roomId: string;
  private peerId: string;
  private peerName: string;
  private peerColor: string;
  private cursorThrottle: number | null = null;
  private pendingCursor: { x: number; y: number } | null = null;
  private status: 'connecting' | 'online' | 'offline' = 'connecting';

  constructor(roomId: string, events: CollabEvents) {
    this.roomId = roomId;
    this.events = events;
    this.peerId = crypto.randomUUID();
    this.peerName = randomPeerName();
    this.peerColor = PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)];

    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY is missing');
    }
    this.client = createClient(url, anonKey, {
      realtime: { params: { eventsPerSecond: 30 } }
    });
  }

  get info() {
    return { peerId: this.peerId, peerName: this.peerName, peerColor: this.peerColor };
  }

  async connect() {
    if (!this.client || !this.channel) return;
    this.channel = this.client.channel(`room:${this.roomId}`, {
      config: { broadcast: { self: false }, presence: { key: this.peerId } }
    });

    this.channel
      .on('broadcast', { event: 'ops' }, ({ payload }) => {
        this.events.onRemoteOps(payload as CollabOps);
      })
      .on('broadcast', { event: 'full-state' }, ({ payload }) => {
        this.events.onRemoteFullState(payload);
      })
      .on('broadcast', { event: 'request-state' }, () => {
        this.events.onRequestFullState();
      })
      .on('presence', { event: 'sync' }, () => {
        const state = this.channel?.presenceState<PeerPresence & { phx_ref: string }>();
        const peers: PeerPresence[] = Object.values(state || {})
          .map(arr => arr[0])
          .filter(Boolean)
          .map((p: any) => ({ id: p.id, name: p.name, color: p.color, cursor: p.cursor, activeWorkspaceId: p.activeWorkspaceId }));
        this.events.onPeersChanged(peers);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          this.status = 'online';
          this.events.onStatusChanged(this.status);
          await this.channel?.track({
            id: this.peerId,
            name: this.peerName,
            color: this.peerColor,
            cursor: null,
            activeWorkspaceId: null
          });
          // Ask existing peers for current board state
          this.channel?.send({ type: 'broadcast', event: 'request-state', payload: {} });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.status = 'offline';
          this.events.onStatusChanged(this.status);
        } else if (status === 'CLOSED') {
          this.status = 'offline';
          this.events.onStatusChanged(this.status);
        }
      });
  }

  // --- Outgoing ops (local edits) ---

  sendOps(ops: CollabOps) {
    this.channel?.send({ type: 'broadcast', event: 'ops', payload: ops });
  }

  sendFullState(state: { points: Record<string, Point>; shapes: GeometricShape[]; texts: Record<string, TextLabel> }) {
    this.channel?.send({ type: 'broadcast', event: 'full-state', payload: state });
  }

  setActiveWorkspace(workspaceId: string | null) {
    this.channel?.track({ id: this.peerId, name: this.peerName, color: this.peerColor, cursor: null, activeWorkspaceId: workspaceId });
  }

  // --- Cursor presence (throttled to ~30fps) ---

  private lastWorkspaceId: string | null = null;

  updateCursor(cursor: { x: number; y: number } | null) {
    this.pendingCursor = cursor;
    if (this.cursorThrottle !== null) return;
    this.cursorThrottle = window.setTimeout(() => {
      this.cursorThrottle = null;
      if (this.pendingCursor) {
        this.channel?.track({ id: this.peerId, name: this.peerName, color: this.peerColor, cursor: this.pendingCursor, activeWorkspaceId: this.lastWorkspaceId });
      }
      this.pendingCursor = null;
    }, 33);
  }

  disconnect() {
    if (this.cursorThrottle !== null) {
      window.clearTimeout(this.cursorThrottle);
      this.cursorThrottle = null;
    }
    this.channel?.unsubscribe();
    this.channel = null;
    this.status = 'offline';
    this.events.onStatusChanged(this.status);
  }
}