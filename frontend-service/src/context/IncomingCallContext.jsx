'use client';

import { createContext, useContext, useEffect, useRef } from 'react';
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

  // /call is now the launcher; only suppress auto-navigation when already inside an active call route.
  const isOnCallPage = pathname?.startsWith('/call/') || pathname?.startsWith('/webrtc-call');

  useEffect(() => {
    if (!user?.id) return;
    const beeperRef = beeper.current;
    const unsub = listenForIncomingHostedCall(user.id, (incoming) => {
      if (isOnCallPage) return;
      if (!incoming) {
        beeperRef.stop();
        return;
      }
      beeperRef.stop();
      router.push(buildHostedCallUrl(incoming.roomId, incoming.mode || 'audio'));
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
    }
  }, [isOnCallPage]);

  return (
    <IncomingCallContext.Provider value={{ offer: null, callerProfile: null, accept: undefined, reject: undefined }}>
      {children}
    </IncomingCallContext.Provider>
  );
}

export function useIncomingCall() {
  return useContext(IncomingCallContext);
}
