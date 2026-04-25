'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatAppShell } from '@/components/ChatAppShell';
import { ChatAppIconRail } from '@/components/ChatAppIconRail';
import { ChatAppTopBar } from '@/components/ChatAppTopBar';
import { CallUsersPanel } from '@/components/CallUsersPanel';
import { useAuth } from '@/hooks/useAuth';
import { subscribeRecentDirectChats } from '@/services/chatClient';
import { DoorOpen, PlusCircle, Video } from 'lucide-react';
import { buildGroupCallRoomId, buildHostedCallUrl, formatInviteCode, generateInviteCode } from '@/lib/callRoom';

const CallUI = dynamic(() => import('@/components/CallUI'), {
  loading: () => (
    <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-500 dark:text-slate-400">
      Loading call…
    </div>
  ),
});

export default function CallScreenPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [dmRecentChats, setDmRecentChats] = useState([]);
  const [roomCode, setRoomCode] = useState('');
  const [roomMode, setRoomMode] = useState('video'); // audio | video
  const [roomError, setRoomError] = useState('');
  const [joinOpen, setJoinOpen] = useState(false);
  const dmUnreadTotal = useMemo(
    () => dmRecentChats.reduce((s, c) => s + Number(c.unreadCount || 0), 0),
    [dmRecentChats],
  );

  useEffect(() => {
    let unsubscribe = () => undefined;
    try {
      unsubscribe = subscribeRecentDirectChats(user?.id, (items) => {
        setDmRecentChats(items);
      });
    } catch {
      /* ignore */
    }
    return () => unsubscribe();
  }, [user?.id]);

  const createRoom = () => {
    const inviteCode = generateInviteCode();
    const roomId = buildGroupCallRoomId(inviteCode);
    if (!roomId) {
      setRoomError('Could not create a room right now.');
      return;
    }
    setRoomError('');
    setRoomCode(inviteCode);
    router.push(buildHostedCallUrl(roomId, roomMode === 'audio' ? 'audio' : 'video'));
  };

  const joinRoom = () => {
    const roomId = buildGroupCallRoomId(roomCode);
    if (!roomId) {
      setRoomError('Enter a valid invite code, for example ABCD-EFGH.');
      return;
    }
    setRoomError('');
    setJoinOpen(false);
    router.push(buildHostedCallUrl(roomId, roomMode === 'audio' ? 'audio' : 'video'));
  };

  return (
    <ChatAppShell
      topBar={<ChatAppTopBar />}
      gridClassName="grid-cols-1 lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]"
    >
      <aside className="flex max-h-[40vh] min-h-0 flex-col border-b border-ui-border bg-ui-sidebar lg:max-h-none lg:border-b-0 lg:border-r">
        <div className="shrink-0 border-b border-ui-border">
          <ChatAppIconRail active="call" dmUnreadCount={dmUnreadTotal} />
        </div>
        <div className="shrink-0 border-b border-ui-border px-3 pb-3 pt-3">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/90 px-4 py-4 shadow-[0_18px_60px_-38px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-[#0b0f19]/65">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-fuchsia-500/18 via-violet-500/12 to-orange-400/10 blur-2xl" />
            <div className="pointer-events-none absolute -left-14 -bottom-14 h-56 w-56 rounded-full bg-gradient-to-tr from-orange-400/10 via-pink-500/10 to-fuchsia-500/10 blur-3xl" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="badge mb-2 inline-flex border-slate-200 bg-white/80 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                  Live voice
                </div>
                <h2 className="text-lg font-bold tracking-tight text-slate-950 dark:text-slate-50">
                  Voice and video
                </h2>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300/80">
                  Pick a user and start a call.
                </p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/80 text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                <Video className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <CallUsersPanel />
        </div>
        <div className="shrink-0 border-t border-ui-border px-3 pb-3 pt-3">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/90 px-4 py-4 shadow-[0_18px_60px_-38px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-[#0b0f19]/65">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-fuchsia-500/18 via-violet-500/12 to-orange-400/10 blur-2xl" />
            <div className="pointer-events-none absolute -left-14 -bottom-14 h-56 w-56 rounded-full bg-gradient-to-tr from-orange-400/10 via-pink-500/10 to-fuchsia-500/10 blur-3xl" />
            <div className="relative flex h-full flex-col justify-between gap-4">
              <div>
                <div className="badge mb-2 inline-flex border-slate-200 bg-white/80 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                  Room calls
                </div>
                <h3 className="text-xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
                  Create a shared voice or video room
                </h3>
                <p className="mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-300/80">
                  Generate an invite code, share it with teammates, and everyone who enters that code joins the same hosted call room.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={createRoom}
                    className="anim-shimmer relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-fuchsia-600 via-violet-600 to-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/20 ring-1 ring-white/15 transition hover:-translate-y-0.5 hover:brightness-110 hover:shadow-fuchsia-500/30"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Create room
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRoomError('');
                      setJoinOpen(true);
                    }}
                    className="anim-shimmer relative inline-flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-r from-fuchsia-600 via-violet-600 to-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/15 ring-1 ring-white/15 transition hover:-translate-y-0.5 hover:brightness-110 hover:shadow-fuchsia-500/30"
                  >
                    Join
                  </button>
                </div>

                <div className="inline-flex w-fit items-center gap-1 rounded-full border border-ui-border bg-ui-sidebar p-1">
                  <button
                    type="button"
                    onClick={() => setRoomMode('audio')}
                    className={
                      roomMode === 'audio'
                        ? 'anim-shimmer relative overflow-hidden rounded-full bg-ui-panel px-3 py-1.5 text-xs font-semibold text-slate-900 ring-1 ring-white/10 transition hover:brightness-110 dark:text-slate-100'
                        : 'rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-ui-panel/70 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                    }
                  >
                    Voice
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoomMode('video')}
                    className={
                      roomMode === 'video'
                        ? 'anim-shimmer relative overflow-hidden rounded-full bg-ui-panel px-3 py-1.5 text-xs font-semibold text-slate-900 ring-1 ring-white/10 transition hover:brightness-110 dark:text-slate-100'
                        : 'rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-ui-panel/70 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                    }
                  >
                    Video
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-ui-border bg-ui-panel lg:border-b-0">
        {joinOpen && (
          <div className="fixed inset-0 z-[180]" role="dialog" aria-modal="true" aria-label="Join room">
            <div
              className="absolute inset-0 bg-black/55 backdrop-blur-sm"
              onClick={() => setJoinOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute left-1/2 top-1/2 w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 px-4">
              <div className="card relative overflow-hidden rounded-3xl border border-ui-border bg-ui-sidebar p-5 shadow-2xl">
                <button
                  type="button"
                  className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-ui-border bg-ui-panel text-slate-700 transition hover:bg-ui-muted dark:text-slate-100"
                  onClick={() => setJoinOpen(false)}
                  aria-label="Close"
                >
                  ✕
                </button>
                <div className="flex items-start gap-3 pr-10">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-ui-border bg-ui-panel text-slate-700 dark:text-slate-200">
                    <DoorOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold tracking-tight text-slate-950 dark:text-slate-50">Join by invite code</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300/80">
                      Paste the special room code you received and join the hosted call instantly.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <input
                    value={roomCode}
                    onChange={(event) => {
                      setRoomCode(formatInviteCode(event.target.value));
                      if (roomError) setRoomError('');
                    }}
                    placeholder="ABCD-EFGH"
                    className="w-full rounded-2xl border border-ui-border bg-ui-panel px-4 py-3 text-sm font-semibold uppercase tracking-[0.24em] text-slate-900 outline-none placeholder:text-slate-400 focus:border-ui-accent focus:ring-4 focus:ring-[var(--ui-focus)] dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={joinRoom}
                    disabled={!buildGroupCallRoomId(roomCode)}
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-ui-border bg-ui-panel px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-ui-muted disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-100"
                  >
                    Join room
                  </button>
                  {roomError ? <p className="text-sm text-rose-600 dark:text-rose-300">{roomError}</p> : null}
                </div>
              </div>
            </div>
          </div>
        )}

        <CallUI
          defaultMode="audio"
          title="Voice and video"
          description="Pick a user and start a call."
          theme="enhanced"
          showUserPanel={false}
          requireExplicitStart={false}
          showHero
        />
      </section>
    </ChatAppShell>
  );
}
