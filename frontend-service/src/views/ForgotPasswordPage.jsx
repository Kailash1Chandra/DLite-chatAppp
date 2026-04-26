'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppHeaderMenu } from '@/components/AppHeaderMenu';
import { AuthCardBranding } from '@/components/AuthCardBranding';
import FloatingLabelInput from '@/components/FloatingLabelInput';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';
import { prefersReducedMotion } from '@/lib/utils';

const cardClass = 'w-full max-w-md rounded-3xl border border-ui-border bg-ui-panel p-8 shadow-[var(--shadow-lg)]';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const reduce = useMemo(() => prefersReducedMotion(), []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSent(false);
    try {
      if (!isSupabaseConfigured() || !supabase) {
        throw new Error('Password reset is not configured on this deployment.');
      }
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error: supaErr } = await supabase.auth.resetPasswordForEmail(String(email || '').trim(), { redirectTo });
      if (supaErr) throw supaErr;
      setSent(true);
    } catch (err) {
      setError(String(err?.message || 'Could not send reset email.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell relative flex min-h-[100dvh] flex-col bg-ui-canvas">
      <div className="absolute right-3 top-3 z-10 sm:right-6 sm:top-6">
        <AppHeaderMenu showLogout={false} menuLinks={[]} collapseActionsInMenu showChatsInCollapsedMenu={false} />
      </div>

      <main className="flex flex-1 items-center justify-center p-4 sm:p-6">
        <motion.div
          className={cardClass}
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0.9, 0.2, 1] }}
        >
          <AuthCardBranding />
          <h1 className="mt-6 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Reset your password</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            We&apos;ll email you a reset link if your account exists.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <FloatingLabelInput
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              type="email"
              name="email"
            />

            <Button
              className="h-12 w-full"
              type="submit"
              disabled={!email || submitting}
              loading={submitting}
              loadingText="Sending…"
              leftIcon={<Send className="h-4 w-4" />}
            >
              Send reset link
            </Button>
          </form>

          {sent ? (
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-200">
              Sent! Check your inbox.
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:text-red-200">
              {error}
            </div>
          ) : null}

          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Back to{' '}
            <Link href="/login" className="font-semibold text-ui-link hover:underline">
              Sign in
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
}

