// Mock routes: users. Shapes follow docs/API.md.
import { ApiError } from '@/api/errors';
import type { Me, PublicProfile, Skill, UserSummary } from '@/api/types';
import { HELP_CATEGORIES, type HelpCategory } from '@/api/types.help';
import type { MyEvents, ReliabilityHistory } from '@/api/types.users';

import { endOf, eventById, getState, me, toSummary, userById, type Route } from '../core';
import { MOCK_ME_ID, type MockEvent } from '../data';

/** Copy of a user's skills (oldest first). */
function skillsOf(userId: string): Skill[] {
  return [...(getState().skills[userId] ?? [])];
}

/** Validates a skill body like SkillServiceImpl: 2–40 characters, a Help Board category, no duplicate name. */
function validSkill(body: any, exceptId: string | null): { name: string; category: HelpCategory } {
  const name = String(body?.name ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 40) throw new ApiError(400, 'VALIDATION_FAILED', 'Skill name must be 2-40 characters.');
  const category = String(body?.category ?? '').trim().toUpperCase() as HelpCategory;
  if (!HELP_CATEGORIES.includes(category)) throw new ApiError(400, 'VALIDATION_FAILED', 'Unknown category.');
  if (skillsOf(MOCK_ME_ID).some((s) => s.id !== exceptId && s.name.toLowerCase() === name.toLowerCase())) {
    throw new ApiError(409, 'SKILL_EXISTS', 'You already listed this skill.');
  }
  return { name, category };
}

/** One of my skills, or 404. */
function mySkill(id: string): Skill {
  const found = skillsOf(MOCK_ME_ID).find((s) => s.id === id);
  if (!found) throw new ApiError(404, 'NOT_FOUND', 'Skill not found');
  return found;
}

let nextSkill = 100;

export const usersRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/users\/me\/skills$/,
    handler: (): Skill[] => skillsOf(MOCK_ME_ID),
  },
  {
    method: 'POST',
    pattern: /^\/users\/me\/skills$/,
    handler: ({ body }): Skill => {
      const input = validSkill(body, null);
      if (skillsOf(MOCK_ME_ID).length >= 10) throw new ApiError(409, 'SKILL_LIMIT', 'You can list at most 10 skills.');
      const skill: Skill = { id: `e0000000-0000-4000-8000-${String(nextSkill++).padStart(12, '0')}`, ...input };
      getState().skills[MOCK_ME_ID] = [...skillsOf(MOCK_ME_ID), skill];
      return skill;
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/users\/me\/skills\/([^/]+)$/,
    handler: ({ params, body }): Skill => {
      mySkill(params[0]);
      const edited: Skill = { id: params[0], ...validSkill(body, params[0]) };
      getState().skills[MOCK_ME_ID] = skillsOf(MOCK_ME_ID).map((s) => (s.id === edited.id ? edited : s));
      return edited;
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/users\/me\/skills\/([^/]+)$/,
    handler: ({ params }): undefined => {
      mySkill(params[0]);
      getState().skills[MOCK_ME_ID] = skillsOf(MOCK_ME_ID).filter((s) => s.id !== params[0]);
      return undefined;
    },
  },
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
    handler: (): Me => ({ ...me(), createdAt: getState().createdAt[MOCK_ME_ID], skills: skillsOf(MOCK_ME_ID) }),
  },
  {
    method: 'PATCH',
    pattern: /^\/users\/me$/,
    handler: ({ body }): Me => {
      const username = String(body?.username ?? '').trim();
      if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
        throw new ApiError(400, 'INVALID_USERNAME', 'Use 3–20 letters, digits or underscores.');
      }
      if (getState().users.some((u) => u.id !== MOCK_ME_ID && u.username.toLowerCase() === username.toLowerCase())) {
        throw new ApiError(409, 'USERNAME_TAKEN', 'That username is already taken.');
      }
      me().username = username;
      return { ...me(), createdAt: getState().createdAt[MOCK_ME_ID], skills: skillsOf(MOCK_ME_ID) };
    },
  },
  {
    method: 'GET',
    pattern: /^\/users\/me\/events$/,
    handler: (): MyEvents => {
      const byStart = (a: MockEvent, b: MockEvent) => Date.parse(a.startsAt) - Date.parse(b.startsAt);
      const joined = getState()
        .events.flatMap((e) => {
          const mine = e.participants.find((p) => p.userId === MOCK_ME_ID);
          return mine && mine.status !== 'CANCELLED' ? [{ e, status: mine.status }] : [];
        })
        .sort((a, b) => byStart(a.e, b.e))
        .map(({ e, status }) => ({ event: toSummary(e), status }));
      const organizing = getState()
        .events.filter((e) => e.organizerId === MOCK_ME_ID)
        .sort(byStart)
        .map(toSummary);
      return { joined, organizing };
    },
  },
  {
    method: 'GET',
    pattern: /^\/users\/([^/]+)\/reliability$/,
    handler: ({ params }): ReliabilityHistory => {
      const user = userById(params[0]);
      return { reliabilityScore: user.reliabilityScore, entries: (getState().reliabilityLog[user.id] ?? []).slice(0, 20) };
    },
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
      // User events they organised that are already over, newest first, max 20.
      const organizedEvents = getState()
        .events.filter((e) => e.source === 'USER' && e.organizerId === user.id && endOf(e) < Date.now())
        .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))
        .slice(0, 20)
        .map(toSummary);
      return { ...user, createdAt: getState().createdAt[user.id], attendedEvents, organizedEvents, skills: skillsOf(user.id) };
    },
  },
];
