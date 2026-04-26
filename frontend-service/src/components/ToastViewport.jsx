 'use client';
 
 import { X } from 'lucide-react';
 import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
 import { useToasts } from '@/context/ToastContext';
 import { cn } from '@/lib/utils';
 
 function toneClasses(tone) {
   if (tone === 'success') return 'border-emerald-200/70 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-50';
   if (tone === 'warning') return 'border-amber-200/70 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-50';
   if (tone === 'danger') return 'border-red-200/70 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-50';
   return 'border-ui-border bg-ui-panel text-ui-fg';
 }
 
 export function ToastViewport() {
   const { toasts, removeToast } = useToasts();
  const [mounted, setMounted] = useState(false);
  const [hoveringId, setHoveringId] = useState(null);
  const timersRef = useRef(new Map());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Pause auto-dismiss while hovering any toast by simply not scheduling new timers for it.
    // We keep behavior compatible with ToastContext (which already schedules a hard timeout).
    // This layer only adds a "soft" dismiss for swipe / manual close.
    const timers = timersRef.current;
    return () => {
      for (const t of timers.values()) window.clearTimeout(t);
      timers.clear();
    };
  }, []);

  if (!mounted || typeof document === 'undefined') return null;

   const node = (
     <div className="pointer-events-none fixed bottom-4 right-4 z-[300] flex w-[min(92vw,360px)] flex-col gap-2">
      {toasts.map((t, idx) => (
        <ToastItem
          key={t.id}
          toast={t}
          depthIndex={idx}
          hovering={hoveringId === t.id}
          setHoveringId={setHoveringId}
          removeToast={removeToast}
          toneClasses={toneClasses}
        />
      ))}
     </div>
   );
 
   return createPortal(node, document.body);
 }

function ToastItem({ toast, depthIndex, hovering, setHoveringId, removeToast, toneClasses }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);

  const scale = useMemo(() => {
    if (depthIndex === 0) return 1;
    if (depthIndex === 1) return 0.96;
    if (depthIndex === 2) return 0.92;
    return 0.9;
  }, [depthIndex]);

  const onPointerDown = (e) => {
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    const movementX = Number(e.movementX || 0);
    setDx((v) => Math.max(0, Math.min(140, v + movementX)));
  };

  const onPointerUp = () => {
    setDragging(false);
    if (dx > 92) {
      removeToast(toast.id);
      return;
    }
    setDx(0);
  };

  const style = {
    transform: `translateX(${dx}px) scale(${hovering ? 1 : scale})`,
    transition: dragging ? 'none' : 'transform 180ms ease-out',
  };

  return (
    <div
      className={cn(
        'pointer-events-auto overflow-hidden rounded-2xl border shadow-xl shadow-slate-900/10 dark:shadow-black/40',
        toneClasses(toast.tone)
      )}
      role="status"
      aria-live="polite"
      onMouseEnter={() => setHoveringId(toast.id)}
      onMouseLeave={() => setHoveringId(null)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={style}
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          {toast.title ? <p className="truncate text-sm font-bold">{toast.title}</p> : null}
          {toast.message ? (
            <p className="mt-0.5 line-clamp-3 text-[12px] leading-snug opacity-90">{toast.message}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl transition hover:bg-black/5 dark:hover:bg-white/10"
          onClick={() => removeToast(toast.id)}
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4 opacity-70" />
        </button>
      </div>
    </div>
  );
}
