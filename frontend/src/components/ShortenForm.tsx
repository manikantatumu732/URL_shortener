import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { shortenUrl, ApiError } from '../api/client';
import { useAuth } from '../hooks/useAuth';

// Same http(s)-only rule CONTRACT.md requires the backend to enforce for
// POST /api/shorten — validate client-side too so the user gets instant
// feedback instead of a round trip for an obviously bad URL.
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

const shortenSchema = z.object({
  url: urlSchema,
  customAlias: z.string().optional(),
});

type ShortenFormValues = z.infer<typeof shortenSchema>;

export function ShortenForm() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ShortenFormValues>({
    resolver: zodResolver(shortenSchema),
  });

  async function onSubmit(values: ShortenFormValues) {
    setServerError(null);
    setIsSubmitting(true);
    try {
      // Don't send an empty string as customAlias — treat "" as "not set".
      const customAlias = values.customAlias?.trim() || undefined;
      await shortenUrl({ url: values.url, customAlias });
      await queryClient.invalidateQueries({ queryKey: ['links'] });
      reset();
    } catch (err) {
      setServerError(
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
        Shorten a URL
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="url"
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            URL
          </label>
          <input
            id="url"
            type="text"
            placeholder="https://example.com/very/long/path"
            autoComplete="off"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            {...register('url')}
          />
          {errors.url && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.url.message}</p>
          )}
        </div>

        {isAuthenticated && (
          <div>
            <label
              htmlFor="customAlias"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Custom alias
            </label>
            <input
              id="customAlias"
              type="text"
              placeholder="my-link"
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
        )}

        {serverError && (
          <p
            role="alert"
            className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          >
            {serverError}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 sm:w-auto dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          {isSubmitting ? 'Shortening…' : 'Shorten URL'}
        </button>
      </form>
    </div>
  );
}
