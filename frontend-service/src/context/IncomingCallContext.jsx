 'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { HOSTED_CALL_DECLINED_MESSAGE, listenForIncomingHostedCall, rejectCall } from '@/lib/call';
import { buildHostedCallUrl } from '@/lib/callRoom';
import { getUserProfileById } from '@/services/chatClient';
import { notificationSounds } from '@/lib/notificationSounds';

const IncomingCallContext = createContext(null);

export function IncomingCallProvider({ children }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const ringing = useRef(false);
  const [incoming, setIncoming] = useState(null);
  const [callerProfile, setCallerProfile] = useState(null);

  // /call is now the launcher; only suppress auto-navigation when already inside an active call route.
  const isOnCallPage = pathname?.startsWith('/call/') || pathname?.startsWith('/webrtc-call');

  const accept = useCallback(() => {
    if (!incoming?.roomId) return;
    const nextUrl = buildHostedCallUrl(incoming.roomId, incoming.mode || 'audio');
    setIncoming(null);
    ringing.current = false;
    notificationSounds.stop('incoming-call');
    notificationSounds.stopVibration();
    router.push(nextUrl);
  }, [incoming, router]);

  const reject = useCallback(
    async (opts) => {
      const fromId = String(incoming?.fromUserId || '').trim();
      const uid = String(user?.id || '').trim();
      if (fromId && uid && opts?.reason !== 'timeout') {
        try {
          await rejectCall({
            userId: uid,
            callerId: fromId,
            message: HOSTED_CALL_DECLINED_MESSAGE,
          });
        } catch {
          /* ignore */
        }
      }
      setIncoming(null);
      ringing.current = false;
      notificationSounds.stop('incoming-call');
      notificationSounds.stopVibration();
    },
    [incoming?.fromUserId, user?.id]
  );

  useEffect(() => {
    if (!user?.id) return;
    const unsub = listenForIncomingHostedCall(user.id, (incoming) => {
      if (isOnCallPage) return;
      if (!incoming) {
        setIncoming(null);
        setCallerProfile(null);
        ringing.current = false;
        notificationSounds.stop('incoming-call');
        notificationSounds.stopVibration();
        return;
      }
      if (!ringing.current) {
        ringing.current = true;
        notificationSounds.play('incoming-call', { loop: true, volume: 1 }).catch(() => undefined);
        notificationSounds.startVibrationLoop([400, 200, 400, 200, 400], 1600);
      }
      setIncoming(incoming);
    });
    return () => {
      unsub();
      ringing.current = false;
      notificationSounds.stop('incoming-call');
      notificationSounds.stopVibration();
    };
  }, [user?.id, isOnCallPage, router]);

  useEffect(() => {
    let cancelled = false;
    const fromId = String(incoming?.fromUserId || '').trim();
    if (!fromId) {
      setCallerProfile(null);
      return () => undefined;
    }
    (async () => {
      try {
        const p = await getUserProfileById(fromId).catch(() => null);
        if (cancelled) return;
        const usernameRaw =
          p?.username ||
          p?.user_metadata?.username ||
          p?.user_metadata?.full_name ||
          p?.user_metadata?.name ||
          p?.email ||
          fromId;
        const isUuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          String(usernameRaw || '').trim()
        );
        const username = isUuidLike ? 'Unknown user' : usernameRaw;
        const photoURL = p?.avatarUrl || p?.avatar_url || p?.photoURL || p?.picture || '';
        setCallerProfile({ id: fromId, username, photoURL });
      } catch {
        if (!cancelled) setCallerProfile({ id: fromId, username: 'Unknown user', photoURL: '' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [incoming?.fromUserId]);

  // When navigating to /call page, hide global overlay
  useEffect(() => {
    if (isOnCallPage) {
      ringing.current = false;
      notificationSounds.stop('incoming-call');
      notificationSounds.stopVibration();
      setIncoming(null);
    }
  }, [isOnCallPage]);

  const value = useMemo(
    () => ({
      offer: incoming,
      callerProfile,
      accept,
      reject,
    }),
    [accept, callerProfile, incoming, reject]
  );

  return (
    <IncomingCallContext.Provider value={value}>
      {children}
    </IncomingCallContext.Provider>
  );
}

export function useIncomingCall() {
  return useContext(IncomingCallContext);
}
