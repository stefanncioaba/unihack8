// Typed wrapper around the AI endpoint (docs/API.md -> AI assistant).
import { api } from './client';
import type { ChatAnswer, ChatRequest } from './types.ai';

/** Sends the whole conversation and gets the assistant's reply plus the places / events it mentioned. */
export const sendChat = (request: ChatRequest) => api<ChatAnswer>('POST', '/ai/chat', { body: request });
