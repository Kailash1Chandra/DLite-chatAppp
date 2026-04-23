 'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { listenForIncomingHostedCall } from '@/lib/call';
import { buildHostedCallUrl } from '@/lib/callRoom';

const IncomingCallContext = createContext(null);

function createBeeper() {
  let intervalId = null;
  let ac = null;
  function beep() {
    try {
      if (!ac) ac = new AudioContext();
      if (ac.state === 'suspended') ac.resume().catch(() => undefined);
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = 840;
      gain.gain.value = 0.07;
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + 0.18);
    } catch { /* ignore audio errors */ }
  }
  return {
    start() { if (intervalId) return; beep(); intervalId = setInterval(beep, 1200); },
    stop() { if (intervalId) { clearInterval(intervalId); intervalId = null; } }
  };
}

export function IncomingCallProvider({ children }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const beeper = useRef(createBeeper());
  const [incoming, setIncoming] = useState(null);

  // /call is now the launcher; only suppress auto-navigation when already inside an active call route.
  const isOnCallPage = pathname?.startsWith('/call/') || pathname?.startsWith('/webrtc-call');

  const accept = useCallback(() => {
    if (!incoming?.roomId) return;
    const nextUrl = buildHostedCallUrl(incoming.roomId, incoming.mode || 'audio');
    setIncoming(null);
    beeper.current.stop();
    router.push(nextUrl);
  }, [incoming, router]);

  const reject = useCallback(() => {
    setIncoming(null);
    beeper.current.stop();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const beeperRef = beeper.current;
    const unsub = listenForIncomingHostedCall(user.id, (incoming) => {
      if (isOnCallPage) return;
      if (!incoming) {
        setIncoming(null);
        beeperRef.stop();
        return;
      }
      beeperRef.start();
      setIncoming(incoming);
    });
    return () => {
      unsub();
      beeperRef.stop();
    };
  }, [user?.id, isOnCallPage, router]);

  // When navigating to /call page, hide global overlay
  useEffect(() => {
    const beeperRef = beeper.current;
    if (isOnCallPage) {
      beeperRef.stop();
      setIncoming(null);
    }
  }, [isOnCallPage]);

  const value = useMemo(
    () => ({
      offer: incoming,
      callerProfile: incoming ? { id: incoming.fromUserId, username: incoming.fromUserId } : null,
      accept,
      reject,
    }),
    [accept, incoming, reject]
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
