'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bell,
  Github,
  LayoutDashboard,
  Lock,
  MessageCircle,
  Monitor,
  Radio,
  Sparkles,
  Star,
  Twitter,
  Users,
  Zap
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { AppHeaderMenu } from '@/components/AppHeaderMenu';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AppBrandRow } from '@/components/AppBrandRow';
import { AppLogo } from '@/components/AppLogo';
import { cn } from '@/lib/utils';
import AnimatedChatPreview from '@/components/AnimatedChatPreview';
import AnimatedCounter from '@/components/AnimatedCounter';
import { prefersReducedMotion } from '@/lib/utils';

/** Primary “Dashboard” CTA — shimmer + glow ring (header uses compact size) */
const dashboardCtaClass = (compact) =>
  cn(
    'anim-shimmer relative overflow-hidden font-semibold tracking-wide',
    'bg-gradient-to-r from-ui-grad-from to-ui-grad-to text-white',
    'shadow-[0_12px_40px_-14px_rgba(15,23,42,0.18)] ring-2 ring-[var(--ui-accent)]/45 ring-offset-2 ring-offset-white',
    'transition hover:brightness-[1.05] hover:shadow-[0_18px_48px_-12px_rgba(15,23,42,0.2)]',
    'dark:ring-[var(--ui-accent)]/35 dark:ring-offset-slate-950',
    compact ? 'px-4 py-2.5 text-sm' : 'px-7 py-3 text-base'
  );

const DashboardCtaContent = ({ compact = false, showArrow = true }) => (
  <>
    <LayoutDashboard className={cn('shrink-0 opacity-95', compact ? 'mr-1.5 h-4 w-4' : 'mr-2.5 h-5 w-5')} aria-hidden />
    Dashboard
    {showArrow && (
      <ArrowRight className={cn('shrink-0 opacity-90', compact ? 'ml-1.5 h-4 w-4' : 'ml-2 h-4 w-4')} />
    )}
  </>
);

const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease: [0.2, 0.9, 0.2, 1] }
};

export default function LandingPage() {
  const { isAuthenticated, user } = useAuth();
  const reduce = useMemo(() => prefersReducedMotion(), []);
  const [cycleIdx, setCycleIdx] = useState(0);
  const cycleWords = useMemo(() => ['teams', 'friends', 'communities', 'creators'], []);

  useEffect(() => {
    if (reduce) return () => undefined;
    const t = window.setInterval(() => setCycleIdx((i) => (i + 1) % cycleWords.length), 2500);
    return () => window.clearInterval(t);
  }, [reduce, cycleWords.length]);

  return (
    <div className="app-shell min-h-screen">
      {/* Background: grid + glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0 opacity-[0.55]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(15,23,42,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.06) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(circle at 50% 20%, black 40%, transparent 72%)',
          }}
        />
        <div className="anim-glow absolute -left-24 top-20 h-72 w-72 rounded-full bg-orange-400/20 dark:bg-orange-500/10" />
        <div className="anim-glow absolute -right-24 top-28 h-72 w-72 rounded-full bg-pink-400/18 [animation-delay:2s] dark:bg-pink-500/10" />
      </div>

      {/* Sticky glass header */}
      <header className="sticky top-0 z-50 border-b border-ui-border bg-ui-shell/95 backdrop-blur-xl dark:bg-ui-shell/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <AppBrandRow asHomeLink />

          <nav className="hidden items-center gap-1 sm:flex">
            {isAuthenticated && (
              <Button asChild className={dashboardCtaClass(true)}>
                <Link href="/dashboard" className="inline-flex items-center no-underline">
                  <DashboardCtaContent compact showArrow={false} />
                </Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <a href="#features" className="no-underline">
                Features
              </a>
            </Button>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {/* Mobile: same CTA as hero (nav hidden below sm) */}
            {isAuthenticated && (
              <Button asChild className={cn(dashboardCtaClass(true), 'sm:hidden')}>
                <Link href="/dashboard" className="inline-flex items-center no-underline">
                  <DashboardCtaContent compact showArrow={false} />
                </Link>
              </Button>
            )}
            {isAuthenticated ? (
              <>
                <span className="hidden text-sm text-slate-600 dark:text-slate-300 md:inline">
                  Hi, <span className="font-semibold text-slate-900 dark:text-slate-100">{user?.username}</span>
                </span>
                <AppHeaderMenu
                  menuLinks={[{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }]}
                />
              </>
            ) : (
              <>
                <ThemeToggle />
                <Button asChild variant="secondary" size="sm">
                  <Link href="/login">Login</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/register">
                    Sign up <ArrowRight className="ml-1.5 h-4 w-4 hidden sm:inline" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 pb-6 pt-10 md:grid-cols-2 md:gap-12 md:pt-14">
          <section>
            <motion.div {...fadeUp} className="badge mb-4 inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-violet-600 dark:text-violet-300" />
              UI Sandbox · Fast. Simple. Real-time.
            </motion.div>

            <motion.h1
              className="text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 dark:text-slate-50 sm:text-5xl lg:text-[3.25rem]"
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.06 }}
            >
              Messaging that feels{' '}
              <span className="bg-gradient-to-r from-ui-grad-from via-pink-500 to-amber-500 bg-clip-text text-transparent">
                instant
              </span>
              .
            </motion.h1>

            <motion.p
              className="mt-5 max-w-lg text-base leading-relaxed text-slate-600 dark:text-slate-300"
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.12 }}
            >
              Private chat, group rooms, and calls — all in one clean dashboard. Built for teams and friends who want a
              fast, reliable messaging experience.
            </motion.p>

            <motion.div
              className="mt-7 flex flex-wrap items-center gap-3"
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.18 }}
            >
              {isAuthenticated ? (
                <Button asChild className={dashboardCtaClass(false)}>
                  <Link href="/dashboard" className="inline-flex items-center">
                    <DashboardCtaContent />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild className="anim-shimmer relative h-12 overflow-hidden">
                    <Link href="/register">
                      Get started free <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" className="h-12">
                    <Link href="/login">I have an account</Link>
                  </Button>
                </>
              )}
            </motion.div>

            <motion.div className="mt-8 flex flex-col gap-5" {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.24 }}>
              <div className="flex items-center gap-2">
                <div className="-space-x-2">
                  {['A', 'S', 'M', 'R', 'K'].map((c, i) => (
                    <span
                      key={c}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-ui-border bg-white/70 text-xs font-bold text-slate-800 shadow-[var(--shadow-soft)] dark:bg-white/10 dark:text-slate-100"
                      style={{ zIndex: 10 - i }}
                    >
                      {c}
                    </span>
                  ))}
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-200">
                  <span className="font-semibold">Join 1000+ users</span>
                </div>
              </div>

              <div className="text-sm text-slate-600 dark:text-slate-300">
                Build for{' '}
                <AnimatePresence mode="wait">
                  <motion.span
                    key={cycleWords[cycleIdx]}
                    initial={reduce ? { opacity: 1 } : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 1 } : { opacity: 0, y: -6 }}
                    transition={{ duration: reduce ? 0 : 0.2 }}
                    className="inline-block font-semibold text-slate-900 dark:text-slate-50"
                  >
                    {cycleWords[cycleIdx]}
                  </motion.span>
                </AnimatePresence>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="badge inline-flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-[color:var(--ui-accent)]" />
                  DMs
                </span>
                <span className="badge inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-[color:var(--ui-accent)]" />
                  Groups
                </span>
                <span className="badge inline-flex items-center gap-1.5">
                  <Radio className="h-3.5 w-3.5 text-[color:var(--ui-accent)]" />
                  Realtime
                </span>
              </div>
            </motion.div>
          </section>

          {/* Preview card */}
          <motion.section
            id="preview"
            className="relative scroll-mt-24"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.06, ease: [0.2, 0.9, 0.2, 1] }}
          >
            <AnimatedChatPreview />
          </motion.section>
        </div>

        {/* Stats strip */}
        <div className="mx-auto mt-4 max-w-6xl px-4">
          <motion.div
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.28 }}
          >
            {[
              {
                label: 'Messages',
                value: 1000,
                suffix: '+ messages/sec',
                sub: 'Optimized UI + realtime updates',
                icon: Zap,
              },
              {
                label: 'Uptime',
                value: 99,
                suffix: '.9% uptime',
                sub: 'Stable sessions and retries',
                icon: Bell,
              },
              {
                label: 'Cold start',
                value: 0,
                suffix: 'ms cold start',
                sub: 'Fast navigation + caching',
                icon: Monitor,
              },
            ].map((s, idx) => (
              <div
                key={s.label}
                className="glass group relative overflow-hidden rounded-2xl px-5 py-4"
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br from-ui-grad-from/25 to-transparent" />
                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-slate-600/80 dark:text-slate-200/70">
                      {s.label}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                      <AnimatedCounter
                        value={s.value}
                        durationMs={900}
                        format={(v) => (s.label === 'Uptime' ? `${v}` : `${v.toLocaleString()}`)}
                      />
                      <span>{s.suffix}</span>
                    </div>
                    <div className="mt-0.5 text-sm text-slate-600/70 dark:text-slate-300/70">{s.sub}</div>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-ui-border bg-white/60 text-[color:var(--ui-accent)] shadow-[var(--shadow-soft)] dark:bg-white/10">
                    <s.icon className="h-5 w-5" aria-hidden />
                  </div>
                </div>
                <div className="mt-3 overflow-hidden rounded-xl border border-ui-border/60 bg-white/40 dark:bg-white/5">
                  <details className="group/details">
                    <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-slate-700/80 dark:text-slate-200/80">
                      More
                      <span className="float-right opacity-60 group-open/details:opacity-100">→</span>
                    </summary>
                    <div className="px-3 pb-3 text-xs text-slate-600/80 dark:text-slate-300/80">
                      Tuned for smooth typing, quick loads, and clean UI state.
                    </div>
                  </details>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Features */}
        <section id="features" className="mx-auto mt-20 max-w-6xl scroll-mt-24 px-4 pb-4">
          <motion.div
            className="mb-10 max-w-2xl"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.28 }}
          >
            <p className="badge mb-3 inline-flex">Why D-Lite</p>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
              Everything in one place
            </h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Less clutter, more speed. The cards below summarize the core features — tell us what you want to add or
              remove next.
            </p>
          </motion.div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: MessageCircle, title: 'Chat', desc: 'Fast DMs with a clean thread UI.', href: '#preview' },
              { icon: Users, title: 'Groups', desc: 'Rooms that feel like modern messengers.', href: '#features' },
              { icon: Radio, title: 'Calls', desc: 'Jump from chat to calls quickly.', href: '#features' },
              { icon: Sparkles, title: 'AI Friend', desc: 'Playful assistant vibes (optional).', href: '#features' },
              { icon: Lock, title: 'Encryption', desc: 'Security messaging ready for your policy.', href: '#features' },
              { icon: Monitor, title: 'Cross-platform', desc: 'Responsive UI across screens.', href: '#features' },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                className="card group relative overflow-hidden p-6 transition duration-200 hover:-translate-y-[2px] hover:border-ui-accent/40"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.28, delay: i * 0.04 }}
              >
                <div
                  className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-br from-ui-grad-from/20 to-transparent opacity-80"
                />
                <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-ui-border bg-ui-muted/60 text-[color:var(--ui-accent)] transition duration-200 group-hover:scale-[1.07] dark:bg-ui-muted/40">
                  <f.icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="relative mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">{f.title}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{f.desc}</p>
                <a href={f.href} className="relative mt-4 inline-flex text-sm font-semibold text-ui-link hover:underline">
                  Learn more →
                </a>
              </motion.div>
            ))}
          </div>

          <section className="mt-14">
            <motion.div
              className="mb-6 flex items-end justify-between gap-3"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.28 }}
            >
              <div>
                <p className="badge mb-3 inline-flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 text-[color:var(--ui-accent)]" aria-hidden />
                  Testimonials
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
                  People love the speed
                </h2>
              </div>
              <p className="hidden text-sm text-slate-600 dark:text-slate-400 md:block">Auto-advances every 5s</p>
            </motion.div>

            <Testimonials />
          </section>
        </section>

        {/* CTA */}
        <section className="mx-auto mt-16 max-w-6xl px-4 pb-6">
          <motion.div
            className="card relative overflow-hidden p-8 md:flex md:items-center md:justify-between md:gap-8 md:p-10"
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.28 }}
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-violet-600/15 via-transparent to-indigo-500/12" />
            <div className="relative max-w-xl">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 md:text-3xl">Ready to try?</h2>
              <p className="mt-2 text-slate-600 dark:text-slate-300">
                Create an account, open the dashboard, and try private chat. Next up: pick colors, add sections like
                pricing, testimonials, or FAQ — whatever you need.
              </p>
            </div>
            <div className="relative mt-6 flex flex-wrap gap-3 md:mt-0 md:shrink-0">
              {isAuthenticated ? (
                <Button asChild size="lg">
                  <Link href="/dashboard">
                    Open dashboard <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg">
                    <Link href="/register">
                      Create account <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" size="lg">
                    <Link href="/login">Login</Link>
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        </section>
      </main>

      <Footer isAuthenticated={isAuthenticated} />
    </div>
  );
}

function Testimonials() {
  const reduce = useMemo(() => prefersReducedMotion(), []);
  const [idx, setIdx] = useState(0);
  const list = useMemo(
    () => [
      { quote: '“Feels instant. Like Telegram but cleaner.”', name: 'Aarav', role: 'Designer' },
      { quote: '“The UI is smooth — no weird refreshes.”', name: 'Sana', role: 'Frontend Dev' },
      { quote: '“Groups + DMs in one dashboard is perfect.”', name: 'Rohit', role: 'Team Lead' },
    ],
    []
  );

  useEffect(() => {
    if (reduce) return () => undefined;
    const t = window.setInterval(() => setIdx((i) => (i + 1) % list.length), 5000);
    return () => window.clearInterval(t);
  }, [reduce, list.length]);

  return (
    <div className="relative">
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {list.map((t, i) => (
          <motion.div
            key={t.name}
            className={cn(
              'glass snap-center shrink-0 rounded-3xl p-5',
              'w-[85%] sm:w-[360px]',
              i === idx ? 'ring-2 ring-[var(--ui-accent)]/25' : 'ring-1 ring-ui-border/60'
            )}
            whileHover={reduce ? undefined : { y: -2 }}
            transition={{ duration: 0.2 }}
          >
            <p className="text-sm leading-relaxed text-slate-900 dark:text-slate-50">{t.quote}</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-ui-grad-from to-ui-grad-to text-white shadow-[var(--shadow-accent)]" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">{t.name}</div>
                <div className="text-xs text-slate-600 dark:text-slate-300">{t.role}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        {list.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to testimonial ${i + 1}`}
            onClick={() => setIdx(i)}
            className={cn(
              'h-2 w-2 rounded-full transition',
              i === idx ? 'bg-[color:var(--ui-accent)]' : 'bg-ui-border'
            )}
          />
        ))}
      </div>
    </div>
  );
}

function Footer({ isAuthenticated }) {
  return (
    <footer className="mt-16 border-t border-ui-border bg-ui-shell/60 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-[1.2fr_2fr]">
          <div>
            <div className="flex items-center gap-2">
              <AppLogo variant="footer" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">D-Lite</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-slate-600 dark:text-slate-400">
              Premium chat UI with groups and calls — tuned for speed.
            </p>
            <div className="mt-5 flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <a className="rounded-xl p-2 hover:bg-ui-muted" href="#" aria-label="Twitter">
                <Twitter className="h-5 w-5" aria-hidden />
              </a>
              <a className="rounded-xl p-2 hover:bg-ui-muted" href="#" aria-label="GitHub">
                <Github className="h-5 w-5" aria-hidden />
              </a>
              <a className="rounded-xl p-2 hover:bg-ui-muted" href="#" aria-label="LinkedIn">
                <Bell className="h-5 w-5" aria-hidden />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Product</div>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li>
                  <a href="#features" className="no-underline hover:text-slate-900 dark:hover:text-slate-200">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#preview" className="no-underline hover:text-slate-900 dark:hover:text-slate-200">
                    Live preview
                  </a>
                </li>
                {isAuthenticated ? (
                  <li>
                    <Link href="/dashboard" className="no-underline hover:text-slate-900 dark:hover:text-slate-200">
                      Dashboard
                    </Link>
                  </li>
                ) : null}
              </ul>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Account</div>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li>
                  <Link href="/login" className="no-underline hover:text-slate-900 dark:hover:text-slate-200">
                    Login
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="no-underline hover:text-slate-900 dark:hover:text-slate-200">
                    Register
                  </Link>
                </li>
                <li>
                  <Link href="/forgot-password" className="no-underline hover:text-slate-900 dark:hover:text-slate-200">
                    Forgot password
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Resources</div>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li>
                  <a href="#" className="no-underline hover:text-slate-900 dark:hover:text-slate-200">
                    Docs
                  </a>
                </li>
                <li>
                  <a href="#" className="no-underline hover:text-slate-900 dark:hover:text-slate-200">
                    Status
                  </a>
                </li>
                <li>
                  <a href="#" className="no-underline hover:text-slate-900 dark:hover:text-slate-200">
                    Support
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Legal</div>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li>
                  <a href="#" className="no-underline hover:text-slate-900 dark:hover:text-slate-200">
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#" className="no-underline hover:text-slate-900 dark:hover:text-slate-200">
                    Terms
                  </a>
                </li>
                <li>
                  <a href="#" className="no-underline hover:text-slate-900 dark:hover:text-slate-200">
                    Cookies
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-ui-border pt-6 text-xs text-slate-500 dark:text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} D-Lite</p>
          <p>
            Made with <span aria-hidden="true">❤️</span> in India
          </p>
        </div>
      </div>
    </footer>
  );
}
