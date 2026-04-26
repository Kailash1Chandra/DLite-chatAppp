'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { cn, prefersReducedMotion } from '@/lib/utils';

function TypingDots() {
  return (
    <div className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.25s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.12s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300" />
    </div>
  );
}

function Avatar({ label = 'U', tone = 'you', typing = false }) {
  const ring = typing ? 'ring-2 ring-emerald-500/70' : 'ring-1 ring-ui-border';
  const bg =
    tone === 'you'
      ? 'bg-gradient-to-br from-ui-grad-from to-ui-grad-to text-white'
      : 'bg-white/70 text-slate-900 dark:bg-white/10 dark:text-slate-100';
  return (
    <div className={cn('h-8 w-8 shrink-0 rounded-2xl shadow-[var(--shadow-soft)]', ring, bg, 'flex items-center justify-center text-xs font-bold')}>
      {label}
    </div>
  );
}

export default function AnimatedChatPreview({ className }) {
  const reduce = useMemo(() => prefersReducedMotion(), []);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduce) return () => undefined;
    const schedule = [800, 700, 800, 700, 800, 700, 1200, 800, 800, 900];
    let t = null;
    let idx = 0;
    const tick = () => {
      setStep(idx);
      const wait = schedule[idx] || 900;
      idx = (idx + 1) % schedule.length;
      t = window.setTimeout(tick, wait);
    };
    t = window.setTimeout(tick, schedule[0]);
    return () => {
      if (t) window.clearTimeout(t);
    };
  }, [reduce]);

  const youTyping = !reduce && (step === 0 || step === 2 || step === 4);
  const mateTyping = !reduce && (step === 1 || step === 3 || step === 5);

  return (
    <div className={cn('glass relative overflow-hidden rounded-3xl p-5', className)}>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-ui-grad-from/10 via-transparent to-pink-400/10" />
      <div className="relative flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600/70 dark:text-slate-200/70">
            Live preview
          </p>
          <p className="mt-1 text-sm text-slate-700/80 dark:text-slate-200/80">Typing → delivered → read</p>
        </div>
        <span className="badge border-emerald-600/30 bg-emerald-500/15 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
          Online
        </span>
      </div>

      <div className="relative mt-5 space-y-3">
        <div className="flex items-end gap-3">
          <Avatar label="Y" tone="you" typing={youTyping} />
          <div className="w-fit max-w-[85%] rounded-2xl border border-ui-border bg-white/60 px-3 py-2 text-sm text-slate-900 dark:bg-black/20 dark:text-slate-100">
            <AnimatePresence mode="wait">
              {reduce ? (
                <motion.span key="msg1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  Hey! New design dropped 🎨
                </motion.span>
              ) : step === 0 ? (
                <motion.span key="t1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <TypingDots />
                </motion.span>
              ) : (
                <motion.span key="m1" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  Hey! New design dropped 🎨
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-end justify-end gap-3">
          <div className="w-fit max-w-[85%] rounded-2xl border border-white/35 bg-gradient-to-r from-ui-grad-from to-ui-grad-to px-3 py-2 text-sm text-white">
            <AnimatePresence mode="wait">
              {reduce ? (
                <motion.span key="msg2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  Looks clean!
                </motion.span>
              ) : step < 2 ? (
                <motion.span key="t2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <TypingDots />
                </motion.span>
              ) : (
                <motion.span key="m2" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  Looks clean!
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <Avatar label="T" tone="mate" typing={mateTyping} />
        </div>

        <div className="flex items-end gap-3">
          <Avatar label="Y" tone="you" typing={youTyping} />
          <div className="w-fit max-w-[85%] rounded-2xl border border-ui-border bg-white/60 px-3 py-2 text-sm text-slate-900 dark:bg-black/20 dark:text-slate-100">
            <AnimatePresence mode="wait">
              {reduce ? (
                <motion.span key="msg3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  Let&apos;s call?
                </motion.span>
              ) : step < 4 ? (
                <motion.span key="t3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <TypingDots />
                </motion.span>
              ) : (
                <motion.span key="m3" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  Let&apos;s call?
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-end justify-end gap-3">
          <div className="w-fit max-w-[85%] rounded-2xl border border-white/35 bg-gradient-to-r from-ui-grad-from to-ui-grad-to px-3 py-2 text-sm text-white">
            <AnimatePresence mode="wait">
              {reduce ? (
                <motion.span key="msg4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  Calling now... 📞
                </motion.span>
              ) : step < 6 ? (
                <motion.span key="t4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <TypingDots />
                </motion.span>
              ) : (
                <motion.span key="m4" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  Calling now... 📞
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <Avatar label="T" tone="mate" typing={mateTyping} />
        </div>

        <AnimatePresence>
          {(reduce || step >= 8) && (
            <motion.div
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-auto mt-1 w-fit rounded-full border border-ui-border bg-white/55 px-3 py-1 text-xs text-slate-700 dark:bg-white/10 dark:text-slate-200"
            >
              ✅ Call connected
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

