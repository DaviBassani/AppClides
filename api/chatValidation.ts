import { parseBoardState } from '../services/collabProtocol';
import type { GeometricShape, Point, TextLabel } from '../types';
import { MAX_CHAT_HISTORY_MESSAGES } from '../utils/chatLimits';

export const MAX_CHAT_BODY_BYTES = 200_000;
const MAX_PROMPT_LENGTH = 4_000;
const MAX_MESSAGE_LENGTH = 4_000;

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface ValidatedChatRequest {
  prompt: string;
  points: Record<string, Point>;
  shapes: GeometricShape[];
  texts: Record<string, TextLabel>;
  lang: 'pt' | 'en';
  messages: ChatHistoryMessage[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const parseChatRequest = (value: unknown): ValidatedChatRequest | null => {
  if (!isRecord(value) || typeof value.prompt !== 'string') return null;
  const prompt = value.prompt.trim();
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) return null;
  if (value.lang !== 'pt' && value.lang !== 'en') return null;

  const board = parseBoardState({
    points: value.points,
    shapes: value.shapes,
    texts: value.texts
  });
  if (!board) return null;

  if (!Array.isArray(value.messages) || value.messages.length > MAX_CHAT_HISTORY_MESSAGES) return null;
  const messages: ChatHistoryMessage[] = [];
  for (const message of value.messages) {
    if (!isRecord(message) || (message.role !== 'user' && message.role !== 'assistant')) return null;
    if (typeof message.text !== 'string' || message.text.length > MAX_MESSAGE_LENGTH) return null;
    messages.push({ role: message.role, text: message.text });
  }

  return { prompt, ...board, lang: value.lang, messages };
};
