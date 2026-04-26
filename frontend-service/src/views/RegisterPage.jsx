'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';
import { motion } from 'framer-motion';
import { Check, LayoutDashboard, Loader2, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppHeaderMenu } from '@/components/AppHeaderMenu';
import { AuthCardBranding } from '@/components/AuthCardBranding';
import { toAuthErrorMessage } from '@/lib/authErrors';
import FloatingLabelInput from '@/components/FloatingLabelInput';
import PasswordStrengthMeter from '@/components/PasswordStrengthMeter';
import { prefersReducedMotion } from '@/lib/utils';

const cardClass = 'w-full max-w-md rounded-3xl border border-ui-border bg-ui-panel p-8 shadow-[var(--shadow-lg)]';

function validateUsernameLocal(value) {
  const lower = String(value || '').trim().toLowerCase();
  const ok = /^[a-z0-9_]{3,20}$/.test(lower);
  return { lower, ok };
}

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

function Showcase() {
  const reduce = useMemo(() => prefersReducedMotion(), []);
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
            Setup in seconds
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
            Your profile, your vibe
          </h2>
          <p className="mt-2 text-sm text-slate-700/70 dark:text-slate-200/70">Choose a username and start chatting.</p>
        </div>

        <div className="glass mx-auto w-full max-w-sm rounded-3xl p-5">
          <p className="text-xs font-semibold text-slate-700/80 dark:text-slate-200/80">Preview</p>
          <div className="mt-3 space-y-2">
            <div className="w-fit max-w-[92%] rounded-2xl border border-ui-border bg-white/60 px-3 py-2 text-sm text-slate-800 dark:bg-black/25 dark:text-slate-100">
              Hey! New design dropped 🎨
            </div>
            <div className="ml-auto w-fit max-w-[92%] rounded-2xl border border-white/35 bg-gradient-to-r from-ui-grad-from to-ui-grad-to px-3 py-2 text-sm text-white">
              Looks clean!
            </div>
            <div className="w-fit max-w-[92%] rounded-2xl border border-ui-border bg-white/60 px-3 py-2 text-sm text-slate-800 dark:bg-black/25 dark:text-slate-100">
              Let&apos;s call?
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-700/60 dark:text-slate-200/60">
          Tip: usernames use <span className="font-semibold">a-z</span>, <span className="font-semibold">0-9</span>, and{' '}
          <span className="font-semibold">_</span>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const { register, loginWithGoogle, isAuthenticated, user, loading: authLoading, logout } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState('male');
  const [profileFile, setProfileFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [usernameHints, setUsernameHints] = useState([]);
  const [usernameStatus, setUsernameStatus] = useState({ checking: false, ok: false, taken: false, msg: '' });
  const lastTakenRef = useRef('');
  const debounceRef = useRef(null);
  const router = useRouter();

  const [previewUrl, setPreviewUrl] = useState('');
  const reduce = useMemo(() => prefersReducedMotion(), []);

  useEffect(() => {
    const raw = String(username || '');
    const { lower, ok } = validateUsernameLocal(raw);
    const taken = lower && lower === lastTakenRef.current;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!lower) {
      setUsernameStatus({ checking: false, ok: false, taken: false, msg: '' });
      return () => undefined;
    }
    setUsernameStatus({ checking: true, ok: false, taken: false, msg: 'Checking…' });
    debounceRef.current = window.setTimeout(() => {
      if (!ok) {
        setUsernameStatus({ checking: false, ok: false, taken: false, msg: 'Use 3–20 chars: a-z, 0-9, _' });
        return;
      }
      if (taken) {
        setUsernameStatus({ checking: false, ok: false, taken: true, msg: 'Taken' });
        return;
      }
      setUsernameStatus({ checking: false, ok: true, taken: false, msg: 'Available' });
    }, 500);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [username]);

  useEffect(() => {
    if (profileFile) {
      const url = URL.createObjectURL(profileFile);
      setPreviewUrl(url);
      return () => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        }
      };
    }
    const seed = `${gender || 'male'}:${username || email || 'user'}`;
    setPreviewUrl(`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`);
    return () => undefined;
  }, [profileFile, gender, username, email]);

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read image'));
      reader.readAsDataURL(file);
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setUsernameHints([]);
    try {
      let photoURL = '';
      if (profileFile) {
        if (profileFile.size > 2 * 1024 * 1024) {
          throw new Error('Profile photo is too large (max 2MB).');
        }
        photoURL = await readFileAsDataUrl(profileFile);
      } else {
        const seed = `${gender || 'male'}:${username || email || 'user'}`;
        photoURL = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
      }
      await register(username, email, password, { gender, photoURL });
      router.push('/dashboard');
    } catch (err) {
      setError(toAuthErrorMessage(err, 'register'));
      if (err?.code === 'auth/username-taken' && Array.isArray(err?.suggestions) && err.suggestions.length > 0) {
        lastTakenRef.current = String(username || '').trim().toLowerCase();
        setUsernameHints(err.suggestions);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleSubmitting(true);
    setError('');
    try {
      await loginWithGoogle();
      // OAuth redirects the full page to Google; do not client-navigate here.
    } catch (err) {
      setError(toAuthErrorMessage(err, 'google'));
    } finally {
      setGoogleSubmitting(false);
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
          <AppHeaderMenu menuLinks={[{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }]} />
        </div>
        <main className="flex flex-1 items-center justify-center p-4 sm:p-6">
          <motion.div
            className={cardClass}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.9, 0.2, 1] }}
          >
            <AuthCardBranding className="mb-6" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Already signed in</h1>
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

  const canSubmit =
    Boolean(username) &&
    Boolean(email) &&
    Boolean(password) &&
    !submitting &&
    !usernameStatus.checking &&
    usernameStatus.ok &&
    !usernameStatus.taken;

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
              <h1 className="mt-6 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Create account</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Username, email, and password.</p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-3">
                <div className="flex items-center gap-3 rounded-2xl border border-ui-border bg-ui-muted/40 p-3">
                  <img
                    src={previewUrl}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-2xl border border-ui-border bg-ui-panel object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Profile photo (optional)
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      className="mt-2 w-full text-xs text-slate-600 file:mr-3 file:rounded-xl file:border file:border-ui-border file:bg-ui-panel file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-800 hover:file:bg-ui-muted dark:text-slate-300 dark:file:text-slate-100"
                      onChange={(ev) => setProfileFile(ev.target.files?.[0] || null)}
                    />
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      If you don’t upload, we’ll use a {gender} avatar.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      gender === 'male'
                        ? 'border-ui-accent bg-ui-accent-subtle text-ui-accent-text'
                        : 'border-ui-border bg-ui-panel text-slate-700 hover:bg-ui-muted dark:text-slate-200'
                    }`}
                    onClick={() => setGender('male')}
                  >
                    Male
                  </button>
                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      gender === 'female'
                        ? 'border-ui-accent bg-ui-accent-subtle text-ui-accent-text'
                        : 'border-ui-border bg-ui-panel text-slate-700 hover:bg-ui-muted dark:text-slate-200'
                    }`}
                    onClick={() => setGender('female')}
                  >
                    Female
                  </button>
                </div>

                <FloatingLabelInput
                  label="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  name="username"
                  isChecking={usernameStatus.checking}
                  success={usernameStatus.ok && !usernameStatus.checking}
                  error={usernameStatus.taken ? 'Taken' : ''}
                  rightHint={
                    username
                      ? usernameStatus.checking
                        ? 'Checking…'
                        : usernameStatus.taken
                          ? 'Taken'
                          : usernameStatus.ok
                            ? 'Available'
                            : usernameStatus.msg
                      : ''
                  }
                />

                <FloatingLabelInput
                  label="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  type="email"
                  name="email"
                />

                <div>
                  <FloatingLabelInput
                    label="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    type="password"
                    name="password"
                  />
                  <PasswordStrengthMeter password={password} />
                </div>

                <Button
                  className="h-12 w-full"
                  type="submit"
                  disabled={!canSubmit}
                  loading={submitting}
                  loadingText="Creating…"
                  leftIcon={<UserPlus className="h-4 w-4" />}
                >
                  Register
                </Button>

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
              {usernameHints.length > 0 ? (
                <div className="mt-2 text-xs">
                  <p className="font-semibold">Try:</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {usernameHints.map((hint) => (
                      <button
                        key={hint}
                        type="button"
                        className="rounded-full border border-red-500/30 bg-red-500/5 px-2 py-1 hover:bg-red-500/10"
                        onClick={() => setUsername(hint)}
                      >
                        {hint}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

              <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
                Have an account?{' '}
                <Link href="/login" className="font-semibold text-ui-link hover:underline">
                  Sign in
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
