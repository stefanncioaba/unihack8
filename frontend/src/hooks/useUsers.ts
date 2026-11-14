// TanStack Query hooks for the profile page: my events, reliability history and the username change.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Me, Skill } from '@/api/types';
import { addSkill, changeUsername, deleteSkill, getMyEvents, getReliability, updateSkill, type SkillInput } from '@/api/endpoints.users';

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

/** Puts my new skill list into the cached profile and refreshes the views that show skills (public profiles, offers). */
function useSkillCache() {
  const client = useQueryClient();
  return async (change: (skills: Skill[]) => Skill[]) => {
    client.setQueryData<Me>(['me'], (me) => (me ? { ...me, skills: change(me.skills ?? []) } : me));
    await Promise.all([client.invalidateQueries({ queryKey: ['user'] }), client.invalidateQueries({ queryKey: ['help', 'detail'] })]);
  };
}

/** Adds a skill to my profile; the new one goes last, like on the server. */
export function useAddSkill() {
  const update = useSkillCache();
  return useMutation({ mutationFn: (input: SkillInput) => addSkill(input), onSuccess: (skill) => update((list) => [...list, skill]) });
}

/** Edits one of my skills in place. */
export function useUpdateSkill() {
  const update = useSkillCache();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SkillInput }) => updateSkill(id, input),
    onSuccess: (skill) => update((list) => list.map((s) => (s.id === skill.id ? skill : s))),
  });
}

/** Deletes one of my skills. */
export function useDeleteSkill() {
  const update = useSkillCache();
  return useMutation({ mutationFn: (id: string) => deleteSkill(id), onSuccess: (_, id) => update((list) => list.filter((s) => s.id !== id)) });
}
