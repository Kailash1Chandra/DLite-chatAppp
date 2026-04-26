'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, Lock, LogIn, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppHeaderMenu } from '@/components/AppHeaderMenu';
import { AuthCardBranding } from '@/components/AuthCardBranding';
import { toAuthErrorMessage } from '@/lib/authErrors';
import FloatingLabelInput from '@/components/FloatingLabelInput';
import { prefersReducedMotion } from '@/lib/utils';

const cardClass = 'w-full max-w-md rounded-3xl border border-ui-border bg-ui-panel p-8 shadow-[var(--shadow-lg)]';

function GoogleLogo({ className }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.74 1.22 9.26 3.6l6.92-6.92C35.98 2.33 30.45 0 24 0 14.6 0 6.51 5.38 2.56 13.22l8.05 6.25C12.54 13.23 17.8 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.14 24.56c0-1.64-.15-3.22-.43-4.74H24v8.98h12.42c-.54 2.9-2.18 5.36-4.64 7.02l7.12 5.52c4.16-3.84 7.24-9.5 7.24-16.78z"
      />
      <path
        fill="#FBBC05"
        d="M10.61 28.47A14.5 14.5 0 0 1 9.84 24c0-1.55.27-3.04.77-4.47l-8.05-6.25A24 24 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l8.05-6.31z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.45 0 11.98-2.13 15.98-5.66l-7.12-5.52c-1.98 1.33-4.51 2.11-8.86 2.11-6.2 0-11.46-3.73-13.39-8.97l-8.05 6.31C6.51 42.62 14.6 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}

function AnimatedTypingDots() {
  return (
    <div className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.25s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.12s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300" />
    </div>
  );
}

function Showcase() {
  const reduce = useMemo(() => prefersReducedMotion(), []);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduce) return () => undefined;
    const schedule = [1000, 900, 900, 3000, 700];
    let t = null;
    let idx = 0;
    const tick = () => {
      setStep(idx);
      const wait = schedule[idx] || 1200;
      idx = (idx + 1) % schedule.length;
      t = window.setTimeout(tick, wait);
    };
    t = window.setTimeout(tick, schedule[0]);
    return () => {
      if (t) window.clearTimeout(t);
    };
  }, [reduce]);

  return (
    <div className="relative hidden h-full min-h-[680px] w-full overflow-hidden rounded-[2rem] border border-ui-border bg-ui-panel/30 p-6 lg:block">
      <div className="absolute inset-0">
        <div className="absolute -left-16 -top-20 h-72 w-72 rounded-full bg-orange-400/45 blur-[60px] motion-safe:animate-[floaty_6s_ease-in-out_infinite]" />
        <div className="absolute -right-24 top-16 h-80 w-80 rounded-full bg-pink-400/35 blur-[60px] motion-safe:animate-[floaty_8s_ease-in-out_infinite]" />
        <div className="absolute left-1/3 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-amber-300/35 blur-[60px] motion-safe:animate-[floaty_7s_ease-in-out_infinite]" />

        <div className="pointer-events-none absolute inset-0 opacity-60">
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              className="absolute h-1 w-1 rounded-full bg-white/40"
              style={{
                left: `${(i * 19) % 100}%`,
                top: `${(i * 13) % 100}%`,
                opacity: 0.18 + ((i % 5) * 0.04),
                animation: reduce ? undefined : `floaty ${6 + (i % 4)}s ease-in-out ${-(i % 6)}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 flex h-full flex-col justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-700/70 dark:text-slate-200/70">
            Sunset Chrome
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
            Join thousands of conversations
          </h2>
          <p className="mt-2 text-sm text-slate-700/70 dark:text-slate-200/70">★★★★★ Loved by 1000+ users</p>
        </div>

        <div className="glass relative mx-auto w-full max-w-sm rounded-3xl p-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-ui-grad-from to-ui-grad-to shadow-[var(--shadow-accent)]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">D-Lite</p>
              <p className="truncate text-xs text-slate-600 dark:text-slate-300">Live chat preview</p>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <AnimatePresence mode="wait">
              {reduce ? (
                <motion.div
                  key="static"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  <div className="w-fit max-w-[92%] rounded-2xl border border-ui-border bg-white/60 px-3 py-2 text-sm text-slate-800 dark:bg-black/25 dark:text-slate-100">
                    Hey, are you free?
                  </div>
                  <div className="ml-auto w-fit max-w-[92%] rounded-2xl border border-white/35 bg-gradient-to-r from-ui-grad-from to-ui-grad-to px-3 py-2 text-sm text-white">
                    Yes! Let&apos;s call 📞
                  </div>
                </motion.div>
              ) : step === 0 ? (
                <motion.div
                  key="typing"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="w-fit rounded-2xl border border-ui-border bg-white/60 px-3 py-2 dark:bg-black/25"
                >
                  <AnimatedTypingDots />
                </motion.div>
              ) : (
                <motion.div
                  key={`msgs-${step}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="space-y-2"
                >
                  {step >= 1 ? (
                    <div className="w-fit max-w-[92%] rounded-2xl border border-ui-border bg-white/60 px-3 py-2 text-sm text-slate-800 dark:bg-black/25 dark:text-slate-100">
                      Hey, are you free?
                    </div>
                  ) : null}
                  {step >= 2 ? (
                    <div className="ml-auto w-fit max-w-[92%] rounded-2xl border border-white/35 bg-gradient-to-r from-ui-grad-from to-ui-grad-to px-3 py-2 text-sm text-white">
                      Yes! Let&apos;s call 📞
                    </div>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="text-xs text-slate-700/60 dark:text-slate-200/60">
          Tip: Press <span className="rounded-md border border-ui-border bg-white/50 px-1.5 py-0.5">Enter</span> to send
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { login, loginWithGoogle, requestOtp, verifyOtp, isAuthenticated, user, loading: authLoading, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(toAuthErrorMessage(err, 'login'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleSubmitting(true);
    setError('');
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(toAuthErrorMessage(err, 'google'));
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const handleSendOtp = async () => {
    setOtpSubmitting(true);
    setError('');
    try {
      await requestOtp(email);
      setOtpSent(true);
    } catch (err) {
      setError(toAuthErrorMessage(err, 'login'));
    } finally {
      setOtpSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    setOtpSubmitting(true);
    setError('');
    try {
      await verifyOtp(email, otpCode);
      router.push('/dashboard');
    } catch (err) {
      setError(toAuthErrorMessage(err, 'login'));
    } finally {
      setOtpSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="app-shell flex min-h-[100dvh] flex-col bg-ui-canvas">
        <main className="flex flex-1 items-center justify-center p-4 sm:p-6">
          <div className={cardClass}>
            <AuthCardBranding />
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Loading…</p>
          </div>
        </main>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="app-shell relative flex min-h-[100dvh] flex-col bg-ui-canvas">
        <div className="absolute right-3 top-3 z-10 sm:right-6 sm:top-6">
          <AppHeaderMenu
            menuLinks={[{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }]}
          />
        </div>
        <main className="flex flex-1 items-center justify-center p-4 sm:p-6">
          <motion.div
            className={cardClass}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.9, 0.2, 1] }}
          >
            <AuthCardBranding className="mb-6" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Signed in</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-slate-100">{user?.username}</span>
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button asChild className="w-full sm:flex-1">
                <Link href="/dashboard">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              <Button type="button" variant="secondary" className="w-full sm:flex-1" onClick={() => logout()}>
                Log out
              </Button>
            </div>
            <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
              <Link href="/" className="font-medium text-ui-link hover:underline">
                Home
              </Link>
            </p>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell relative flex min-h-[100dvh] flex-col bg-ui-canvas">
      <div className="absolute right-3 top-3 z-10 sm:right-6 sm:top-6">
        <AppHeaderMenu showLogout={false} menuLinks={[]} collapseActionsInMenu showChatsInCollapsedMenu={false} />
      </div>
      <main className="flex flex-1 items-stretch justify-center p-4 sm:p-6">
        <div className="grid w-full max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="flex items-center justify-center">
            <motion.div
              className={cardClass}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.2, 0.9, 0.2, 1] }}
            >
              <AuthCardBranding />
              <h1 className="mt-6 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Welcome back</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Sign in with email and password.</p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-3">
                <FloatingLabelInput
                  label="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  type="email"
                  name="email"
                  rightHint=""
                />
                <FloatingLabelInput
                  label="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  type="password"
                  name="password"
                />

                <div className="flex items-center justify-between gap-3 pt-1">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-ui-border accent-[var(--ui-accent)]"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    Remember me for 30 days
                  </label>
                  <Link href="/forgot-password" className="text-sm font-semibold text-ui-link hover:underline">
                    Forgot password?
                  </Link>
                </div>

                <Button
                  className="h-12 w-full"
                  type="submit"
                  disabled={submitting}
                  loading={submitting}
                  loadingText="Signing in…"
                  leftIcon={<LogIn className="h-4 w-4" />}
                >
                  Sign in
                </Button>

                <div className="rounded-2xl border border-ui-border bg-ui-muted/60 p-3 dark:bg-ui-muted/40">
                  <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Email code</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="secondary"
                      className="sm:flex-1"
                      disabled={!email || otpSubmitting}
                      loading={otpSubmitting && !otpCode}
                      loadingText="Sending…"
                      onClick={handleSendOtp}
                      leftIcon={<Mail className="h-4 w-4" />}
                    >
                      {otpSent ? 'Resend' : 'Send code'}
                    </Button>
                    <FloatingLabelInput
                      label="Code"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      name="otp"
                      inputMode="numeric"
                      className="sm:flex-1"
                    />
                    <Button
                      type="button"
                      className="sm:flex-1"
                      disabled={!otpCode || !email || otpSubmitting}
                      loading={otpSubmitting && Boolean(otpCode)}
                      loadingText="Verifying…"
                      onClick={handleVerifyOtp}
                      leftIcon={<Lock className="h-4 w-4" />}
                    >
                      Verify
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 py-1">
                  <div className="h-px flex-1 bg-ui-border" />
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">or</span>
                  <div className="h-px flex-1 bg-ui-border" />
                </div>

                <Button
                  className="h-12 w-full bg-white text-slate-900 shadow-[var(--shadow-soft)] hover:bg-slate-50"
                  type="button"
                  variant="secondary"
                  onClick={handleGoogleSignIn}
                  disabled={googleSubmitting || submitting}
                  loading={googleSubmitting}
                  loadingText="Continuing…"
                  leftIcon={<GoogleLogo className="h-5 w-5" />}
                >
                  Continue with Google
                </Button>
              </form>

              {error ? (
                <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:text-red-200">
                  {error}
                </div>
              ) : null}

              <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
                No account?{' '}
                <Link href="/register" className="font-semibold text-ui-link hover:underline">
                  Register
                </Link>
              </p>
            </motion.div>
          </div>

          <Showcase />
        </div>
      </main>
    </div>
  );
}
