import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../hooks/useAuth';

/**
 * Minimal shared shell: title/logo, theme toggle, nav placeholders.
 * Intentionally does not render any dashboard content — that's
 * implemented separately.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="border-b border-slate-200 dark:border-slate-700">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link
            to="/"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            🔗 Snip
          </Link>

          <nav className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
            {/* Placeholder nav — E2 wires up real dashboard links here. */}
            {isAuthenticated && <span className="hidden sm:inline">Dashboard</span>}
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
