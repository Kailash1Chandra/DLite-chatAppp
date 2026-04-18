'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 dark:focus-visible:ring-violet-400/45 disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        default:
          'bg-violet-600 text-white hover:bg-violet-500 shadow-[0_10px_35px_-18px_rgba(124,58,237,0.45)] dark:bg-violet-600 dark:hover:bg-violet-500 dark:shadow-[0_10px_35px_-18px_rgba(139,92,246,0.35)]',
        secondary:
          'border border-slate-200/90 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
        ghost:
          'text-slate-700 hover:bg-slate-100/90 dark:text-slate-100 dark:hover:bg-slate-800/60',
        destructive: 'bg-red-600 text-white hover:bg-red-500'
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

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };
