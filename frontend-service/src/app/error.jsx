'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Error({ error, reset }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[app:error]', error);
  }, [error]);

  return (
    <div className="app-shell flex min-h-[100dvh] items-center justify-center bg-ui-canvas p-4">
      <div className="w-full max-w-xl rounded-3xl border border-ui-border bg-ui-panel p-6 shadow-2xl shadow-black/10 dark:shadow-black/40">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          We hit an unexpected issue. You can try again or go back.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button onClick={reset} className="sm:flex-1">
            Try again
          </Button>
          <Button asChild variant="secondary" className="sm:flex-1">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

