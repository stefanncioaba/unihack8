// Mock routes: Timișoara news (PLAN 26). Shape follows docs/API.md -> News. Made-up articles, not real ones.
import type { Paged } from '@/api/types';
import type { NewsItem, NewsSource } from '@/api/types.news';

import type { Ctx, Route } from '../core';

const MIN = 60_000;

/** Five made-up Timișoara articles from three sites, newest first (times relative to now). */
export function mockNews(now: number = Date.now()): NewsItem[] {
  const at = (minutesAgo: number) => new Date(now - minutesAgo * MIN).toISOString();
  return [
    {
      id: 'n1',
      sourceId: 'tion',
      sourceName: 'TION',
      title: 'Tramvaie noi pe linia 1 din Timișoara',
      summary: 'Primele tramvaie noi circulă de sâmbătă pe linia 1.',
      url: 'https://www.tion.ro/exemplu-tramvaie/',
      imageUrl: 'https://www.tion.ro/exemplu.jpg',
      publishedAt: at(12),
    },
    {
      id: 'n2',
      sourceId: 'opinia',
      sourceName: 'Opinia Timișoarei',
      title: 'Concert gratuit în Piața Unirii',
      summary: 'Timișorenii sunt așteptați la un concert de jazz.',
      url: 'https://www.opiniatimisoarei.ro/exemplu-concert/',
      imageUrl: null,
      publishedAt: at(95),
    },
    {
      id: 'n3',
      sourceId: 'banatulazi',
      sourceName: 'Banatul Azi',
      title: 'Parcul Rozelor se redeschide după lucrări',
      summary: 'Parcul din Timișoara se redeschide luni.',
      url: 'https://www.banatulazi.ro/exemplu-parc/',
      imageUrl: 'https://www.banatulazi.ro/exemplu.jpg',
      publishedAt: at(300),
    },
    {
      id: 'n4',
      sourceId: 'tion',
      sourceName: 'TION',
      title: 'Pistă nouă de biciclete pe Bulevardul Take Ionescu',
      summary: 'Lucrările încep în decembrie.',
      url: 'https://www.tion.ro/exemplu-bicicleta/',
      imageUrl: null,
      publishedAt: at(60 * 26),
    },
    {
      id: 'n5',
      sourceId: 'opinia',
      sourceName: 'Opinia Timișoarei',
      title: 'Poli Timișoara câștigă derby-ul',
      summary: 'Victorie clară pe teren propriu.',
      url: 'https://www.opiniatimisoarei.ro/exemplu-poli/',
      imageUrl: null,
      publishedAt: null,
    },
  ];
}

/** The sites; Timișoara Știri is "down" so the screen's warning can be tested. */
export function mockNewsSources(): NewsSource[] {
  const item = (id: string, name: string, available: boolean, count: number): NewsSource => ({
    id,
    name,
    siteUrl: `https://${id}.example.ro`,
    available,
    stale: false,
    articleCount: count,
    updatedAt: available ? new Date().toISOString() : null,
  });
  return [
    item('tion', 'TION', true, 2),
    item('opinia', 'Opinia Timișoarei', true, 2),
    item('timisoarastiri', 'Timișoara Știri', false, 0),
    item('banatulazi', 'Banatul Azi', true, 1),
  ];
}

/** GET /news: same filters as the backend (source, words in title/summary, paging). */
function list({ query }: Ctx): Paged<NewsItem> {
  const page = Number(query.page ?? 0);
  const size = Number(query.size ?? 20);
  const words = String(query.q ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  const all = mockNews().filter(
    (n) =>
      (!query.source || n.sourceId === query.source) &&
      (words.length === 0 || words.some((w) => `${n.title} ${n.summary}`.toLowerCase().includes(w))),
  );
  return {
    items: all.slice(page * size, page * size + size),
    page,
    size,
    totalItems: all.length,
    totalPages: Math.ceil(all.length / size),
  };
}

export const newsRoutes: Route[] = [
  { method: 'GET', pattern: /^\/news$/, handler: list },
  { method: 'GET', pattern: /^\/news\/sources$/, handler: () => mockNewsSources() },
];
