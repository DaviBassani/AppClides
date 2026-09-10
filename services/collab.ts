import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Workspace, Point, GeometricShape, TextLabel } from '../types';

// Injected by Vite define (import.meta.env is compile-time safe, no runtime polyfill needed)
const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = (import.meta as any).env.VITE_SUPABASE_ANON_KEY as string;

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
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private lastTrackTime = 0;
  // Supabase free tier: max 5 presence updates per second per client
  private static readonly PRESENCE_THROTTLE_MS = 250;

  constructor(roomId: string, events: CollabEvents) {
    this.roomId = roomId;
    this.events = events;
    this.peerId = crypto.randomUUID();
    this.peerName = randomPeerName();
    this.peerColor = PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)];

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY is missing (import.meta.env.VITE_SUPABASE_*)');
    }
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: { params: { eventsPerSecond: 30 } }
    });
  }

  get info() {
    return { peerId: this.peerId, peerName: this.peerName, peerColor: this.peerColor };
  }

  async connect() {
    if (!this.client) return;
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
          this.reconnectAttempts = 0;
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
          this.scheduleReconnect();
        } else if (status === 'CLOSED') {
          this.status = 'offline';
          this.events.onStatusChanged(this.status);
          this.scheduleReconnect();
        }
      });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer !== null) return;
    const delay = Math.min(2000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      // Re-create channel (old one was closed by server)
      this.channel = null;
      this.connect();
    }, delay);
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

  // --- Cursor presence (throttled to stay under Supabase's 5/sec presence limit) ---

  private lastWorkspaceId: string | null = null;

  updateCursor(cursor: { x: number; y: number } | null) {
    this.pendingCursor = cursor;
    if (this.cursorThrottle !== null) return;
    const now = Date.now();
    const elapsed = now - this.lastTrackTime;
    const wait = Math.max(0, CollabSession.PRESENCE_THROTTLE_MS - elapsed);
    this.cursorThrottle = window.setTimeout(() => {
      this.cursorThrottle = null;
      this.lastTrackTime = Date.now();
      if (this.pendingCursor) {
        this.channel?.track({ id: this.peerId, name: this.peerName, color: this.peerColor, cursor: this.pendingCursor, activeWorkspaceId: this.lastWorkspaceId });
      }
      this.pendingCursor = null;
    }, wait);
  }

  disconnect() {
    if (this.cursorThrottle !== null) {
      window.clearTimeout(this.cursorThrottle);
      this.cursorThrottle = null;
    }
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.channel?.unsubscribe();
    this.channel = null;
    this.status = 'offline';
    this.events.onStatusChanged(this.status);
  }
}