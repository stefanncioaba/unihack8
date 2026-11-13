// TanStack Query hooks for the profile page: my events, reliability history and the username change.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { changeUsername, getMyEvents, getReliability } from '@/api/endpoints.users';

/** Cache keys of the profile data, so other features can invalidate them too. */
export const userKeys = {
  myEvents: ['users', 'me', 'events'] as const,
  reliability: (userId: string) => ['users', 'reliability', userId] as const,
};

/** Events I joined (with my status) and events I organise; refetched on every visit because join / leave / check-in change it. */
export function useMyEvents() {
  return useQuery({ queryKey: userKeys.myEvents, queryFn: getMyEvents, refetchOnMount: 'always' });
}

/** Reliability history of a user; waits until the id is known. */
export function useReliability(userId: string | undefined) {
  return useQuery({
    queryKey: userKeys.reliability(userId ?? ''),
    queryFn: () => getReliability(userId!),
    enabled: !!userId,
    refetchOnMount: 'always',
  });
}

/** Changes my username and refreshes everything that shows it (profile, participant lists, search). */
export function useChangeUsername() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (username: string) => changeUsername(username),
    onSuccess: async (me) => {
      client.setQueryData(['me'], me);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['events', 'participants'] }),
        client.invalidateQueries({ queryKey: ['events', 'detail'] }),
        client.invalidateQueries({ queryKey: ['users', 'search'] }),
        client.invalidateQueries({ queryKey: ['user'] }),
      ]);
    },
  });
}
