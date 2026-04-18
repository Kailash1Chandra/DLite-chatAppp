'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const items = [
  { href: '/dashboard', label: 'Chat', caption: 'Messages', icon: MessageSquare },
  { href: '/groups', label: 'Groups', caption: 'Groups', icon: Users }
];

/**
 * Horizontal icon nav (Chat, Groups, Calls). Optional captions under icons.
 */
export function AppNavIcons({ className, showLabels = false }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'flex flex-shrink-0 items-center gap-1 rounded-2xl border border-slate-200/80 bg-white/90 p-1 dark:border-slate-700 dark:bg-slate-900/80',
        showLabels && 'gap-0.5 border-0 bg-transparent p-0 dark:bg-transparent',
        className
      )}
      aria-label="Main navigation"
    >
      {items.map(({ href, label, caption, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Button
            key={href}
            asChild
            variant={active ? 'default' : 'ghost'}
            {...(showLabels ? {} : { size: 'icon' })}
            className={cn(
              'rounded-xl',
              showLabels
                ? 'h-auto min-h-[3.5rem] w-[4.25rem] flex-col gap-0.5 px-1.5 py-1.5 sm:w-[4.75rem] sm:py-2'
                : 'h-10 w-10',
              !active && 'text-slate-600 hover:bg-violet-50 dark:text-slate-300 dark:hover:bg-slate-800/80'
            )}
          >
            <Link
              href={href}
              title={label}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={cn(showLabels && 'flex flex-col items-center justify-center gap-0.5 no-underline')}
            >
              <Icon className={cn('shrink-0', showLabels ? 'h-5 w-5' : 'h-5 w-5')} />
              {showLabels && (
                <span
                  className={cn(
                    'max-w-full truncate text-center text-[10px] font-semibold leading-tight sm:text-[11px]',
                    active
                      ? 'text-white dark:text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  )}
                >
                  {caption}
                </span>
              )}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
