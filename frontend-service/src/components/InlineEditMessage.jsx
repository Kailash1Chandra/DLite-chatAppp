'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function InlineEditMessage({ initialValue, onCancel, onSave, className }) {
  const [value, setValue] = useState(String(initialValue || ''));
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      el.focus();
      el.setSelectionRange?.(0, el.value.length);
    } catch {
      /* ignore */
    }
  }, []);

  const canSave = useMemo(() => String(value || '').trim().length > 0, [value]);

  return (
    <div className={cn('w-full', className)}>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel?.();
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            if (!canSave) return;
            onSave?.(String(value || '').trim());
          }
        }}
        className="min-h-[44px] w-full resize-none rounded-2xl border border-ui-border bg-ui-panel px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] dark:text-slate-50"
        rows={1}
      />
      <div className="mt-2 flex items-center gap-2">
        <Button
          onClick={() => {
            if (!canSave) return;
            onSave?.(String(value || '').trim());
          }}
          disabled={!canSave}
          className="h-9"
        >
          Save
        </Button>
        <Button variant="ghost" onClick={onCancel} className="h-9">
          Cancel
        </Button>
      </div>
    </div>
  );
}

