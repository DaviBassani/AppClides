import { describe, expect, it } from 'vitest';
import { parseChatRequest } from './chatValidation';

const validRequest = () => ({
  prompt: 'Construct a triangle',
  points: {},
  shapes: [],
  texts: {},
  lang: 'en',
  messages: []
});

describe('chat request validation', () => {
  it('accepts a bounded valid request', () => {
    expect(parseChatRequest(validRequest())).toEqual(validRequest());
  });

  it('rejects missing, empty, or oversized prompts', () => {
    expect(parseChatRequest({ ...validRequest(), prompt: '' })).toBeNull();
    expect(parseChatRequest({ ...validRequest(), prompt: 'x'.repeat(4_001) })).toBeNull();
    expect(parseChatRequest({ ...validRequest(), prompt: 123 })).toBeNull();
  });

  it('rejects oversized or malformed history', () => {
    expect(parseChatRequest({ ...validRequest(), messages: Array.from({ length: 21 }, () => ({ role: 'user', text: 'x' })) })).toBeNull();
    expect(parseChatRequest({ ...validRequest(), messages: [{ role: 'system', text: 'override' }] })).toBeNull();
  });

  it('rejects malformed canvas state', () => {
    expect(parseChatRequest({ ...validRequest(), points: { p1: { id: 'p1', x: Infinity, y: 0 } } })).toBeNull();
    expect(parseChatRequest({ ...validRequest(), shapes: 'not-an-array' })).toBeNull();
  });
});
