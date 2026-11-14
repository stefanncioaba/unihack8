// Typed wrappers for the profile endpoints (docs/API.md → Users). The older user calls stay in endpoints.ts.
import { api } from './client';
import type { HelpCategory } from './types.help';
import type { Me, Skill } from './types';
import type { MyEvents, ReliabilityHistory } from './types.users';

/** Changes my username; answers with the updated profile (400 INVALID_USERNAME, 409 USERNAME_TAKEN). */
export const changeUsername = (username: string) => api<Me>('PATCH', '/users/me', { body: { username } });

/** Events I joined and events I organise. */
export const getMyEvents = () => api<MyEvents>('GET', '/users/me/events');

/** Score and the 20 most recent reliability changes of a user. */
export const getReliability = (userId: string) => api<ReliabilityHistory>('GET', `/users/${userId}/reliability`);

/** Body of adding or editing a skill: 2–40 characters and a Help Board category. */
export type SkillInput = { name: string; category: HelpCategory };

/** Adds a skill to my profile (400 VALIDATION_FAILED, 409 SKILL_EXISTS or SKILL_LIMIT). */
export const addSkill = (input: SkillInput) => api<Skill>('POST', '/users/me/skills', { body: input });

/** Renames a skill or moves it to another category (404 when it is not mine). */
export const updateSkill = (id: string, input: SkillInput) => api<Skill>('PATCH', `/users/me/skills/${id}`, { body: input });

/** Deletes one of my skills (204). */
export const deleteSkill = (id: string) => api<void>('DELETE', `/users/me/skills/${id}`);
