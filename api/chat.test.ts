import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import handler, { resetRateLimitsForTests } from './chat';

const originalKey = process.env.GEMINI_API_KEY;

beforeAll(() => {
  process.env.GEMINI_API_KEY = 'test-key';
});

beforeEach(() => {
  resetRateLimitsForTests();
});

afterAll(() => {
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
});

describe('chat API boundary', () => {
  it('rejects unsupported methods', async () => {
    const response = await handler(new Request('https://example.test/api/chat', { method: 'GET' }));
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });

  it('rejects cross-origin browser requests', async () => {
    const response = await handler(new Request('https://example.test/api/chat', {
      method: 'POST',
      headers: { origin: 'https://attacker.test', 'content-type': 'application/json' },
      body: '{}'
    }));
    expect(response.status).toBe(403);
  });

  it('rejects oversized requests before parsing', async () => {
    const response = await handler(new Request('https://example.test/api/chat', {
      method: 'POST',
      headers: { 'content-length': '200001', 'x-forwarded-for': '192.0.2.1' },
      body: '{}'
    }));
    expect(response.status).toBe(413);
  });

  it('returns a generic 400 for malformed JSON and disables caching', async () => {
    const response = await handler(new Request('https://example.test/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.2' },
      body: '{invalid'
    }));
    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'Invalid JSON' });
  });

  it('rate-limits repeated requests from the same forwarded IP', async () => {
    const request = () => new Request('https://example.test/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.100' },
      body: '{invalid'
    });
    for (let index = 0; index < 10; index++) {
      expect((await handler(request())).status).toBe(400);
    }
    const blocked = await handler(request());
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBe('60');
  });
});
