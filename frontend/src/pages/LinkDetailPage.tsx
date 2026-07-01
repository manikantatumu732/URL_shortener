import { useParams } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';

/**
 * Placeholder only — routing needs somewhere to land. This page
 * implements analytics, charts, and QR code here.
 */
export function LinkDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <AppLayout>
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-600 dark:text-slate-400">
        <p className="text-sm">Link detail content coming soon for link {id}.</p>
      </div>
    </AppLayout>
  );
}
