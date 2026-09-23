import { REALTIME_SUBSCRIBE_STATES, RealtimeChannel, RealtimeClient } from '@supabase/realtime-js';
import {
  applyBoardOps,
  BoardState,
  CollabOps,
  isEmptyOps,
  isSafeId,
  mergeOps,
  parseBoardState,
  parseCollabOps,
  sanitizePeer,
  splitCollabOps
} from './collabProtocol';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export type CollabStatus = 'connecting' | 'online' | 'reconnecting' | 'offline' | 'unavailable';

// @supabase/realtime-js emits REALTIME_SUBSCRIBE_STATES on the subscribe callback. Map each wire
// state onto the public CollabStatus contract so hooks/useCollab.ts never learns about the swap.
const toCollabStatus = (status: REALTIME_SUBSCRIBE_STATES, destroyed: boolean): CollabStatus => {
  switch (status) {
    case REALTIME_SUBSCRIBE_STATES.SUBSCRIBED:
      return 'online';
    case REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR:
    case REALTIME_SUBSCRIBE_STATES.TIMED_OUT:
      return 'reconnecting';
    case REALTIME_SUBSCRIBE_STATES.CLOSED:
      return destroyed ? 'offline' : 'reconnecting';
    default:
      return 'reconnecting';
  }
};

export const hasCollabConfig = (url: unknown, anonKey: unknown) =>
  typeof url === 'string' && url.trim().length > 0 &&
  typeof anonKey === 'string' && anonKey.trim().length > 0;

export const isCollabConfigured = () => hasCollabConfig(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  onRemotePeer: (peer: PeerPresence) => void;
  onPeersChanged: (peers: PeerPresence[]) => void;
  onStatusChanged: (status: CollabStatus) => void;
}

interface Envelope<T> {
  senderId: string;
  messageId: string;
  payload: T;
}

const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export const isSafeRoomId = (value: unknown): value is string =>
  typeof value === 'string' && ROOM_ID_PATTERN.test(value);

const parseEnvelope = (value: unknown): Envelope<unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const envelope = value as Record<string, unknown>;
  if (!isSafeId(envelope.senderId) || !isSafeId(envelope.messageId) || !('payload' in envelope)) return null;
  return {
    senderId: envelope.senderId,
    messageId: envelope.messageId,
    payload: envelope.payload
  };
};

interface CollabSessionOptions {
  requestInitialState?: boolean;
}

const PEER_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f97316',
  '#a855f7', '#14b8a6', '#eab308', '#ec4899'
];

const PEER_NAMES = ['Euclid', 'Pythagoras', 'Archimedes', 'Thales', 'Hypatia', 'Ptolemy', 'Aristotle', 'Plato'];
const LEGACY_IDENTITY_KEY = 'euclides_collab_identity_v1';
const PEER_ID_KEY = 'euclides_collab_peer_id_v1';
const PROFILE_KEY = 'euclides_collab_profile_v1';

const getPeerIdentity = () => {
  let legacy: Record<string, unknown> | null = null;
  try {
    const stored = sessionStorage.getItem(LEGACY_IDENTITY_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) legacy = parsed;
  } catch {
    // sessionStorage may be unavailable in hardened browser profiles.
  }

  let id = isSafeId(legacy?.id) ? legacy.id : crypto.randomUUID();
  try {
    const storedId = sessionStorage.getItem(PEER_ID_KEY);
    if (isSafeId(storedId)) id = storedId;
    sessionStorage.setItem(PEER_ID_KEY, id);
  } catch {
    // Collaboration still works with an ephemeral ID.
  }

  let profile: { name: string; color: string } = {
    name: typeof legacy?.name === 'string' ? legacy.name : PEER_NAMES[Math.floor(Math.random() * PEER_NAMES.length)],
    color: typeof legacy?.color === 'string' ? legacy.color : PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)]
  };
  const fallbackProfile = sanitizePeer({ id, ...profile });
  profile = fallbackProfile
    ? { name: fallbackProfile.name, color: fallbackProfile.color }
    : {
        name: PEER_NAMES[Math.floor(Math.random() * PEER_NAMES.length)],
        color: PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)]
      };
  try {
    const stored = localStorage.getItem(PROFILE_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    const candidate = sanitizePeer({
      id,
      name: parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>).name : profile.name,
      color: parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>).color : profile.color
    });
    if (candidate) profile = { name: candidate.name, color: candidate.color };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Collaboration still works without profile persistence.
  }

  return { id, ...profile };
};

const savePeerProfile = (name: string, color: string) => {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ name, color }));
  } catch {
    // Profile remains valid for the current session.
  }
};

let sharedClient: RealtimeClient | null = null;

const getClient = () => {
  if (!isCollabConfigured()) {
    throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY is missing (import.meta.env.VITE_SUPABASE_*)');
  }
  if (!sharedClient) {
    // Mirrors supabase-js: <project>/realtime/v1 over ws(s), anon key in the query params.
    const endpoint = new URL('realtime/v1', SUPABASE_URL);
    endpoint.protocol = endpoint.protocol.replace(/^http/, 'ws');
    const client = new RealtimeClient(endpoint.href, {
      params: { apikey: SUPABASE_ANON_KEY }
    });
    client.connect();
    sharedClient = client;
  }
  return sharedClient;
};

export const getRoomFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  const room = new URLSearchParams(window.location.search).get('room');
  return isSafeRoomId(room) ? room : null;
};

export const setRoomInUrl = (room: string | null) => {
  if (typeof window === 'undefined') return;
  if (room !== null && !isSafeRoomId(room)) throw new Error('Invalid collaboration room ID');
  const url = new URL(window.location.href);
  if (room) url.searchParams.set('room', room);
  else url.searchParams.delete('room');
  window.history.replaceState({}, '', url.toString());
};

export class CollabSession {
  private static readonly CURSOR_INTERVAL_MS = 500;
  private static readonly OPS_BATCH_MS = 100;
  private static readonly roomCleanup = new Map<string, Promise<unknown>>();

  private client: RealtimeClient;
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

  constructor(roomId: string, events: CollabEvents, client?: RealtimeClient, options: CollabSessionOptions = {}) {
    if (!isSafeRoomId(roomId)) throw new Error('Invalid collaboration room ID');
    this.roomId = roomId;
    this.events = events;
    const identity = getPeerIdentity();
    this.peerId = identity.id;
    this.peerName = identity.name;
    this.peerColor = identity.color;
    this.client = client || getClient();
    this.requestInitialState = options.requestInitialState !== false;
  }

  get info(): PeerPresence {
    return { id: this.peerId, name: this.peerName, color: this.peerColor };
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
        const envelope = parseEnvelope(payload);
        const ops = envelope ? parseCollabOps(envelope.payload) : null;
        if (!envelope || !ops || !this.acceptEnvelope(envelope)) return;
        this.events.onRemoteOps(ops);
      })
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        const envelope = parseEnvelope(payload);
        const peer = envelope ? sanitizePeer(envelope.payload) : null;
        if (!envelope || !peer || peer.id !== envelope.senderId || !this.acceptEnvelope(envelope)) return;
        this.events.onRemotePeer(peer);
      })
      .on('broadcast', { event: 'profile' }, ({ payload }) => {
        const envelope = parseEnvelope(payload);
        const peer = envelope ? sanitizePeer(envelope.payload) : null;
        if (!envelope || !peer || peer.id !== envelope.senderId || !this.acceptEnvelope(envelope)) return;
        this.events.onRemotePeer(peer);
      })
      .on('broadcast', { event: 'request-state' }, ({ payload }) => {
        const envelope = parseEnvelope(payload);
        const request = envelope?.payload as Record<string, unknown> | undefined;
        if (!envelope || !request || !isSafeId(request.requestId) || !this.acceptEnvelope(envelope) || !this.isStateLeader(envelope.senderId)) return;
        this.events.onRequestFullState(request.requestId);
      })
      .on('broadcast', { event: 'full-state' }, ({ payload }) => {
        const envelope = parseEnvelope(payload);
        const response = envelope?.payload as Record<string, unknown> | undefined;
        const state = response ? parseBoardState(response.state) : null;
        if (!envelope || !response || !isSafeId(response.requestId) || !state || !this.acceptEnvelope(envelope) || response.requestId !== this.pendingStateRequestId) return;
        if (this.stateRequestTimer !== null) globalThis.clearTimeout(this.stateRequestTimer);
        this.stateRequestTimer = null;
        this.pendingStateRequestId = null;
        const localOverlay = this.pendingSyncOps;
        this.pendingSyncOps = {};
        this.events.onRemoteFullState(applyBoardOps(state, localOverlay));
        // Idempotent upserts/deletes make this safe if an earlier delivery succeeded.
        if (!isEmptyOps(localOverlay)) this.sendOps(localOverlay);
      })
      .on('presence', { event: 'sync' }, () => this.syncPresence(channel))
      .subscribe(async status => {
        if (this.destroyed || channel !== this.channel) return;
        if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          this.setStatus('online');
          await channel.track({ id: this.peerId, name: this.peerName, color: this.peerColor });
          if (this.destroyed || channel !== this.channel) return;
          if (this.requestInitialState) this.requestFullState();
          this.requestInitialState = true;
          this.flushOps();
          this.flushCursor();
        } else if (status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR || status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT) {
          // realtime-js owns reconnect/backoff; creating another channel here duplicates traffic.
          this.setStatus('reconnecting');
        } else if (status === REALTIME_SUBSCRIBE_STATES.CLOSED) {
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
    const validated = parseBoardState(state);
    if (validated) this.sendEnvelope('full-state', { requestId, state: validated });
  }

  async updateName(value: string) {
    const profile = sanitizePeer({ id: this.peerId, name: value, color: this.peerColor });
    if (!profile || profile.name === this.peerName) return this.info;
    this.peerName = profile.name;
    savePeerProfile(this.peerName, this.peerColor);

    if (this.channel && this.status === 'online') {
      await this.channel.track({ id: this.peerId, name: this.peerName, color: this.peerColor });
      this.sendEnvelope('profile', { id: this.peerId, name: this.peerName, color: this.peerColor });
    }
    return this.info;
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
    splitCollabOps(ops).forEach(chunk => this.sendEnvelope('ops', chunk));
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
      const sanitized = sanitizePeer(peer);
      if (sanitized) peersById.set(sanitized.id, sanitized);
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
