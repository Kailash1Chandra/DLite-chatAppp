'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

function scorePassword(pw) {
  const s = String(pw || '');
  let score = 0;
  if (s.length >= 8) score += 1;
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) score += 1;
  if (/\d/.test(s)) score += 1;
  if (/[^A-Za-z0-9]/.test(s)) score += 1;
  return score;
}

function feedback(pw) {
  const s = String(pw || '');
  if (!s) return 'Use 8+ characters';
  if (s.length < 8) return 'Use 8+ characters';
  if (!(/[a-z]/.test(s) && /[A-Z]/.test(s))) return 'Add uppercase';
  if (!/\d/.test(s)) return 'Add a number';
  if (!/[^A-Za-z0-9]/.test(s)) return 'Add a special character';
  return 'Strong password!';
}

export default function PasswordStrengthMeter({ password, className }) {
  const score = useMemo(() => scorePassword(password), [password]);
  const text = useMemo(() => feedback(password), [password]);

  const colorFor = (i) => {
    if (score <= 0) return 'bg-ui-border';
    if (i > score) return 'bg-ui-border';
    if (score === 1) return 'bg-red-500';
    if (score === 2) return 'bg-amber-500';
    if (score === 3) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  const textColor =
    score >= 4 ? 'text-emerald-700 dark:text-emerald-300' : score >= 3 ? 'text-yellow-700 dark:text-yellow-300' : score >= 2 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300';

  return (
    <div className={cn('mt-2', className)}>
      <div className="flex items-center gap-2" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-ui-border/60">
            <div className={cn('h-full w-full rounded-full transition-colors duration-200', colorFor(i))} />
          </div>
        ))}
      </div>
      <div className={cn('mt-2 text-sm', textColor)}>{text}</div>
    </div>
  );
}

