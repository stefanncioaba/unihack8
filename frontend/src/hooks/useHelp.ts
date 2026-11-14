// TanStack Query hooks for the Neighbour Help Board (PLAN 25): one per endpoint, plus the cache keys.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  cancelHelpRequest,
  createHelpRequest,
  getHelpRequest,
  getHelpTicket,
  getMyHelpRequests,
  helpCheckIn,
  listHelpRequests,
  offerHelp,
  withdrawHelp,
} from '@/api/endpoints.help';
import type { NewHelpRequest } from '@/api/types.help';
import { useCurrentPosition } from '@/features/location/LocationProvider';
import { toNearParam } from '@/lib/geo';

/** The board and an open request refresh this often, so new offers and closed requests show up. */
export const HELP_REFRESH_MS = 30_000;
/** A helper's ticket refreshes faster while it waits for the scan. */
export const HELP_TICKET_REFRESH_MS = 10_000;

/** Cache keys; everything starts with 'help' so one invalidation refreshes the whole feature. */
export const helpKeys = {
  all: ['help'] as const,
  board: (near: string | null, bbox: string | null = null) => ['help', 'board', near, bbox] as const,
  mine: ['help', 'mine'] as const,
  detail: (id: string) => ['help', 'detail', id] as const,
  ticket: (id: string) => ['help', 'ticket', id] as const,
};

/** The board, closest first when the phone's real position is known; refreshed every 30 s.
 * `bbox` (`minLon,minLat,maxLon,maxLat`) keeps only requests with a location inside it (e.g. one neighbourhood). */
export function useHelpBoard(options: { bbox?: string } = {}) {
  const { position, isFallback } = useCurrentPosition();
  const near = isFallback ? null : toNearParam(position);
  const bbox = options.bbox ?? null;
  return useQuery({
    queryKey: helpKeys.board(near, bbox),
    queryFn: ({ signal }) => listHelpRequests({ near: near ?? undefined, bbox: bbox ?? undefined }, signal),
    refetchInterval: HELP_REFRESH_MS,
  });
}

/** My requests and the ones I offered on; refetched on every visit. */
export function useMyHelpRequests(enabled = true) {
  return useQuery({ queryKey: helpKeys.mine, queryFn: getMyHelpRequests, enabled, refetchOnMount: 'always', refetchInterval: HELP_REFRESH_MS });
}

/** One request with its offers, refreshed every 30 s. */
export function useHelpRequest(id: string | undefined) {
  return useQuery({ queryKey: helpKeys.detail(id ?? ''), queryFn: () => getHelpRequest(id!), enabled: !!id, refetchInterval: HELP_REFRESH_MS });
}

/** My helper QR code; polled while it still waits for the scan so "You helped" appears by itself. */
export function useHelpTicket(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: helpKeys.ticket(id ?? ''),
    queryFn: () => getHelpTicket(id!),
    enabled: !!id && enabled,
    retry: false,
    refetchInterval: (query) => (query.state.data?.status === 'OFFERED' ? HELP_TICKET_REFRESH_MS : false),
  });
}

/** Invalidates every help query (board, mine, details, tickets). */
function useRefreshHelp() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: helpKeys.all });
}

/** Posts a new request. */
export function useCreateHelpRequest() {
  const refresh = useRefreshHelp();
  return useMutation({ mutationFn: (body: NewHelpRequest) => createHelpRequest(body), onSuccess: refresh });
}

/** Requester: cancel the request. */
export function useCancelHelpRequest(id: string) {
  const refresh = useRefreshHelp();
  return useMutation({ mutationFn: () => cancelHelpRequest(id), onSuccess: refresh });
}

/** Helper: offer to help. */
export function useOfferHelp(id: string) {
  const refresh = useRefreshHelp();
  return useMutation({ mutationFn: () => offerHelp(id), onSuccess: refresh });
}

/** Helper: withdraw my offer. */
export function useWithdrawHelp(id: string) {
  const refresh = useRefreshHelp();
  return useMutation({ mutationFn: () => withdrawHelp(id), onSuccess: refresh });
}

/** Requester: scan a helper's code. Also refreshes scores: the helper's profile, history, and any list showing them. */
export function useHelpCheckIn(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => helpCheckIn(id, token),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: helpKeys.all }),
        client.invalidateQueries({ queryKey: ['me'] }),
        client.invalidateQueries({ queryKey: ['user'] }),
        client.invalidateQueries({ queryKey: ['users', 'reliability'] }),
        client.invalidateQueries({ queryKey: ['users', 'search'] }),
        client.invalidateQueries({ queryKey: ['events', 'participants'] }),
      ]),
  });
}
