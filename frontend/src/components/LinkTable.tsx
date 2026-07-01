import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateLink, deleteLink, ApiError } from '../api/client';
import { EditLinkModal } from './EditLinkModal';
import { AnalyticsModal } from './AnalyticsModal';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import type { Link } from '../types';

/**
 * Builds the shareable short URL for a link. Mirrors CONTRACT.md's
 * shortUrl rule from POST /api/shorten (customAlias wins when present),
 * since GET /api/links returns the raw fields, not a prebuilt shortUrl.
 */
function buildShortUrl(link: Link): string {
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
  return `${base}/${link.customAlias || link.shortCode}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable or blocked (permissions, non-secure
      // context, etc.) — fail silently rather than crashing the table.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export function LinkTable({ links }: { links: Link[] }) {
  const queryClient = useQueryClient();

  const [editingLink, setEditingLink] = useState<Link | null>(null);
  const [deletingLink, setDeletingLink] = useState<Link | null>(null);
  const [analyticsLink, setAnalyticsLink] = useState<Link | null>(null);

  // Tracked per-row (by link id) so one row's in-flight mutation doesn't
  // disable every other row's controls.
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toggleErrorId, setToggleErrorId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateLink(id, { active }),
    onMutate: ({ id }) => {
      setTogglingId(id);
      setToggleErrorId(null);
      setToggleError(null);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['links'] }),
    onError: (err, { id }) => {
      setToggleErrorId(id);
      setToggleError(err instanceof ApiError ? err.message : 'Could not update link. Please try again.');
    },
    onSettled: () => setTogglingId(null),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLink(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['links'] });
      setDeletingLink(null);
    },
    // Deliberately no onError side effect beyond leaving the dialog open —
    // the error is read directly from mutation.error below so it renders
    // inside the still-open confirm dialog instead of disappearing.
  });

  function handleToggle(link: Link) {
    // Guard against rapid double-clicks creating duplicate in-flight requests.
    if (toggleMutation.isPending) return;
    toggleMutation.mutate({ id: link.id, active: !link.active });
  }

  const deleteError =
    deleteMutation.isError && deleteMutation.error instanceof ApiError
      ? deleteMutation.error.message
      : deleteMutation.isError
        ? 'Could not delete link. Please try again.'
        : null;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <th className="px-4 py-3 font-medium">Short URL</th>
            <th className="px-4 py-3 font-medium">Destination</th>
            <th className="px-4 py-3 font-medium">Clicks</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {links.map((link) => {
            const shortUrl = buildShortUrl(link);
            const isToggling = toggleMutation.isPending && togglingId === link.id;
            return (
              <tr
                key={link.id}
                className="border-b border-slate-100 last:border-0 dark:border-slate-700/60"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <a
                      href={shortUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="max-w-[220px] truncate font-medium text-slate-900 hover:underline dark:text-slate-100"
                      title={shortUrl}
                    >
                      {shortUrl.replace(/^https?:\/\//, '')}
                    </a>
                    <CopyButton text={shortUrl} />
                  </div>
                </td>
                <td className="max-w-[280px] px-4 py-3">
                  <span
                    className="block truncate text-slate-600 dark:text-slate-400"
                    title={link.originalUrl}
                  >
                    {link.originalUrl}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{link.clicks}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggle(link)}
                      disabled={isToggling}
                      aria-pressed={link.active}
                      className={
                        link.active
                          ? 'inline-flex w-fit items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 hover:bg-green-200 disabled:opacity-50 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60'
                          : 'inline-flex w-fit items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                      }
                    >
                      {isToggling ? 'Updating…' : link.active ? 'Active' : 'Inactive'}
                    </button>
                    {toggleErrorId === link.id && toggleError && (
                      <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                        {toggleError}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAnalyticsLink(link)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      Analytics
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingLink(link)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingLink(link)}
                      className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {editingLink && (
        <EditLinkModal link={editingLink} onClose={() => setEditingLink(null)} />
      )}

      {analyticsLink && (
        <AnalyticsModal link={analyticsLink} onClose={() => setAnalyticsLink(null)} />
      )}

      {deletingLink && (
        <ConfirmDeleteDialog
          isPending={deleteMutation.isPending}
          error={deleteError}
          onConfirm={() => deleteMutation.mutate(deletingLink.id)}
          onCancel={() => {
            deleteMutation.reset();
            setDeletingLink(null);
          }}
        />
      )}
    </div>
  );
}
