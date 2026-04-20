'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { AuthPageBackground } from '@/components/AuthPageBackground';
import { AuthCardBranding } from '@/components/AuthCardBranding';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        if (!supabase) {
          throw new Error('Supabase is not configured.')
        }
        // If this callback came from OAuth, Supabase client will detect session in URL.
        const { data } = await supabase.auth.getSession();
        if (data?.session?.access_token) {
          router.replace('/dashboard');
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          router.replace('/dashboard');
          return;
        }

        router.replace('/login');
      } catch (e) {
        if (cancelled) return;
        setError(e?.message || 'Authentication failed.');
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="app-shell relative flex min-h-screen items-center justify-center px-4 py-10">
      <AuthPageBackground />
      <div className="card relative z-10 w-full max-w-md p-7 shadow-2xl backdrop-blur-sm">
        <AuthCardBranding />
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Finishing sign-in…</p>
        {error ? (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:text-red-200">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}

