import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollabSession, isSafeRoomId, type CollabEvents } from './collab';

class FakeChannel {
  sent: Array<{ type: string; event: string; payload: unknown }> = [];
  trackCalls = 0;
  untrackCalls = 0;
  subscriber: ((status: string) => void) | null = null;
  handlers: Array<{ type: string; filter: { event: string }; callback: (payload: any) => void }> = [];

  on(type: string, filter: { event: string }, callback: (payload: any) => void) {
    this.handlers.push({ type, filter, callback });
    return this;
  }

  subscribe(callback: (status: string) => void) {
    this.subscriber = callback;
    return this;
  }

  track() {
    this.trackCalls++;
    return Promise.resolve('ok');
  }

  untrack() {
    this.untrackCalls++;
    return Promise.resolve('ok');
  }

  send(message: { type: string; event: string; payload: unknown }) {
    this.sent.push(message);
    return Promise.resolve('ok');
  }

  presenceState() {
    return {};
  }

  emitStatus(status: string) {
    this.subscriber?.(status);
  }

  emitBroadcast(event: string, payload: unknown) {
    this.handlers
      .filter(handler => handler.type === 'broadcast' && handler.filter.event === event)
      .forEach(handler => handler.callback({ payload }));
  }
}

class FakeClient {
  channelCalls = 0;
  removeCalls = 0;
  channelInstance = new FakeChannel();

  channel() {
    this.channelCalls++;
    return this.channelInstance;
  }

  removeChannel() {
    this.removeCalls++;
    return Promise.resolve('ok');
  }
}

const events = (): CollabEvents => ({
  onRemoteOps: vi.fn(),
  onRemoteFullState: vi.fn(),
  onRequestFullState: vi.fn(),
  onRemotePeer: vi.fn(),
  onPeersChanged: vi.fn(),
  onStatusChanged: vi.fn()
});

describe('CollabSession traffic budget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('tracks Presence once on join and never for cursor movement', async () => {
    const client = new FakeClient();
    const session = new CollabSession('test-room', events(), client as any);
    session.connect();
    client.channelInstance.emitStatus('SUBSCRIBED');
    await vi.runAllTicks();

    for (let i = 0; i < 1000; i++) session.sendCursor({ x: i, y: i });
    await vi.advanceTimersByTimeAsync(10_000);

    expect(client.channelInstance.trackCalls).toBe(1);
    const cursorBroadcasts = client.channelInstance.sent.filter(message => message.event === 'cursor');
    expect(cursorBroadcasts.length).toBeLessThanOrEqual(1);
  });

  it('caps continuous cursor traffic at two broadcasts per second', async () => {
    const client = new FakeClient();
    const session = new CollabSession('test-room', events(), client as any);
    session.connect();
    client.channelInstance.emitStatus('SUBSCRIBED');
    await vi.runAllTicks();

    for (let frame = 0; frame < 600; frame++) {
      session.sendCursor({ x: frame, y: frame });
      await vi.advanceTimersByTimeAsync(16);
    }

    const cursorBroadcasts = client.channelInstance.sent.filter(message => message.event === 'cursor');
    expect(client.channelInstance.trackCalls).toBe(1);
    expect(cursorBroadcasts.length).toBeLessThanOrEqual(20);
  });

  it('batches rapid board operations into one message', async () => {
    const client = new FakeClient();
    const session = new CollabSession('test-room', events(), client as any);
    session.connect();
    client.channelInstance.emitStatus('SUBSCRIBED');
    await vi.runAllTicks();

    for (let i = 0; i < 100; i++) {
      session.sendOps({ pointsUpsert: { p1: { id: 'p1', x: i, y: i } } });
    }
    await vi.advanceTimersByTimeAsync(100);

    const opsBroadcasts = client.channelInstance.sent.filter(message => message.event === 'ops');
    expect(opsBroadcasts).toHaveLength(1);
  });

  it('does not create another channel when realtime-js reports an error', () => {
    const client = new FakeClient();
    const onStatusChanged = vi.fn();
    const session = new CollabSession('test-room', { ...events(), onStatusChanged }, client as any);
    session.connect();

    client.channelInstance.emitStatus('CHANNEL_ERROR');
    vi.advanceTimersByTime(60_000);

    expect(client.channelCalls).toBe(1);
    expect(onStatusChanged).toHaveBeenCalledWith('reconnecting');
  });

  it('removes its channel on disconnect', async () => {
    const client = new FakeClient();
    const session = new CollabSession('test-room', events(), client as any);
    session.connect();
    client.channelInstance.emitStatus('SUBSCRIBED');

    await session.disconnect();

    expect(client.channelInstance.untrackCalls).toBe(0);
    expect(client.removeCalls).toBe(1);
  });

  it('updates a display name with one explicit Presence call', async () => {
    const client = new FakeClient();
    const session = new CollabSession('test-room', events(), client as any);
    session.connect();
    client.channelInstance.emitStatus('SUBSCRIBED');
    await vi.runAllTicks();

    const originalName = session.info.name;
    const requestedName = originalName === 'Davi' ? 'Davi 2' : 'Davi';
    await session.updateName(`  ${requestedName}  `);
    await session.updateName(requestedName);

    expect(session.info.name).toBe(requestedName);
    expect(client.channelInstance.trackCalls).toBe(2);
    expect(client.channelInstance.sent.filter(message => message.event === 'profile')).toHaveLength(1);
  });

  it('rebases local edits over an incoming initial snapshot', async () => {
    const client = new FakeClient();
    const onRemoteFullState = vi.fn();
    const session = new CollabSession('test-room', { ...events(), onRemoteFullState }, client as any);
    session.connect();
    client.channelInstance.emitStatus('SUBSCRIBED');
    await vi.runAllTicks();

    session.sendOps({ pointsUpsert: { local: { id: 'local', x: 10, y: 20 } } });
    await vi.advanceTimersByTimeAsync(100);
    const request = client.channelInstance.sent.find(message => message.event === 'request-state') as any;
    const requestId = request.payload.payload.requestId;

    client.channelInstance.emitBroadcast('full-state', {
      senderId: 'remote-peer',
      messageId: 'remote-state-1',
      payload: {
        requestId,
        state: { points: { remote: { id: 'remote', x: 1, y: 2 } }, shapes: [], texts: {} }
      }
    });

    expect(onRemoteFullState).toHaveBeenCalledWith({
      points: {
        remote: { id: 'remote', x: 1, y: 2 },
        local: { id: 'local', x: 10, y: 20 }
      },
      shapes: [],
      texts: {}
    });
  });

  it('drops malformed remote payloads at the transport boundary', () => {
    const client = new FakeClient();
    const onRemoteOps = vi.fn();
    const onRemotePeer = vi.fn();
    const session = new CollabSession('test-room', { ...events(), onRemoteOps, onRemotePeer }, client as any);
    session.connect();

    client.channelInstance.emitBroadcast('ops', {
      senderId: 'remote-peer',
      messageId: 'message-1',
      payload: { shapesUpsert: { id: 'not-an-array' } }
    });
    client.channelInstance.emitBroadcast('profile', {
      senderId: 'remote-peer',
      messageId: 'message-2',
      payload: { id: 'remote-peer', name: 'Attacker', color: 'javascript:alert(1)' }
    });
    client.channelInstance.emitBroadcast('profile', {
      senderId: 'remote-peer',
      messageId: 'message-3',
      payload: { id: 'impersonated-peer', name: 'Attacker', color: '#3b82f6' }
    });

    expect(onRemoteOps).not.toHaveBeenCalled();
    expect(onRemotePeer).not.toHaveBeenCalled();
  });
});

describe('collaboration room IDs', () => {
  it('accepts generated UUIDs and legacy room IDs', () => {
    expect(isSafeRoomId(crypto.randomUUID())).toBe(true);
    expect(isSafeRoomId('deadbeef')).toBe(true);
  });

  it('rejects short, oversized, and structured room values', () => {
    expect(isSafeRoomId('room')).toBe(false);
    expect(isSafeRoomId('../secret')).toBe(false);
    expect(isSafeRoomId('<script>alert(1)</script>')).toBe(false);
    expect(isSafeRoomId('a'.repeat(129))).toBe(false);
  });
});
