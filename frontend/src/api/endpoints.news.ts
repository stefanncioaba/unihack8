// Typed wrappers around the Timișoara news endpoints (docs/API.md -> News, PLAN 26).
import { api } from './client';
import type { Paged } from './types';
import type { NewsItem, NewsQuery, NewsSource } from './types.news';

/** Timișoara articles of every site (or one), newest first (public, no token). */
export const getNews = (query: NewsQuery, signal?: AbortSignal) =>
  api<Paged<NewsItem>>('GET', '/news', { query: query as Record<string, never>, signal });

/** The news sites and their status (public). */
export const getNewsSources = () => api<NewsSource[]>('GET', '/news/sources');
