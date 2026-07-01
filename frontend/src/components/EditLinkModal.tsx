import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateLink, ApiError } from '../api/client';
import type { Link, UpdateLinkRequest } from '../types';

// Same http(s)-only rule CONTRACT.md requires PUT /api/links/:id to
// re-validate (see "Resolved ambiguities log" entry 3) — mirrors the
// urlSchema already used in ShortenForm for POST /api/shorten.
const urlSchema = z
  .string()
  .min(1, 'URL is required')
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Enter a valid http(s) URL');

const editLinkSchema = z.object({
  originalUrl: urlSchema,
  customAlias: z.string().optional(),
  active: z.boolean(),
});

type EditLinkFormValues = z.infer<typeof editLinkSchema>;

export function EditLinkModal({ link, onClose }: { link: Link; onClose: () => void }) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditLinkFormValues>({
    resolver: zodResolver(editLinkSchema),
    defaultValues: {
      originalUrl: link.originalUrl,
      customAlias: link.customAlias ?? '',
      active: link.active,
    },
  });

  const mutation = useMutation({
    mutationFn: (payload: UpdateLinkRequest) => updateLink(link.id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['links'] });
      onClose();
    },
  });

  function onSubmit(values: EditLinkFormValues) {
    // customAlias in CONTRACT.md is an optional partial-update field —
    // treat a blank input the same way ShortenForm does: "not set", so
    // an unchanged/empty alias field doesn't get sent as a spurious update.
    const trimmedAlias = values.customAlias?.trim();
    const payload: UpdateLinkRequest = {
      originalUrl: values.originalUrl,
      active: values.active,
      ...(trimmedAlias ? { customAlias: trimmedAlias } : {}),
    };
    mutation.mutate(payload);
  }

  const serverError =
    mutation.isError && mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.isError
        ? 'Something went wrong. Please try again.'
        : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-link-heading"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-700 dark:bg-slate-800">
        <h2
          id="edit-link-heading"
          className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100"
        >
          Edit link
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="edit-originalUrl"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Destination URL
            </label>
            <input
              id="edit-originalUrl"
              type="text"
              autoComplete="off"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              {...register('originalUrl')}
            />
            {errors.originalUrl && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.originalUrl.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="edit-customAlias"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Custom alias
            </label>
            <input
              id="edit-customAlias"
              type="text"
              autoComplete="off"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              {...register('customAlias')}
            />
            {errors.customAlias && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.customAlias.message}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              id="edit-active"
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
              {...register('active')}
            />
            <label
              htmlFor="edit-active"
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Active
            </label>
          </div>

          {serverError && (
            <p
              role="alert"
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
            >
              {serverError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
            >
              {mutation.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
