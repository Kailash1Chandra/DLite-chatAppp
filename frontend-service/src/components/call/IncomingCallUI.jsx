'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mic, Phone, PhoneOff, Shield, Video, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resumeAudioContext } from '@/lib/audioContext';
import { notificationSounds } from '@/lib/notificationSounds';

function getInitial(nameOrId) {
  const s = String(nameOrId || '').trim();
  return (s[0] || '?').toUpperCase();
}

function ensureDotKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dlite-incoming-dots')) return;
  const style = document.createElement('style');
  style.id = 'dlite-incoming-dots';
  style.textContent = `
@keyframes dl_dot { 0%, 80%, 100% { transform: translateY(0); opacity: .35 } 40% { transform: translateY(-2px); opacity: 1 } }
`;
  document.head.appendChild(style);
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      <span className="h-1.5 w-1.5 rounded-full bg-white/60" style={{ animation: 'dl_dot 1.2s infinite' }} />
      <span
        className="h-1.5 w-1.5 rounded-full bg-white/60"
        style={{ animation: 'dl_dot 1.2s infinite', animationDelay: '0.15s' }}
      />
      <span
        className="h-1.5 w-1.5 rounded-full bg-white/60"
        style={{ animation: 'dl_dot 1.2s infinite', animationDelay: '0.3s' }}
      />
    </span>
  );
}

export default function IncomingCallUI({
  caller,
  callType = 'audio',
  onAccept,
  onDecline,
  onQuickReply,
}) {
  const name = caller?.name || caller?.username || 'Unknown';
  const initial = String(caller?.initial || getInitial(name));
  const avatarUrl = String(caller?.avatarUrl || '').trim();
  const verified = !!caller?.verified;

  const [ringtoneMuted, setRingtoneMuted] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const muteEffectSkipFirst = useRef(true);

  useEffect(() => {
    ensureDotKeyframes();
  }, []);

  // Ringtone + vibration are started in IncomingCallContext (single Audio / beeper). UI only toggles mute.
  const stop = useCallback(() => {
    notificationSounds.stop('incoming-call');
    notificationSounds.stopVibration();
  }, []);

  const resumeAfterGesture = useCallback(async () => {
    await resumeAudioContext().catch(() => false);
    try {
      await notificationSounds.play('incoming-call', { loop: true, volume: 1 });
      notificationSounds.startVibrationLoop([400, 200, 400, 200, 400], 1600);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (muteEffectSkipFirst.current) {
      muteEffectSkipFirst.current = false;
      return;
    }
    if (ringtoneMuted) {
      notificationSounds.stop('incoming-call');
      notificationSounds.stopVibration();
    } else {
      notificationSounds.play('incoming-call', { loop: true, volume: 1 }).catch(() => undefined);
      notificationSounds.startVibrationLoop([400, 200, 400, 200, 400], 1600);
    }
  }, [ringtoneMuted]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      stop();
      onDecline?.();
    }, 30_000);
    return () => window.clearTimeout(t);
  }, [onDecline, stop]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        stop();
        onDecline?.();
      }
      if (e.key === ' ') {
        e.preventDefault();
        stop();
        onAccept?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onAccept, onDecline, stop]);

  const title = callType === 'video' ? 'INCOMING VIDEO CALL' : 'INCOMING VOICE CALL';
  const Icon = callType === 'video' ? Video : Mic;

  const quickReplies = useMemo(() => ["💬 Can't talk now", '📞 Call you back', '🚗 On my way'], []);

  return (
    <AnimatePresence>
      <motion.div
        key="incoming-call-ui"
        className="fixed inset-0 z-[320] flex items-center justify-center bg-[#0a0612] px-4 text-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="dialog"
        aria-modal="true"
        aria-label="Incoming call"
        onPointerDown={async () => {
          if (autoplayBlocked) {
            const ok = await resumeAfterGesture();
            setAutoplayBlocked(!ok);
          }
        }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
            transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
            className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full blur-[80px]"
            style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.5) 0%, transparent 70%)' }}
          />
          <motion.div
            animate={{ x: [0, -22, 0], y: [0, 18, 0] }}
            transition={{ repeat: Infinity, duration: 7.5, ease: 'easeInOut' }}
            className="absolute -bottom-44 -right-44 h-[560px] w-[560px] rounded-full blur-[90px]"
            style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.4) 0%, transparent 70%)' }}
          />
          <motion.div
            animate={{ x: [0, 14, 0], y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 8.5, ease: 'easeInOut' }}
            className="absolute left-1/2 top-1/3 h-[520px] w-[520px] -translate-x-1/2 rounded-full blur-[100px]"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 72%)' }}
          />
        </div>

        <div className="absolute left-0 right-0 top-5 flex flex-col items-center gap-2 px-4">
          <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.06] px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.18em] shadow-[0_18px_60px_-30px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <Icon className="h-4 w-4 text-emerald-200" />
            {title}
          </div>
          {verified ? (
            <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-200 backdrop-blur-xl">
              <Shield className="h-4 w-4" /> Verified contact · End-to-end encrypted
            </div>
          ) : null}
        </div>

        <div className="absolute right-5 top-5">
          <button
            type="button"
            onClick={async () => {
              const next = !ringtoneMuted;
              setRingtoneMuted(next);
              if (!next) {
                const ok = await resumeAfterGesture();
                setAutoplayBlocked(!ok);
              } else {
                stop();
              }
            }}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.06] backdrop-blur-xl transition hover:bg-white/[0.10] active:scale-95',
              ringtoneMuted && 'bg-red-500/25 text-red-200'
            )}
            aria-label={ringtoneMuted ? 'Unmute ringtone' : 'Mute ringtone'}
            title={ringtoneMuted ? 'Unmute ringtone' : 'Mute ringtone'}
          >
            {ringtoneMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
        </div>

        <motion.div
          className="relative z-10 flex w-full max-w-[720px] flex-col items-center gap-6 text-center"
          initial={{ scale: 0.96, y: 10, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ duration: 0.26, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <div className="relative mt-4">
            <motion.div
              className="absolute left-1/2 top-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-400/40"
              animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.9, 0.5] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute left-1/2 top-1/2 h-[240px] w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-pink-400/35"
              animate={{ scale: [1, 1.15, 1], opacity: [0.45, 0.85, 0.45] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            />
            <motion.div
              className="absolute left-1/2 top-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-400/30"
              animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            />

            <div className="relative flex h-[150px] w-[150px] items-center justify-center overflow-hidden rounded-full border border-white/[0.10] bg-[linear-gradient(135deg,#f97316_0%,#ec4899_50%,#a855f7_100%)] text-[56px] font-bold text-white shadow-[0_30px_120px_-60px_rgba(249,115,22,0.55)]">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" draggable={false} />
              ) : (
                initial
              )}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.25),transparent_58%)]" />
            </div>

            <motion.div
              className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full border-4 border-[#0a0612] bg-[linear-gradient(135deg,#f97316_0%,#ec4899_50%,#a855f7_100%)] text-white shadow-[0_18px_60px_-30px_rgba(0,0,0,0.7)]"
              animate={{ rotate: [-15, 15, -15] }}
              transition={{ duration: 0.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Phone className="h-5 w-5" />
            </motion.div>
          </div>

          <div>
            <div className="text-[30px] font-bold tracking-[-0.02em]">
              <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">{name}</span>
            </div>
            <div className="mt-2 text-sm text-white/60">
              Ringing <TypingDots />
            </div>
            <div className="mt-2 text-xs text-white/40">
              {caller?.username ? `@${caller.username}` : ''}{caller?.location ? ` · ${caller.location}` : ''}
            </div>
          </div>
        </motion.div>

        <div className="absolute bottom-[110px] left-1/2 z-20 -translate-x-1/2">
          <div className="flex items-center gap-2">
            {quickReplies.map((text) => (
              <button
                key={text}
                type="button"
                className="rounded-full border border-white/[0.10] bg-white/[0.08] px-4 py-2 text-xs font-semibold text-white/85 backdrop-blur-xl transition hover:bg-white/[0.12] active:scale-95"
                onClick={() => {
                  stop();
                  onQuickReply?.(text);
                  onDecline?.();
                }}
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2">
          <div className="flex items-end justify-center gap-[60px]">
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  stop();
                  onDecline?.();
                }}
                className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-b from-red-500 to-rose-500 text-white shadow-[0_10px_36px_rgba(239,68,68,0.55)] ring-1 ring-red-300/25 transition duration-200 hover:scale-[1.08] hover:brightness-110 active:scale-[0.96]"
                aria-label="Decline"
              >
                <PhoneOff className="h-7 w-7 rotate-[135deg]" />
              </button>
              <span className="text-xs font-semibold text-white/70">Decline</span>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <motion.div
                  className="absolute -inset-2 rounded-full border border-emerald-400/50"
                  animate={{ scale: [1, 2.0], opacity: [0.55, 0] }}
                  transition={{ duration: 1.0, repeat: Infinity, ease: 'easeOut' }}
                />
                <motion.div
                  className="absolute -inset-2 rounded-full border border-emerald-400/35"
                  animate={{ scale: [1, 2.0], opacity: [0.55, 0] }}
                  transition={{ duration: 1.0, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    stop();
                    const ok = await resumeAfterGesture();
                    setAutoplayBlocked(!ok);
                    onAccept?.();
                  }}
                  className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-[0_10px_36px_rgba(16,185,129,0.55)] ring-1 ring-emerald-200/25 transition duration-200 hover:scale-[1.08] hover:brightness-110 active:scale-[0.96]"
                  aria-label="Accept"
                >
                  <Phone className="h-7 w-7" />
                </button>
              </div>
              <span className="text-xs font-semibold text-white/70">Accept</span>
            </div>
          </div>
        </div>

        {autoplayBlocked ? (
          <div className="pointer-events-none absolute bottom-[190px] left-1/2 z-30 -translate-x-1/2 rounded-full border border-white/10 bg-black/35 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur">
            Click anywhere to enable ringtone audio
          </div>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}

