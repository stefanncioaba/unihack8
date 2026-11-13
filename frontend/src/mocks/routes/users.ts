// Mock routes: users. Shapes follow docs/API.md.
import { ApiError } from '@/api/errors';
import type { Me, PublicProfile, UserSummary } from '@/api/types';

import { eventById, getState, me, toSummary, userById, type Route } from '../core';
import { MOCK_ME_ID } from '../data';

export const usersRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/users\/username-available$/,
    handler: ({ query }) => {
      const username = String(query.username ?? '');
      if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
        throw new ApiError(400, 'INVALID_USERNAME', 'Use 3–20 letters, digits or underscores.');
      }
      const taken = getState().users.some((u) => u.username.toLowerCase() === username.toLowerCase());
      return { username, available: !taken };
    },
  },
  {
    method: 'GET',
    pattern: /^\/users\/me$/,
    handler: (): Me => ({ ...me(), createdAt: getState().createdAt[MOCK_ME_ID] }),
  },
  {
    method: 'GET',
    pattern: /^\/users\/search$/,
    handler: ({ query }): UserSummary[] => {
      const q = String(query.q ?? '').trim().toLowerCase();
      if (!q) return [];
      return getState().users.filter((u) => u.username.toLowerCase().startsWith(q)).slice(0, 20);
    },
  },
  {
    method: 'GET',
    pattern: /^\/users\/([^/]+)$/,
    handler: ({ params }): PublicProfile => {
      const user = userById(params[0]);
      const attendedEvents = (getState().attended[user.id] ?? []).map((id) => toSummary(eventById(id)));
      return { ...user, createdAt: getState().createdAt[user.id], attendedEvents };
    },
  },
];
