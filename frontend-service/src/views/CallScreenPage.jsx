'use client';

import dynamic from 'next/dynamic';
import { AppMainHeader } from '@/components/AppMainHeader';

const CallUI = dynamic(() => import('@/components/CallUI'), {
  loading: () => (
    <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-500 dark:text-slate-400">Loading call…</div>
  ),
});

export default function CallScreenPage() {
  return (
    <div className="app-shell flex h-[100dvh] min-h-0 flex-col overflow-hidden">
      <AppMainHeader />
      <main className="flex min-h-0 flex-1 overflow-y-auto">
        <CallUI
          defaultMode="audio"
          title="Voice and video calls"
          description="Start a direct call with another signed-in user and choose audio or video on the same page."
          theme="enhanced"
        />
      </main>
    </div>
  );
}
