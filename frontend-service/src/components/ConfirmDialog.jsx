'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useConfirmContext } from '@/context/ConfirmContext';

function FocusTrap({ active, children }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;
    const focusables = root.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    first?.focus?.();

    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      if (!focusables.length) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus?.();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus?.();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active]);

  return (
    <div ref={ref}>
      {children}
    </div>
  );
}

export default function ConfirmDialog() {
  const { state, resolve, hide } = useConfirmContext();
  const open = !!state?.open;

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        resolve(false);
        hide();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, hide, resolve]);

  const variant = String(state?.variant || 'primary');
  const actionVariant = variant === 'danger' ? 'destructive' : 'default';

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[350] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              resolve(false);
              hide();
            }
          }}
        >
          <motion.div
            className={cn(
              'w-full max-w-md rounded-3xl border border-ui-border bg-ui-panel p-6 shadow-2xl shadow-black/35'
            )}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ duration: 0.2, ease: [0.2, 0.9, 0.2, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label={state?.title || 'Confirm'}
          >
            <FocusTrap active={open}>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
                {state?.title || 'Are you sure?'}
              </h2>
              {state?.description ? (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{state.description}</p>
              ) : null}

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="ghost"
                  onClick={() => {
                    resolve(false);
                    hide();
                  }}
                >
                  {state?.cancelText || 'Cancel'}
                </Button>
                <Button
                  variant={actionVariant}
                  onClick={() => {
                    resolve(true);
                    hide();
                  }}
                >
                  {state?.confirmText || 'Confirm'}
                </Button>
              </div>
            </FocusTrap>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

