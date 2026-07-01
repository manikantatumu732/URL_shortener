import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '../components/AppLayout';
import { ShortenForm } from '../components/ShortenForm';
import { LinkTable } from '../components/LinkTable';
import { getMyLinks, ApiError } from '../api/client';

export function DashboardPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['links'],
    queryFn: getMyLinks,
  });

  const links = data?.links ?? [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <ShortenForm />

        {isLoading && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading your links…</p>
          </div>
        )}

        {!isLoading && isError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            {error instanceof ApiError ? error.message : 'Could not load your links. Please try again.'}
          </div>
        )}

        {!isLoading && !isError && links.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-600 dark:text-slate-400">
            <p className="text-sm">You haven&apos;t created any links yet.</p>
          </div>
        )}

        {!isLoading && !isError && links.length > 0 && <LinkTable links={links} />}
      </div>
    </AppLayout>
  );
}
