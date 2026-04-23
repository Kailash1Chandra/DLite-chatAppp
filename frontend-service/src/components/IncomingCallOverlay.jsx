'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useIncomingCall } from '@/context/IncomingCallContext';

export default function IncomingCallOverlay() {
  const { offer, callerProfile, accept, reject } = useIncomingCall() || {};
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const isOnCallPage = pathname?.startsWith('/call/') || pathname?.startsWith('/webrtc-call');
  if (!offer) return null;
  if (isOnCallPage) return null;

  const callerName = callerProfile?.username || offer.fromUserId || 'Unknown user';
  const isVideo = offer.mode === 'video';
  const initial = String(callerName).slice(0, 1).toUpperCase();
  const roomCode = String(offer.roomId || '').replace(/^room-/, '');

  return (
    <AnimatePresence>
      <motion.div
        key="incoming-call-overlay"
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 px-4 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-950/90 px-6 py-8 text-center shadow-2xl shadow-black/40"
          initial={{ scale: 0.88, y: 24 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        >
          <div className="flex flex-col items-center gap-5">
            <div className="relative flex items-center justify-center">
              <span className="absolute h-36 w-36 animate-ping rounded-full bg-green-500/20" />
              <span className="absolute h-48 w-48 animate-ping rounded-full bg-green-500/10 [animation-delay:400ms]" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 via-violet-600 to-cyan-500 text-4xl font-bold text-white shadow-2xl shadow-violet-500/30">
                {initial}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/45">Incoming call</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-white">{callerName}</p>
              <p className="mt-2 text-sm font-medium text-white/70">
                {isVideo ? 'Video room invite' : 'Voice room invite'}
              </p>
              {roomCode ? (
                <p className="mt-3 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-white/65">
                  Room {roomCode}
                </p>
              ) : null}
            </div>

            <p className="max-w-sm text-sm leading-6 text-white/55">
              Accept to join the hosted ZEGO room now, or decline to ignore the invite.
            </p>

            <div className="flex items-center gap-5 pt-2">
              <div className="flex flex-col items-center gap-2.5">
                <button
                  type="button"
                  onClick={reject}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-xl shadow-red-500/40 transition-transform hover:bg-red-600 active:scale-90"
                  aria-label="Decline call"
                >
                  <PhoneOff className="h-7 w-7" />
                </button>
                <span className="text-sm font-medium text-white/70">Decline</span>
              </div>

              <div className="flex flex-col items-center gap-2.5">
                <button
                  type="button"
                  onClick={accept}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white shadow-xl shadow-green-500/40 transition-transform hover:bg-green-600 active:scale-90"
                  aria-label="Accept call"
                >
                  {isVideo ? <Video className="h-7 w-7" /> : <Phone className="h-7 w-7" />}
                </button>
                <span className="text-sm font-medium text-white/70">Accept</span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
