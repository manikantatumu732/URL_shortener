import { useQuery } from '@tanstack/react-query';
import { getMe, ApiError } from '../api/client';
import type { User } from '../types';

/**
 * Wraps GET /api/auth/me. A 401 here just means "not logged in" — it's
 * an expected, permanent outcome, not a transient failure, so retrying
 * it would only delay showing the login page. Any other failure (e.g.
 * the backend being offline) is allowed its normal TanStack Query retry
 * behavior.
 */
export function useAuth() {
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const user: User | undefined = data?.user;

  return {
    user,
    // TanStack v5's `isLoading` is true only while there is no cached
    // data yet AND a fetch is in flight — i.e. exactly the first
    // GET /api/auth/me on page load. Once it resolves (success OR the
    // expected 401), isLoading flips to false and ProtectedRoute can
    // make a real decision instead of guessing.
    isLoading,
    isAuthenticated: Boolean(user),
  };
}
