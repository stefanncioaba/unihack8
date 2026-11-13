// Typed wrappers for the profile endpoints (docs/API.md → Users). The older user calls stay in endpoints.ts.
import { api } from './client';
import type { Me } from './types';
import type { MyEvents, ReliabilityHistory } from './types.users';

/** Changes my username; answers with the updated profile (400 INVALID_USERNAME, 409 USERNAME_TAKEN). */
export const changeUsername = (username: string) => api<Me>('PATCH', '/users/me', { body: { username } });

/** Events I joined and events I organise. */
export const getMyEvents = () => api<MyEvents>('GET', '/users/me/events');

/** Score and the 20 most recent reliability changes of a user. */
export const getReliability = (userId: string) => api<ReliabilityHistory>('GET', `/users/${userId}/reliability`);
