// The one TanStack Query client with app-wide defaults.
import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/errors';

/** Creates a client. Failed requests retry once, except client errors (4xx) which will not change. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export const queryClient = createQueryClient();
