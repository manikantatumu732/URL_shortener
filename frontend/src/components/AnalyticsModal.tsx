import { useQuery } from '@tanstack/react-query';
import { getLinkAnalytics, ApiError } from '../api/client';
import type { Link } from '../types';

/**
 * Builds the shareable short URL for a link. Mirrors the same rule used
 * in LinkTable (customAlias wins when present, per CONTRACT.md's
 * shortUrl construction rule).
 */
function buildShortUrl(link: Link): string {
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
  return `${base}/${link.customAlias || link.shortCode}`;
}

/** Renders a value, or an em dash if it's missing/empty, per contributorE4.md. */
function cell(value?: string | null): string {
  return value && value.length > 0 ? value : '—';
}

export function AnalyticsModal({ link, onClose }: { link: Link; onClose: () => void }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['links', link.id, 'analytics'],
    queryFn: () => getLinkAnalytics(link.id),
    // Keep data "fresh" for a few minutes so closing and reopening the
    // modal reuses the cache instead of immediately refetching (per
    // contributorE4.md edge cases). The query only runs at all because
    // this component is only mounted while the modal is open.
    staleTime: 5 * 60 * 1000,
  });

  const errorMessage =
    isError && error instanceof ApiError
      ? error.message
      : isError
        ? 'Something went wrong. Please try again.'
        : null;

  const shortUrl = buildShortUrl(link);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="analytics-heading"
    >
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2
            id="analytics-heading"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            Link analytics
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Close
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <span
              role="status"
              aria-label="Loading"
              className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900 dark:border-slate-600 dark:border-t-slate-100"
            />
          </div>
        )}

        {errorMessage && (
          <p
            role="alert"
            className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          >
            {errorMessage}
          </p>
        )}

        {data && (
          <>
            <div className="mb-4 grid grid-cols-1 gap-3 rounded-md border border-slate-200 p-4 text-sm sm:grid-cols-2 dark:border-slate-700">
              <div>
                <p className="text-slate-500 dark:text-slate-400">Short URL</p>
                <p className="truncate font-medium text-slate-900 dark:text-slate-100" title={shortUrl}>
                  {shortUrl.replace(/^https?:\/\//, '')}
                </p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Destination URL</p>
                <p
                  className="truncate font-medium text-slate-900 dark:text-slate-100"
                  title={data.link.originalUrl}
                >
                  {data.link.originalUrl}
                </p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Total clicks</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">{data.link.clicks}</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Status</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {data.link.active ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>

            {data.analytics.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No analytics available yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      <th className="px-3 py-2 font-medium">Timestamp</th>
                      <th className="px-3 py-2 font-medium">Country</th>
                      <th className="px-3 py-2 font-medium">City</th>
                      <th className="px-3 py-2 font-medium">Browser</th>
                      <th className="px-3 py-2 font-medium">OS</th>
                      <th className="px-3 py-2 font-medium">Device</th>
                      <th className="px-3 py-2 font-medium">Referrer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.analytics.map((event, index) => (
                      <tr
                        key={`${event.timestamp}-${index}`}
                        className="border-b border-slate-100 last:border-0 dark:border-slate-700/60"
                      >
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                          {cell(new Date(event.timestamp).toLocaleString())}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                          {cell(event.country)}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                          {cell(event.city)}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                          {cell(event.browser)}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                          {cell(event.os)}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                          {cell(event.device)}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                          {cell(event.referrer)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
