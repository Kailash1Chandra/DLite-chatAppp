'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Camera,
  CheckCircle2,
  MoreHorizontal,
  Shield,
  Sparkles,
  Volume2,
  Mic,
  MicOff,
  PhoneOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAudioContext } from '@/lib/audioContext';

function formatTimer(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds || 0)));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const two = (n) => String(n).padStart(2, '0');
  if (hh > 0) return `${two(hh)}:${two(mm)}:${two(ss)}`;
  return `${two(mm)}:${two(ss)}`;
}

function useCallTimer(startedAt) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [startedAt]);
  const seconds = startedAt ? Math.max(0, (now - startedAt) / 1000) : 0;
  return Math.floor(seconds);
}

function useAudioLevel(stream) {
  const [level, setLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const rafRef = useRef(null);
  const speakingSinceRef = useRef(null);
  const lastLevelRef = useRef(0);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);

  const trackKey = useMemo(() => {
    const t = stream?.getAudioTracks?.()?.[0];
    return t ? `${t.id}:${t.enabled ? '1' : '0'}:${t.muted ? '1' : '0'}` : '';
  }, [stream]);

  useEffect(() => {
    const s = stream;
    if (!s) {
      setLevel(0);
      setIsSpeaking(false);
      return;
    }

    let cancelled = false;
    try {
      // Gesture-gated AudioContext (prevents Chrome autoplay warnings).
      const ac = getAudioContext({ createIfNeeded: true });
      if (!ac) return;
      const analyser = ac.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      const source = ac.createMediaStreamSource(s);
      sourceRef.current = source;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);

      const loop = () => {
        if (cancelled) return;
        try {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const avg = sum / (data.length * 255);
          const smoothed = lastLevelRef.current * 0.7 + avg * 0.3;
          lastLevelRef.current = smoothed;
          setLevel(smoothed);

          const now = Date.now();
          const speaking = smoothed > 0.05;
          if (speaking) {
            if (!speakingSinceRef.current) speakingSinceRef.current = now;
            if (now - speakingSinceRef.current >= 200) setIsSpeaking(true);
          } else {
            speakingSinceRef.current = null;
            setIsSpeaking(false);
          }
        } catch {
          /* ignore */
        }
        rafRef.current = window.requestAnimationFrame(loop);
      };

      rafRef.current = window.requestAnimationFrame(loop);
    } catch {
      /* ignore */
    }

    return () => {
      cancelled = true;
      speakingSinceRef.current = null;
      setIsSpeaking(false);
      try {
        if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      } catch {
        /* ignore */
      }
      rafRef.current = null;
      try {
        sourceRef.current?.disconnect?.();
      } catch {
        /* ignore */
      }
      try {
        analyserRef.current?.disconnect?.();
      } catch {
        /* ignore */
      }
      sourceRef.current = null;
      analyserRef.current = null;
    };
  }, [trackKey, stream]);

  return { level, isSpeaking };
}

function useConnectionQuality(peerConnection) {
  const [quality, setQuality] = useState({
    tier: 'poor',
    label: 'Poor',
    color: '#ef4444',
    bars: [1, 0, 0, 0],
    rttMs: 999,
  });

  useEffect(() => {
    if (!peerConnection) return;
    let disposed = false;
    const read = async () => {
      try {
        const stats = await peerConnection.getStats();
        let rtt = 999;
        let lost = 0;
        let received = 0;
        stats.forEach((r) => {
          if (r.type === 'candidate-pair' && r.state === 'succeeded' && typeof r.currentRoundTripTime === 'number') {
            rtt = r.currentRoundTripTime * 1000;
          }
          if (r.type === 'inbound-rtp' && (r.kind === 'audio' || r.kind === 'video')) {
            lost += Number(r.packetsLost || 0);
            received += Number(r.packetsReceived || 0);
          }
        });
        const total = lost + received;
        const lossPct = total ? (lost / total) * 100 : 0;

        let tier = 'poor';
        let label = 'Poor';
        let color = '#ef4444';
        let bars = [1, 0, 0, 0];
        if (rtt < 100 && lossPct < 1) {
          tier = 'excellent';
          label = 'Excellent';
          color = '#10b981';
          bars = [1, 1, 1, 1];
        } else if (rtt < 250 && lossPct < 3) {
          tier = 'good';
          label = 'Good';
          color = '#84cc16';
          bars = [1, 1, 1, 0];
        } else if (rtt < 500 && lossPct < 7) {
          tier = 'fair';
          label = 'Fair';
          color = '#f59e0b';
          bars = [1, 1, 0, 0];
        }

        if (!disposed) setQuality({ tier, label, color, bars, rttMs: Math.round(rtt) });
      } catch {
        if (!disposed) setQuality({ tier: 'poor', label: 'Poor', color: '#ef4444', bars: [1, 0, 0, 0], rttMs: 999 });
      }
    };

    const t = window.setInterval(read, 2000);
    read();
    return () => {
      disposed = true;
      window.clearInterval(t);
    };
  }, [peerConnection]);

  return quality;
}

function QualityPill({ quality }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/80 backdrop-blur-xl">
      <div className="flex items-end gap-0.5" aria-hidden="true">
        {quality.bars.map((b, i) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            className="w-1 rounded-sm"
            style={{
              height: `${6 + i * 3}px`,
              background: b ? quality.color : 'rgba(255,255,255,0.18)',
            }}
          />
        ))}
      </div>
      <span>{quality.label}</span>
    </div>
  );
}

function Waveform({ level, isSpeaking }) {
  const bars = useMemo(() => Array.from({ length: 40 }, (_v, i) => i), []);
  const t0 = useRef(Date.now());
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-white/[0.08] bg-white/[0.06] px-4 py-2 backdrop-blur-xl">
      <Sparkles className="h-4 w-4 text-[#f97316]" />
      <div className="flex items-end gap-[2px]" aria-hidden="true">
        {bars.map((i) => {
          const idle = 0.22 + 0.12 * Math.sin(((Date.now() - t0.current) / 1000) * 2.2 + i * 0.28);
          const jitter = (Math.sin(((Date.now() - t0.current) / 1000) * 18 + i * 1.6) + 1) / 2;
          const intensity = isSpeaking ? Math.min(1, level * 1.15 + jitter * 0.22) : idle;
          const h = 6 + intensity * 28 * (0.4 + Math.sin(i * 0.22) * 0.08 + 0.6);
          return (
            <div
              key={i}
              className="w-[3px] rounded-full"
              style={{
                height: `${h}px`,
                background: 'linear-gradient(180deg, #f97316 0%, #ec4899 50%, #a855f7 100%)',
                opacity: 0.92,
                transition: 'height 90ms ease-out',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function EmojiPicker({ open, onPick, onClose }) {
  const items = ['❤️', '😂', '👍', '🎉', '🔥', '😮', '✨', '😍', '👏'];
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="absolute bottom-[92px] left-1/2 z-40 -translate-x-1/2"
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <div className="flex items-center gap-1 rounded-2xl border border-white/[0.08] bg-[rgba(20,15,30,0.7)] p-2 backdrop-blur-[40px]">
            {items.map((e) => (
              <button
                key={e}
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-xl transition hover:scale-125 active:scale-95"
                onClick={() => {
                  onPick(e);
                  onClose();
                }}
                aria-label={`React ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default function VoiceCallUI({
  remoteUser,
  localUser,
  localStream,
  remoteStream,
  peerConnection,
  startedAt,
  status = 'connected',
  stats,
  onEnd,
  onToggleMic,
  onToggleSpeaker,
  onSwitchToVideo,
  onReaction,
  onMore,
}) {
  const seconds = useCallTimer(startedAt);
  const t = formatTimer(seconds);
  const remoteAudio = useAudioLevel(remoteStream);
  const quality = useConnectionQuality(peerConnection);

  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const canHover = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(hover: hover)').matches;
  }, []);

  useEffect(() => {
    if (!canHover) return;
    if (!controlsVisible) return;
    let timer = window.setTimeout(() => setControlsVisible(false), 3000);
    const onMove = () => {
      setControlsVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setControlsVisible(false), 3000);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.clearTimeout(timer);
    };
  }, [canHover, controlsVisible]);

  const doToggleMic = useCallback(() => {
    const next = !muted;
    setMuted(next);
    try {
      localStream?.getAudioTracks?.()?.forEach((tr) => (tr.enabled = !next));
    } catch {
      /* ignore */
    }
    onToggleMic?.(next);
  }, [localStream, muted, onToggleMic]);

  const doToggleSpeaker = useCallback(() => {
    setSpeakerOn((v) => !v);
    onToggleSpeaker?.();
  }, [onToggleSpeaker]);

  const ringScale = 1 + Math.min(0.08, remoteAudio.level * 0.12);
  const avatarShadow = `0 0 ${14 + remoteAudio.level * 38}px rgba(249,115,22,${0.22 + remoteAudio.level * 0.28})`;

  const name = remoteUser?.name || 'Call';
  const username = remoteUser?.username ? `@${remoteUser.username}` : '';
  const location = remoteUser?.location ? ` · ${remoteUser.location}` : '';
  const verified = !!remoteUser?.verified;
  const initial = String(remoteUser?.initial || name || 'U').slice(0, 1).toUpperCase();

  const statA = stats?.totalCalls ?? '—';
  const statB = stats?.totalDuration ?? '—';
  const statC = stats?.avgQuality ?? '—';

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] bg-[#0a0612] text-white shadow-2xl shadow-black/35">
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
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.42) 0%, transparent 70%)' }}
        />
        <motion.div
          animate={{ x: [0, 14, 0], y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 8.5, ease: 'easeInOut' }}
          className="absolute left-1/2 top-1/3 h-[520px] w-[520px] -translate-x-1/2 rounded-full blur-[100px]"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.32) 0%, transparent 72%)' }}
        />
      </div>

      <div className="relative z-10 flex items-center justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/85 backdrop-blur-xl">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <span className="tabular-nums">{t}</span>
            <span className="text-white/50">·</span>
            <span>Voice · HD</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200 backdrop-blur-xl">
            <Shield className="h-4 w-4" />
            End-to-end encrypted
          </div>
        </div>

        <QualityPill quality={quality} />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-6 py-8">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="relative">
            <motion.div
              className="absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
              style={{
                background:
                  'conic-gradient(from 90deg, rgba(249,115,22,0.9), rgba(236,72,153,0.85), rgba(168,85,247,0.85), rgba(249,115,22,0.9))',
                maskImage: 'radial-gradient(circle, transparent 62%, black 63%)',
                opacity: 0.55,
                filter: 'blur(0.2px)',
              }}
            />

            <motion.div
              className="absolute left-1/2 top-1/2 h-[240px] w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              animate={{ scale: [1, ringScale, 1], opacity: [0.55, 0.85, 0.55] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.22), rgba(236,72,153,0.18), rgba(168,85,247,0.18))' }}
            />

            <div className="absolute left-1/2 top-1/2 h-[195px] w-[195px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.10] bg-white/[0.04] backdrop-blur-xl" />

            <motion.div
              className="relative flex h-[160px] w-[160px] items-center justify-center overflow-hidden rounded-full border border-white/[0.10]"
              style={{
                background: 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #a855f7 100%)',
                boxShadow: avatarShadow,
              }}
              animate={{ boxShadow: [avatarShadow, `0 0 ${18 + remoteAudio.level * 44}px rgba(236,72,153,0.28)`, avatarShadow] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              {remoteUser?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={remoteUser.avatarUrl} alt="" className="h-full w-full object-cover" draggable={false} />
              ) : (
                <div className="text-6xl font-bold text-white/95">{initial}</div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.26),transparent_55%)]" />
            </motion.div>
          </div>

          <div>
            <div className="flex items-center justify-center gap-2">
              <p className="text-[28px] font-bold tracking-[-0.02em] text-white">
                <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">{name}</span>
              </p>
              {verified ? (
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/20">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-white/60">
              {username}
              {username && location ? '' : ''}
              {location}
            </p>
            <p className="mt-1 text-sm text-white/60">{status === 'reconnecting' ? 'Reconnecting…' : status === 'connected' ? 'Connected · HD audio' : 'Connecting…'}</p>
          </div>

          <Waveform level={remoteAudio.level} isSpeaking={remoteAudio.isSpeaking} />

          <div className="flex items-center justify-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.06] px-5 py-3 text-xs text-white/70 backdrop-blur-xl">
            <div className="flex flex-col items-center">
              <div className="text-[10px] uppercase tracking-wider text-white/45">Calls</div>
              <div className="mt-1 text-sm font-semibold text-white/85">{statA}</div>
            </div>
            <div className="h-9 w-px bg-white/10" aria-hidden="true" />
            <div className="flex flex-col items-center">
              <div className="text-[10px] uppercase tracking-wider text-white/45">Total</div>
              <div className="mt-1 text-sm font-semibold text-white/85">{statB}</div>
            </div>
            <div className="h-9 w-px bg-white/10" aria-hidden="true" />
            <div className="flex flex-col items-center">
              <div className="text-[10px] uppercase tracking-wider text-white/45">Quality</div>
              <div className="mt-1 text-sm font-semibold text-white/85">{statC}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-20 pb-6">
        <AnimatePresence>
          {controlsVisible ? (
            <motion.div
              className="mx-auto flex w-fit items-center gap-2 rounded-full border border-white/[0.08] bg-[rgba(20,15,30,0.7)] px-3 py-2 backdrop-blur-[40px]"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <button
                type="button"
                onClick={doToggleMic}
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.10] transition',
                  muted
                    ? 'bg-red-500 text-white shadow-[0_10px_26px_rgba(239,68,68,0.35)] hover:bg-red-600 active:scale-95'
                    : 'bg-white/[0.08] text-white/90 hover:bg-white/[0.12] active:scale-95'
                )}
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>

              <button
                type="button"
                onClick={doToggleSpeaker}
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.08] text-white/90 transition hover:bg-white/[0.12] active:scale-95',
                  speakerOn ? '' : 'opacity-70'
                )}
                aria-label="Speaker"
              >
                <Volume2 className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={onSwitchToVideo}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.08] text-white/90 transition hover:bg-white/[0.12] active:scale-95"
                aria-label="Switch to video"
                title="Switch to video"
              >
                <Camera className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.08] text-[#f97316] transition hover:bg-white/[0.12] active:scale-95"
                aria-label="Reactions"
              >
                <Sparkles className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={onMore}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.08] text-white/90 transition hover:bg-white/[0.12] active:scale-95"
                aria-label="More"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>

              <div className="mx-1 h-7 w-px bg-white/10" aria-hidden="true" />

              <button
                type="button"
                onClick={onEnd}
                className="flex h-12 w-20 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-red-500 to-rose-500 px-4 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(239,68,68,0.35)] transition hover:brightness-110 active:scale-95"
                aria-label="End call"
              >
                <PhoneOff className="h-5 w-5" />
                End
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <EmojiPicker
          open={pickerOpen}
          onPick={(emoji) => onReaction?.(emoji)}
          onClose={() => setPickerOpen(false)}
        />
      </div>
    </div>
  );
}

