'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

function Spinner({ className }) {
  return (
    <span
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white',
        className
      )}
      aria-hidden="true"
    />
  );
}

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition duration-150 ease-out will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ui-canvas)] disabled:pointer-events-none disabled:opacity-60 disabled:grayscale',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-r from-ui-grad-from to-ui-grad-to text-white shadow-[var(--shadow-accent)] hover:-translate-y-[1px] hover:brightness-105 active:translate-y-0 active:scale-[0.98] dark:shadow-black/30',
        secondary:
          'border border-ui-border bg-ui-panel text-slate-800 shadow-[var(--shadow-soft)] hover:-translate-y-[1px] hover:bg-ui-muted active:translate-y-0 active:scale-[0.97] dark:text-slate-100 dark:hover:bg-ui-muted',
        ghost:
          'text-slate-700 hover:-translate-y-[1px] hover:bg-ui-muted active:translate-y-0 active:scale-[0.97] dark:text-slate-100 dark:hover:bg-ui-muted/80',
        destructive:
          'bg-red-600 text-white shadow-[var(--shadow-md)] hover:-translate-y-[1px] hover:bg-red-500 active:translate-y-0 active:scale-[0.98]'
      },
      size: {
        default: 'h-10 px-4 py-2.5',
        sm: 'h-9 rounded-lg px-3',
        lg: 'h-11 px-5',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

const Button = React.forwardRef(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      loadingText = 'Loading…',
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
  const Comp = asChild ? Slot : 'button';
  const isDisabled = Boolean(disabled || loading);

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      disabled={isDisabled}
      aria-busy={loading ? 'true' : undefined}
      {...props}
    >
      {loading ? (
        <span className="relative inline-flex items-center gap-2">
          <Spinner />
          <span className="relative">
            <span className="absolute inset-0 animate-pulse bg-white/10 blur-md" aria-hidden="true" />
              <span className="relative">{loadingText}</span>
          </span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-2">
          {leftIcon ? <span className="inline-flex">{leftIcon}</span> : null}
          <span>{children}</span>
          {rightIcon ? <span className="inline-flex">{rightIcon}</span> : null}
        </span>
      )}
    </Comp>
  );
}
);
Button.displayName = 'Button';

export { Button, buttonVariants };
