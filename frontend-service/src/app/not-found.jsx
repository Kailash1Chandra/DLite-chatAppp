 'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

function BrokenPhoneSvg() {
  return (
    <svg width="220" height="140" viewBox="0 0 220 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="70" y="14" width="80" height="112" rx="18" fill="url(#g)" stroke="rgba(0,0,0,0.08)" />
      <rect x="82" y="30" width="56" height="76" rx="10" fill="rgba(255,255,255,0.5)" />
      <path d="M90 52 L130 84" stroke="rgba(234,88,12,0.7)" strokeWidth="6" strokeLinecap="round" />
      <path d="M130 52 L90 84" stroke="rgba(234,88,12,0.5)" strokeWidth="6" strokeLinecap="round" />
      <circle cx="110" cy="112" r="5" fill="rgba(31,41,55,0.55)" />
      <path d="M32 34 C40 18, 56 18, 64 34" stroke="rgba(234,88,12,0.35)" strokeWidth="6" strokeLinecap="round" />
      <path d="M156 40 C164 24, 180 24, 188 40" stroke="rgba(234,88,12,0.25)" strokeWidth="6" strokeLinecap="round" />
      <defs>
        <linearGradient id="g" x1="70" y1="14" x2="150" y2="126" gradientUnits="userSpaceOnUse">
          <stop stopColor="rgba(249,115,22,0.35)" />
          <stop offset="1" stopColor="rgba(234,88,12,0.15)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function NotFound() {
  return (
    <div className="app-shell flex min-h-[100dvh] items-center justify-center bg-ui-canvas p-4">
      <motion.div
        className="w-full max-w-2xl rounded-3xl border border-ui-border bg-ui-panel p-6 shadow-2xl shadow-black/10 dark:shadow-black/40"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.2, 0.9, 0.2, 1] }}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <BrokenPhoneSvg />
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">404</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Looks like you took a wrong turn
          </h1>
          <p className="max-w-md text-sm text-slate-600 dark:text-slate-300">
            The page you’re looking for doesn’t exist. Try heading back, or search for a chat.
          </p>

          <div className="mt-1 flex w-full max-w-md items-center gap-2 rounded-2xl border border-ui-border bg-white/50 px-3 py-2 dark:bg-white/5">
            <Search className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <input
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500 dark:text-slate-50"
              placeholder="Looking for someone? Search here"
              disabled
            />
          </div>

          <div className="mt-4 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild className="sm:min-w-[190px]">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
            <Button asChild variant="ghost" className="sm:min-w-[190px]">
              <Link href="/">Go home</Link>
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
