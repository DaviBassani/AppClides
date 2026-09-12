import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { applyBoardOps, BoardState, CollabOps, isEmptyOps, mergeOps } from './collabProtocol';

const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = (import.meta as any).env.VITE_SUPABASE_ANON_KEY as string;

export type CollabStatus = 'connecting' | 'online' | 'reconnecting' | 'offline';

export interface PeerPresence {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number } | null;
}

export interface CollabEvents {
  onRemoteOps: (ops: CollabOps) => void;
  onRemoteFullState: (state: BoardState) => void;
  onRequestFullState: (requestId: string) => void;
  onRemoteCursor: (peer: PeerPresence) => void;
  onPeersChanged: (peers: PeerPresence[]) => void;
  onStatusChanged: (status: CollabStatus) => void;
}

interface Envelope<T> {
  senderId: string;
  messageId: string;
  payload: T;
}

interface CollabSessionOptions {
  requestInitialState?: boolean;
}

const PEER_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f97316',
  '#a855f7', '#14b8a6', '#eab308', '#ec4899'
];

const PEER_NAMES = ['Euclid', 'Pythagoras', 'Archimedes', 'Thales', 'Hypatia', 'Ptolemy', 'Aristotle', 'Plato'];
const IDENTITY_KEY = 'euclides_collab_identity_v1';

const getPeerIdentity = () => {
  try {
    const stored = sessionStorage.getItem(IDENTITY_KEY);
    if (stored) return JSON.parse(stored) as { id: string; name: string; color: string };
  } catch {
    // sessionStorage may be unavailable in hardened browser profiles.
  }

  const identity = {
    id: crypto.randomUUID(),
    name: PEER_NAMES[Math.floor(Math.random() * PEER_NAMES.length)],
    color: PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)]
  };
  try {
    sessionStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // Collaboration still works without persistence across reloads.
  }
  return identity;
};

let sharedClient: SupabaseClient | null = null;

const getClient = () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY is missing (import.meta.env.VITE_SUPABASE_*)');
  }
  if (!sharedClient) sharedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return sharedClient;
};

export const getRoomFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('room');
};

export const setRoomInUrl = (room: string | null) => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (room) url.searchParams.set('room', room);
  else url.searchParams.delete('room');
  window.history.replaceState({}, '', url.toString());
};

export class CollabSession {
  private static readonly CURSOR_INTERVAL_MS = 500;
  private static readonly OPS_BATCH_MS = 100;
  private static readonly roomCleanup = new Map<string, Promise<unknown>>();

  private client: SupabaseClient;
  private channel: RealtimeChannel | null = null;
  private status: CollabStatus = 'connecting';
  private destroyed = false;
  private events: CollabEvents;
  private roomId: string;
  private peerId: string;
  private peerName: string;
  private peerColor: string;
  private peerIds = new Set<string>();
  private seenMessages = new Set<string>();
  private cursorTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingCursor: { x: number; y: number } | null = null;
  private hasPendingCursor = false;
  private lastCursorSentAt = 0;
  private opsTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingOps: CollabOps = {};
  private pendingStateRequestId: string | null = null;
  private pendingSyncOps: CollabOps = {};
  private stateRequestTimer: ReturnType<typeof setTimeout> | null = null;
  private stateRequestAttempts = 0;
  private requestInitialState: boolean;

  constructor(roomId: string, events: CollabEvents, client?: SupabaseClient, options: CollabSessionOptions = {}) {
    this.roomId = roomId;
    this.events = events;
    const identity = getPeerIdentity();
    this.peerId = identity.id;
    this.peerName = identity.name;
    this.peerColor = identity.color;
    this.client = client || getClient();
    this.requestInitialState = options.requestInitialState !== false;
  }

  get info() {
    return { peerId: this.peerId, peerName: this.peerName, peerColor: this.peerColor };
  }

  async connect() {
    if (this.channel) return;
    const pendingCleanup = CollabSession.roomCleanup.get(this.roomId);
    if (pendingCleanup) await pendingCleanup;
    if (this.destroyed || this.channel) return;
    this.destroyed = false;
    this.setStatus('connecting');

    const channel = this.client.channel(`room:${this.roomId}`, {
      config: { broadcast: { self: false }, presence: { key: this.peerId } }
    });
    this.channel = channel;

    channel
      .on('broadcast', { event: 'ops' }, ({ payload }) => {
        const envelope = payload as Envelope<CollabOps>;
        if (!this.acceptEnvelope(envelope)) return;
        this.events.onRemoteOps(envelope.payload);
      })
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        const envelope = payload as Envelope<PeerPresence>;
        if (!this.acceptEnvelope(envelope)) return;
        this.events.onRemoteCursor(envelope.payload);
      })
      .on('broadcast', { event: 'request-state' }, ({ payload }) => {
        const envelope = payload as Envelope<{ requestId: string }>;
        if (!this.acceptEnvelope(envelope) || !this.isStateLeader(envelope.senderId)) return;
        this.events.onRequestFullState(envelope.payload.requestId);
      })
      .on('broadcast', { event: 'full-state' }, ({ payload }) => {
        const envelope = payload as Envelope<{ requestId: string; state: BoardState }>;
        if (!this.acceptEnvelope(envelope) || envelope.payload.requestId !== this.pendingStateRequestId) return;
        if (this.stateRequestTimer !== null) globalThis.clearTimeout(this.stateRequestTimer);
        this.stateRequestTimer = null;
        this.pendingStateRequestId = null;
        const localOverlay = this.pendingSyncOps;
        this.pendingSyncOps = {};
        this.events.onRemoteFullState(applyBoardOps(envelope.payload.state, localOverlay));
        // Idempotent upserts/deletes make this safe if an earlier delivery succeeded.
        if (!isEmptyOps(localOverlay)) this.sendOps(localOverlay);
      })
      .on('presence', { event: 'sync' }, () => this.syncPresence(channel))
      .subscribe(async status => {
        if (this.destroyed || channel !== this.channel) return;
        if (status === 'SUBSCRIBED') {
          this.setStatus('online');
          await channel.track({ id: this.peerId, name: this.peerName, color: this.peerColor });
          if (this.destroyed || channel !== this.channel) return;
          if (this.requestInitialState) this.requestFullState();
          this.requestInitialState = true;
          this.flushOps();
          this.flushCursor();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // realtime-js owns reconnect/backoff; creating another channel here duplicates traffic.
          this.setStatus('reconnecting');
        } else if (status === 'CLOSED') {
          this.setStatus(this.destroyed ? 'offline' : 'reconnecting');
        }
      });
  }

  sendOps(ops: CollabOps) {
    if (isEmptyOps(ops)) return;
    this.pendingOps = mergeOps(this.pendingOps, ops);
    if (this.pendingStateRequestId) this.pendingSyncOps = mergeOps(this.pendingSyncOps, ops);
    if (this.opsTimer !== null) return;
    this.opsTimer = globalThis.setTimeout(() => {
      this.opsTimer = null;
      this.flushOps();
    }, CollabSession.OPS_BATCH_MS);
  }

  sendCursor(cursor: { x: number; y: number } | null) {
    this.pendingCursor = cursor;
    this.hasPendingCursor = true;

    if (cursor === null) {
      if (this.cursorTimer !== null) globalThis.clearTimeout(this.cursorTimer);
      this.cursorTimer = null;
      this.flushCursor();
      return;
    }

    if (this.cursorTimer !== null) return;
    const wait = Math.max(0, CollabSession.CURSOR_INTERVAL_MS - (Date.now() - this.lastCursorSentAt));
    this.cursorTimer = globalThis.setTimeout(() => {
      this.cursorTimer = null;
      this.flushCursor();
    }, wait);
  }

  sendFullState(state: BoardState, requestId: string) {
    this.sendEnvelope('full-state', { requestId, state });
  }

  async disconnect() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.cursorTimer !== null) globalThis.clearTimeout(this.cursorTimer);
    if (this.opsTimer !== null) globalThis.clearTimeout(this.opsTimer);
    if (this.stateRequestTimer !== null) globalThis.clearTimeout(this.stateRequestTimer);
    this.cursorTimer = null;
    this.opsTimer = null;
    this.stateRequestTimer = null;
    this.pendingOps = {};
    this.pendingSyncOps = {};
    this.hasPendingCursor = false;

    const channel = this.channel;
    this.channel = null;
    if (channel) {
      const cleanup = this.client.removeChannel(channel).finally(() => {
        if (CollabSession.roomCleanup.get(this.roomId) === cleanup) {
          CollabSession.roomCleanup.delete(this.roomId);
        }
      });
      CollabSession.roomCleanup.set(this.roomId, cleanup);
      await cleanup;
    }
    this.peerIds.clear();
    this.events.onPeersChanged([]);
    this.setStatus('offline');
  }

  private requestFullState() {
    if (!this.pendingStateRequestId) {
      this.pendingStateRequestId = crypto.randomUUID();
      this.pendingSyncOps = mergeOps({}, this.pendingOps);
      this.stateRequestAttempts = 0;
    }
    this.stateRequestAttempts++;
    this.sendEnvelope('request-state', { requestId: this.pendingStateRequestId });

    if (this.stateRequestTimer !== null) globalThis.clearTimeout(this.stateRequestTimer);
    if (this.stateRequestAttempts >= 3) {
      this.stateRequestTimer = globalThis.setTimeout(() => {
        this.stateRequestTimer = null;
        this.pendingStateRequestId = null;
        this.pendingSyncOps = {};
      }, 1000);
      return;
    }
    this.stateRequestTimer = globalThis.setTimeout(() => {
      this.stateRequestTimer = null;
      if (this.pendingStateRequestId && this.status === 'online') this.requestFullState();
    }, 1000);
  }

  private flushOps() {
    if (this.status !== 'online' || isEmptyOps(this.pendingOps)) return;
    const ops = this.pendingOps;
    this.pendingOps = {};
    this.sendEnvelope('ops', ops);
  }

  private flushCursor() {
    if (this.status !== 'online' || !this.hasPendingCursor) return;
    const cursor = this.pendingCursor;
    this.hasPendingCursor = false;
    this.lastCursorSentAt = Date.now();
    this.sendEnvelope('cursor', {
      id: this.peerId,
      name: this.peerName,
      color: this.peerColor,
      cursor
    });
  }

  private sendEnvelope<T>(event: string, payload: T) {
    if (!this.channel || this.status !== 'online') return;
    const envelope: Envelope<T> = {
      senderId: this.peerId,
      messageId: crypto.randomUUID(),
      payload
    };
    void this.channel.send({ type: 'broadcast', event, payload: envelope });
  }

  private acceptEnvelope<T>(envelope: Envelope<T> | undefined) {
    if (!envelope || envelope.senderId === this.peerId || !envelope.messageId) return false;
    if (this.seenMessages.has(envelope.messageId)) return false;
    this.seenMessages.add(envelope.messageId);
    if (this.seenMessages.size > 1000) {
      const oldest = this.seenMessages.values().next().value;
      if (oldest) this.seenMessages.delete(oldest);
    }
    return true;
  }

  private syncPresence(channel: RealtimeChannel) {
    const state = channel.presenceState<PeerPresence & { presence_ref?: string; phx_ref?: string }>();
    const peersById = new Map<string, PeerPresence>();
    Object.values(state).flat().forEach(peer => {
      if (peer?.id) peersById.set(peer.id, { id: peer.id, name: peer.name, color: peer.color });
    });
    this.peerIds = new Set(peersById.keys());
    this.events.onPeersChanged(Array.from(peersById.values()));
  }

  private isStateLeader(requesterId: string) {
    const candidates = Array.from(this.peerIds).filter(id => id !== requesterId).sort();
    return candidates[0] === this.peerId;
  }

  private setStatus(status: CollabStatus) {
    if (status === this.status) return;
    this.status = status;
    this.events.onStatusChanged(status);
  }
}
