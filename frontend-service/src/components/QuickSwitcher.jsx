'use client';

import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, MessageSquare, Search, Users } from 'lucide-react';
import { cn, prefersReducedMotion } from '@/lib/utils';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'people', label: 'People' },
  { id: 'messages', label: 'Messages' },
  { id: 'files', label: 'Files' },
  { id: 'groups', label: 'Groups' },
];

const SAMPLE = [
  { type: 'people', title: 'sana', snippet: 'Online • DM', icon: Users, href: '/dashboard' },
  { type: 'people', title: 'aarav', snippet: 'Last seen 2m ago • DM', icon: Users, href: '/dashboard' },
  { type: 'groups', title: 'design', snippet: 'Group • 12 members', icon: Users, href: '/groups' },
  { type: 'messages', title: 'Looks clean!', snippet: 'From teammate • “Looks clean!”', icon: MessageSquare, href: '/dashboard' },
  { type: 'files', title: 'spec.pdf', snippet: 'Shared file • 2.1MB', icon: FileText, href: '/dashboard' },
];

export default function QuickSwitcher() {
  const reduce = useMemo(() => prefersReducedMotion(), []);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  const close = useCallback(() => {
    setOpen(false);
    setQ('');
    setTab('all');
    setActive(0);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      const key = String(e.key || '').toLowerCase();
      const isK = key === 'k';
      const mod = e.metaKey || e.ctrlKey;
      if (mod && isK) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (!open) return;
      if (key === 'escape') {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    const onEvent = () => setOpen(true);
    window.addEventListener('dlite:quickswitcher', onEvent);
    return () => window.removeEventListener('dlite:quickswitcher', onEvent);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus?.(), 10);
    return () => window.clearTimeout(t);
  }, [open]);

  const results = useMemo(() => {
    const query = String(q || '').trim().toLowerCase();
    const filtered = SAMPLE.filter((r) => (tab === 'all' ? true : r.type === tab));
    if (!query) return filtered;
    return filtered.filter((r) => `${r.title} ${r.snippet}`.toLowerCase().includes(query));
  }, [q, tab]);

  useEffect(() => {
    setActive(0);
  }, [q, tab]);

  useEffect(() => {
    if (!open) return;
    const onNav = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => Math.min(results.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        const r = results[active];
        if (!r) return;
        close();
        window.location.assign(r.href);
      }
    };
    document.addEventListener('keydown', onNav);
    return () => document.removeEventListener('keydown', onNav);
  }, [open, results, active, close]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[220]"
          initial={reduce ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Global search"
        >
          <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={close} />

          <motion.div
            className="absolute left-1/2 top-10 w-[min(92vw,640px)] -translate-x-1/2"
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: reduce ? 0 : 0.18, ease: [0.2, 0.9, 0.2, 1] }}
          >
            <div className="glass overflow-hidden rounded-3xl">
              <div className="flex items-center gap-3 border-b border-ui-border px-4 py-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ui-muted/70 text-[color:var(--ui-accent)] dark:bg-ui-muted/40">
                  <Search className="h-5 w-5" aria-hidden />
                </span>
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full bg-transparent text-base font-semibold text-slate-900 outline-none placeholder:text-slate-500 dark:text-slate-50 dark:placeholder:text-slate-400"
                  placeholder="Search people, messages, files, groups…"
                  aria-label="Search"
                />
                <span className="hidden rounded-xl border border-ui-border bg-white/50 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200 sm:inline">
                  Esc
                </span>
              </div>

              <div className="flex items-center gap-2 border-b border-ui-border px-3 py-2">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-bold transition',
                      tab === t.id
                        ? 'bg-ui-accent-subtle text-ui-accent-text'
                        : 'text-slate-600 hover:bg-ui-muted dark:text-slate-300 dark:hover:bg-white/10'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="max-h-[55vh] overflow-y-auto p-2">
                {results.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-slate-600 dark:text-slate-300">
                    No results. Try a different keyword.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {results.map((r, i) => (
                      <button
                        key={`${r.type}-${r.title}-${i}`}
                        type="button"
                        onMouseEnter={() => setActive(i)}
                        onClick={() => {
                          close();
                          window.location.assign(r.href);
                        }}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-2xl px-3 py-2 text-left transition',
                          i === active ? 'bg-ui-muted' : 'hover:bg-ui-muted/70',
                          'dark:hover:bg-white/10'
                        )}
                      >
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-ui-border bg-white/60 text-[color:var(--ui-accent)] shadow-[var(--shadow-soft)] dark:bg-white/10">
                          <r.icon className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                            {r.title}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-600 dark:text-slate-300">
                            {r.snippet}
                          </span>
                        </span>
                        <span className="mt-1 hidden text-xs font-semibold text-slate-500 sm:inline">Enter</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-ui-border px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                <span>
                  <span className="font-semibold">↑↓</span> navigate • <span className="font-semibold">Enter</span> open
                </span>
                <span className="hidden sm:inline">
                  <span className="font-semibold">Ctrl/Cmd</span> + <span className="font-semibold">K</span>
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

