// TanStack Query hooks: one per endpoint, so screens never touch fetch directly (PLAN 12.3).
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  banParticipant,
  checkIn,
  createEvent,
  getEvent,
  getMe,
  getMyTicket,
  getParticipants,
  getUser,
  joinEvent,
  leaveEvent,
  listEvents,
  searchUsers,
} from '@/api/endpoints';
import type { EventQuery, NewEvent } from '@/api/types';

export const EVENTS_PAGE_SIZE = 10;

/** Cache keys, kept in one place so mutations can invalidate precisely. */
export const keys = {
  me: ['me'] as const,
  user: (id: string) => ['user', id] as const,
  userSearch: (q: string) => ['users', 'search', q] as const,
  events: (query: EventQuery) => ['events', 'list', query] as const,
  event: (id: string) => ['events', 'detail', id] as const,
  participants: (id: string) => ['events', 'participants', id] as const,
  ticket: (id: string) => ['events', 'ticket', id] as const,
};

/** The signed-in user's profile. */
export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: getMe });
}

/** Public profile of any user. */
export function useUser(id: string | undefined) {
  return useQuery({ queryKey: keys.user(id ?? ''), queryFn: () => getUser(id!), enabled: !!id });
}

/** Username prefix search; only runs for 1+ characters. */
export function useUserSearch(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: keys.userSearch(term),
    queryFn: ({ signal }) => searchUsers(term, signal),
    enabled: term.length > 0,
    placeholderData: keepPreviousData,
  });
}

/** One page of events (used by the Home row). */
export function useEventsPage(query: EventQuery) {
  return useQuery({ queryKey: keys.events(query), queryFn: ({ signal }) => listEvents(query, signal), placeholderData: keepPreviousData });
}

/** Endless-scroll event list for the "All events" screen. */
export function useInfiniteEvents(query: Omit<EventQuery, 'page' | 'size'>) {
  return useInfiniteQuery({
    queryKey: ['events', 'infinite', query],
    queryFn: ({ pageParam, signal }) => listEvents({ ...query, page: pageParam, size: EVENTS_PAGE_SIZE }, signal),
    initialPageParam: 0,
    placeholderData: keepPreviousData, // keep the old list visible while a new filter loads
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
  });
}

/** Event details (includes my participation status). */
export function useEvent(id: string | undefined) {
  return useQuery({ queryKey: keys.event(id ?? ''), queryFn: () => getEvent(id!), enabled: !!id });
}

/** Participants with their reliability scores. */
export function useParticipants(id: string | undefined, enabled = true) {
  return useQuery({ queryKey: keys.participants(id ?? ''), queryFn: () => getParticipants(id!), enabled: !!id && enabled });
}

/** My QR ticket for an event. */
export function useMyTicket(id: string | undefined) {
  return useQuery({ queryKey: keys.ticket(id ?? ''), queryFn: () => getMyTicket(id!), enabled: !!id, retry: false });
}

/** Refreshes everything that depends on an event after join / leave / ban / check-in. */
function useRefreshEvent(id: string) {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: keys.event(id) }),
      client.invalidateQueries({ queryKey: keys.participants(id) }),
      client.invalidateQueries({ queryKey: keys.ticket(id) }),
      client.invalidateQueries({ queryKey: ['events', 'list'] }),
      client.invalidateQueries({ queryKey: ['events', 'infinite'] }),
      client.invalidateQueries({ queryKey: keys.me }),
    ]);
}

/** Join an event. */
export function useJoinEvent(id: string) {
  const refresh = useRefreshEvent(id);
  return useMutation({ mutationFn: () => joinEvent(id), onSuccess: refresh });
}

/** Leave an event. */
export function useLeaveEvent(id: string) {
  const refresh = useRefreshEvent(id);
  return useMutation({ mutationFn: () => leaveEvent(id), onSuccess: refresh });
}

/** Organiser: ban a participant. */
export function useBanParticipant(eventId: string) {
  const refresh = useRefreshEvent(eventId);
  return useMutation({ mutationFn: (userId: string) => banParticipant(eventId, userId), onSuccess: refresh });
}

/** Organiser: check a scanned token in. */
export function useCheckIn(eventId: string) {
  const refresh = useRefreshEvent(eventId);
  return useMutation({ mutationFn: (token: string) => checkIn(eventId, token), onSuccess: refresh });
}

/** Create a user event. */
export function useCreateEvent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: NewEvent) => createEvent(body),
    onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: ['events'] })]),
  });
}
