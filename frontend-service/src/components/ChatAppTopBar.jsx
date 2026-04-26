'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Bell, Search, Sparkles } from 'lucide-react';
import { AppLogo } from '@/components/AppLogo';
import { cn } from '@/lib/utils';
import { prefersReducedMotion } from '@/lib/utils';

export function ChatAppTopBar({
  showSpecialFriend = false,
  onSpecialFriendClick,
  specialFriendLaunching = false,
  notificationsCount = 0
}) {
  const reduce = useMemo(() => prefersReducedMotion(), []);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'relative flex shrink-0 items-center justify-between gap-4 border-b border-ui-border bg-ui-shell/90 px-4 py-3 backdrop-blur-xl sm:px-6',
        scrolled ? 'shadow-[var(--shadow-soft)]' : null
      )}
    >
      <Link href="/" className="flex items-center gap-2.5 no-underline">
        <span className="group relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[var(--ui-grad-from)] to-[var(--ui-grad-to)] shadow-[var(--shadow-accent)]">
          <span
            className={cn(
              'pointer-events-none absolute inset-0 opacity-0 transition duration-200',
              'bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.35),transparent)]',
              reduce ? null : 'group-hover:opacity-100'
            )}
          />
          <AppLogo variant="mark" className="h-6 w-6" />
        </span>
        <span className="text-lg font-bold tracking-tight text-slate-900 transition dark:text-white group-hover:tracking-[0.01em]">
          D-Lite
        </span>
      </Link>

      {showSpecialFriend ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
          <button
            type="button"
            onClick={onSpecialFriendClick}
            disabled={specialFriendLaunching}
            className={cn(
              'pointer-events-auto relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-violet-300/45 bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white',
              'shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_36px_-14px_rgba(99,102,241,0.75)] ring-1 ring-white/15 transition duration-200',
              'hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_16px_42px_-14px_rgba(99,102,241,0.9)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70',
              specialFriendLaunching ? 'scale-95 opacity-90' : 'motion-safe:animate-pulse'
            )}
            style={{ animationDuration: '2.9s' }}
            aria-label="Open Special Friend"
          >
            <span className="absolute inset-0 bg-white/10 opacity-70 blur-xl" aria-hidden />
            <Sparkles className="relative z-10 h-4 w-4 shrink-0" aria-hidden />
            <span className="relative z-10">Special Friend</span>
          </button>
        </div>
      ) : null}

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-ui-muted hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ui-canvas)] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label="Search"
          title="Search (Ctrl/Cmd + K)"
          onClick={() => window.dispatchEvent(new Event('dlite:quickswitcher'))}
        >
          <Search className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-ui-muted hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ui-canvas)] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell className="h-5 w-5" aria-hidden />
          {notificationsCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--ui-accent)] px-1 text-[10px] font-extrabold text-white ring-2 ring-ui-shell">
              {notificationsCount > 99 ? '99+' : notificationsCount}
            </span>
          ) : null}
        </button>
        <p className="hidden text-sm font-medium text-slate-500 sm:block dark:text-slate-400">Create memorable talks</p>
      </div>
    </header>
  );
}
