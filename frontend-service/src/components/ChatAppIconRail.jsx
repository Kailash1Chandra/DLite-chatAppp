'use client';

import Link from 'next/link';
import {
  BarChart2,
  Database,
  Gift,
  Megaphone,
  MessageCircle,
  Phone,
  Settings,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppHeaderMenu } from '@/components/AppHeaderMenu';
import { ProfileMenu } from '@/components/ProfileMenu';

const linkInactiveH =
  'flex min-h-[3.25rem] w-[4.25rem] flex-col items-center justify-center gap-0.5 rounded-2xl px-1.5 py-1.5 text-slate-600 transition hover:scale-[1.05] hover:bg-ui-muted hover:text-ui-accent active:scale-[0.98] dark:text-slate-300';

const linkActiveH =
  'flex min-h-[3.25rem] w-[4.25rem] flex-col items-center justify-center gap-0.5 rounded-2xl bg-ui-accent px-1.5 py-1.5 text-ui-on-accent shadow-[var(--shadow-accent)] ring-1 ring-white/15 dark:shadow-black/25';

const linkInactiveV =
  'flex h-10 w-10 items-center justify-center rounded-xl text-ui-rail-fg-muted transition hover:scale-[1.05] hover:bg-ui-muted hover:text-ui-accent active:scale-[0.98] dark:hover:bg-white/10 dark:hover:text-ui-rail-fg';

const linkActiveV =
  'flex h-10 w-10 items-center justify-center rounded-xl bg-ui-accent text-ui-on-accent shadow-[var(--shadow-accent)] ring-1 ring-white/20 dark:shadow-inner dark:ring-white/15';

const iconBtnGhost =
  'flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-xl text-ui-rail-fg-muted opacity-45';

function SoonIcon({ Icon, title }) {
  return (
    <span className="relative">
      <span className={iconBtnGhost} title={title}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="absolute -right-1 -top-1 rounded-full border border-ui-border bg-ui-panel px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-200">
        soon
      </span>
    </span>
  );
}

/**
 * @param {'horizontal' | 'vertical'} [props.variant]
 */
export function ChatAppIconRail({
  active: activeNav = 'dm',
  dmUnreadCount = 0,
  menuLinks = [],
  variant = 'horizontal',
}) {
  if (variant === 'vertical') {
    return (
      <div className="flex h-full min-h-0 w-[64px] shrink-0 flex-col items-center border-r border-ui-border bg-ui-rail py-3">
        <div className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto">
          <Link
            href="/dashboard"
            className={activeNav === 'dm' ? linkActiveV : linkInactiveV}
            title="Chats"
            aria-current={activeNav === 'dm' ? 'page' : undefined}
          >
            <MessageCircle className="h-5 w-5" />
          </Link>
          <Link href="/groups" className={activeNav === 'groups' ? linkActiveV : linkInactiveV} title="Groups">
            <Users className="h-5 w-5" />
          </Link>
          <Link href="/call" className={activeNav === 'call' ? linkActiveV : linkInactiveV} title="Calls">
            <Phone className="h-5 w-5" />
          </Link>
          <div className="my-1 h-px w-7 bg-ui-border" aria-hidden />
          <SoonIcon Icon={BarChart2} title="Analytics — coming soon" />
          <SoonIcon Icon={Megaphone} title="Campaigns — coming soon" />
          <SoonIcon Icon={Database} title="Data — coming soon" />
        </div>
        <div className="mt-auto flex flex-col items-center gap-2 border-t border-ui-border pt-3">
          <SoonIcon Icon={Gift} title="Rewards — coming soon" />
          <SoonIcon Icon={Settings} title="Settings — coming soon" />
          <div className="flex flex-col items-center gap-1 [&_button]:text-ui-rail-fg [&_button:hover]:bg-ui-muted dark:[&_button:hover]:bg-white/10">
            <AppHeaderMenu
              collapseActionsInMenu
              showChatsInCollapsedMenu={false}
              chatsUnreadCount={dmUnreadCount}
              menuLinks={menuLinks}
            />
            <div className="relative">
              <ProfileMenu />
              <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-ui-rail" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-ui-border bg-ui-sidebar px-3 py-2.5">
      {/* Left spacer: keeps center truly centered */}
      <div />

      {/* Center nav */}
      <div className="flex items-center justify-center gap-1 sm:gap-1.5">
        <Link
          href="/dashboard"
          className={cn('relative', activeNav === 'dm' ? linkActiveH : linkInactiveH)}
          title="Messages"
          aria-current={activeNav === 'dm' ? 'page' : undefined}
        >
          <MessageCircle className="h-5 w-5" />
          <span className={cn('text-[10px] font-semibold leading-tight', activeNav === 'dm' ? 'text-ui-on-accent' : 'text-slate-600 dark:text-slate-300')}>
            Messages
          </span>
          {dmUnreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-ui-shell">
              {dmUnreadCount > 99 ? '99+' : dmUnreadCount}
            </span>
          ) : null}
        </Link>
        <Link
          href="/groups"
          className={activeNav === 'groups' ? linkActiveH : linkInactiveH}
          title="Groups"
          aria-current={activeNav === 'groups' ? 'page' : undefined}
        >
          <Users className="h-5 w-5" />
          <span className={cn('text-[10px] font-semibold leading-tight', activeNav === 'groups' ? 'text-ui-on-accent' : 'text-slate-600 dark:text-slate-300')}>
            Groups
          </span>
        </Link>
        <Link
          href="/call"
          className={activeNav === 'call' ? linkActiveH : linkInactiveH}
          title="Calls"
          aria-current={activeNav === 'call' ? 'page' : undefined}
        >
          <Phone className="h-5 w-5" />
          <span className={cn('text-[10px] font-semibold leading-tight', activeNav === 'call' ? 'text-ui-on-accent' : 'text-slate-600 dark:text-slate-300')}>
            Calls
          </span>
        </Link>
      </div>

      {/* Right-side actions */}
      <div className="ml-auto flex items-center justify-end gap-0.5">
        <AppHeaderMenu
          collapseActionsInMenu
          showChatsInCollapsedMenu={false}
          chatsUnreadCount={dmUnreadCount}
          menuLinks={menuLinks}
        />
        <ProfileMenu />
      </div>
    </div>
  );
}
