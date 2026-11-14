// TanStack Query hooks for Timișoara news (PLAN 26): the Home strip, the News screen list and the site chips.
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { getNews, getNewsSources } from '@/api/endpoints.news';

/** The backend reads each site at most every 10 min, so refreshing more often than this gains nothing. */
export const NEWS_REFRESH_MS = 5 * 60_000;
export const NEWS_PAGE_SIZE = 20;
/** Headlines on the Home strip. */
export const HOME_NEWS_COUNT = 6;

export const newsKeys = {
  latest: (size: number) => ['news', 'latest', size] as const,
  list: (source: string | null, q: string) => ['news', 'list', source, q] as const,
  sources: ['news', 'sources'] as const,
};

/** The newest headlines, for the Home strip. */
export function useLatestNews(size = HOME_NEWS_COUNT) {
  return useQuery({
    queryKey: newsKeys.latest(size),
    queryFn: ({ signal }) => getNews({ size }, signal),
    refetchInterval: NEWS_REFRESH_MS,
  });
}

/** The News screen list: one site or all, optional word search, endless scroll. */
export function useNewsList(source: string | null, q: string) {
  return useInfiniteQuery({
    queryKey: newsKeys.list(source, q),
    queryFn: ({ pageParam, signal }) =>
      getNews({ source: source ?? undefined, q: q || undefined, page: pageParam, size: NEWS_PAGE_SIZE }, signal),
    initialPageParam: 0,
    placeholderData: keepPreviousData, // keep the old list visible while a new filter loads
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
  });
}

/** The news sites, for the filter chips. */
export function useNewsSources() {
  return useQuery({ queryKey: newsKeys.sources, queryFn: getNewsSources, staleTime: NEWS_REFRESH_MS });
}
