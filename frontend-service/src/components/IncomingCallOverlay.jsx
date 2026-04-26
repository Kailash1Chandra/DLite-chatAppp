'use client';

import { useIncomingCall } from '@/context/IncomingCallContext';
import IncomingCallUI from '@/components/call/IncomingCallUI';

export default function IncomingCallOverlay() {
  const { offer, callerProfile, accept, reject } = useIncomingCall() || {};
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const isOnCallPage = pathname?.startsWith('/call/') || pathname?.startsWith('/webrtc-call');
  if (!offer) return null;
  if (isOnCallPage) return null;

  const rawCallerName = callerProfile?.username || '';
  const isUuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawCallerName);
  const callerName = rawCallerName && !isUuidLike ? rawCallerName : 'Unknown user';
  const photoURL = String(callerProfile?.photoURL || '').trim();
  return (
    <IncomingCallUI
      caller={{
        name: callerName,
        initial: String(callerName || 'U').slice(0, 1).toUpperCase(),
        username: rawCallerName && !isUuidLike ? rawCallerName : undefined,
        avatarUrl: photoURL || undefined,
        verified: true,
      }}
      callType={offer.mode === 'video' ? 'video' : 'audio'}
      onAccept={accept}
      onDecline={reject}
      onQuickReply={(message) => {
        // Keep behavior: quick reply declines the call after sending
        try {
          // eslint-disable-next-line no-console
          console.log('[incoming:quick-reply]', message);
        } catch {
          /* ignore */
        }
      }}
    />
  );
}
