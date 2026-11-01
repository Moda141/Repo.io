import { QueryClient } from '@tanstack/react-query';

/**
 * Shared TanStack Query client.
 * Exported as a singleton so axios interceptors (axiosClient.ts) and
 * other non-hook callers can call queryClient.invalidateQueries / clear
 * without going through useQueryClient().
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Never retry 4xx — the body is as valid as the empty-pass result.
        const status = (error as { response?: { status?: number } })?.response
          ?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
