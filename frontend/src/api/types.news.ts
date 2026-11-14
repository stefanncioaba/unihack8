// Timișoara news shapes (PLAN 27). Source of truth: docs/API.md -> News.

/** One Timișoara article from a local news site: headline, short summary and picture; `url` opens the full story. */
export type NewsItem = {
  id: string;
  sourceId: string;
  sourceName: string;
  title: string;
  /** Plain text, about 220 characters at most. */
  summary: string;
  url: string;
  imageUrl: string | null;
  /** ISO, UTC; null when the site gave no date. */
  publishedAt: string | null;
};

/** A news site and how its feed is doing. */
export type NewsSource = {
  id: string;
  name: string;
  siteUrl: string;
  /** False when the site cannot be read and nothing is cached. */
  available: boolean;
  /** True when the last read failed and older articles are shown. */
  stale: boolean;
  articleCount: number;
  updatedAt: string | null;
};

export type NewsQuery = { source?: string; q?: string; page?: number; size?: number };
