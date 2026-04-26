'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Columns2,
  Maximize2,
  Mic,
  MicOff,
  Monitor,
  MoreHorizontal,
  Shield,
  Sparkles,
  Users,
  Video,
  VideoOff,
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
      <span className="text-white/50">·</span>
      <span className="tabular-nums text-white/70">{quality.rttMs}ms</span>
    </div>
  );
}

function Fallback({ name, initial }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] via-[#2d1b4e] to-[#4a1a4e]">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-[110px] w-[110px] items-center justify-center rounded-full border border-white/[0.10] bg-[linear-gradient(135deg,#f97316_0%,#ec4899_50%,#a855f7_100%)] text-5xl font-bold text-white">
          {initial}
        </div>
        <div>
          <div className="text-2xl font-bold tracking-[-0.02em] text-white">{name}</div>
          <div className="mt-1 flex items-center justify-center gap-2 text-sm text-white/65">
            <VideoOff className="h-4 w-4" /> Camera off · sharing audio
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VideoCallUI({
  remoteUser,
  localUser,
  localStream,
  remoteStream,
  peerConnection,
  startedAt,
  status = 'connected',
  participantCount = 2,
  onEnd,
  onToggleMic,
  onToggleVideo,
  onScreenShare,
  onShowParticipants,
  onReaction,
  onMore,
  onLayoutChange,
  onFullscreen,
}) {
  const seconds = useCallTimer(startedAt);
  const t = formatTimer(seconds);
  const remoteAudio = useAudioLevel(remoteStream);
  const quality = useConnectionQuality(peerConnection);

  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [pipPos, setPipPos] = useState({ x: 0, y: 0 });

  const remoteVideoElements = useRef(new Set());
  const remoteStreamRef = useRef(remoteStream);

  useEffect(() => {
    remoteStreamRef.current = remoteStream;
    remoteVideoElements.current.forEach((el) => {
      if (el && remoteStream && el.srcObject !== remoteStream) {
        try {
          el.srcObject = remoteStream;
          el.play?.().catch(() => undefined);
        } catch {
          /* ignore */
        }
      }
    });
  }, [remoteStream]);

  const registerRemoteVideo = useCallback((el) => {
    if (!el) return;
    remoteVideoElements.current.add(el);
    const s = remoteStreamRef.current;
    if (s) {
      try {
        el.srcObject = s;
        el.play?.().catch(() => undefined);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const localVideoRef = useRef(null);
  useEffect(() => {
    const el = localVideoRef.current;
    if (!el) return;
    if (!localStream) return;
    try {
      el.srcObject = localStream;
      el.play?.().catch(() => undefined);
    } catch {
      /* ignore */
    }
  }, [localStream]);

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

  const doToggleVideo = useCallback(() => {
    const next = !videoOff;
    setVideoOff(next);
    try {
      localStream?.getVideoTracks?.()?.forEach((tr) => (tr.enabled = !next));
    } catch {
      /* ignore */
    }
    onToggleVideo?.(next);
  }, [localStream, onToggleVideo, videoOff]);

  const remoteHasVideo = useMemo(() => {
    const tracks = remoteStream?.getVideoTracks?.() || [];
    return tracks.some((t) => t.enabled && t.readyState === 'live' && !t.muted);
  }, [remoteStream]);

  const remoteGlow = Math.min(1, remoteAudio.level * 1.2);
  const remoteShadow = `inset 0 0 0 3px rgba(249,115,22,${0.25 + remoteGlow * 0.35}), inset 0 0 40px rgba(249,115,22,${
    0.14 + remoteGlow * 0.22
  })`;

  const remoteName = remoteUser?.name || 'User';
  const remoteInitial = String(remoteUser?.initial || remoteName || 'U').slice(0, 1).toUpperCase();
  const localInitial = String(localUser?.initial || localUser?.name || 'Y').slice(0, 1).toUpperCase();

  const glassPill =
    'rounded-full border border-white/[0.08] bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/85 backdrop-blur-xl';

  return (
    <div className="relative flex min-h-0 flex-1 w-full flex-col overflow-hidden rounded-[1.75rem] bg-black shadow-2xl shadow-black/35">
      <div className="absolute inset-0 bg-black" />

      <div className="absolute left-4 top-4 z-30 flex items-center gap-2">
        <div className={cn(glassPill, 'flex items-center gap-2')}>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <span className="tabular-nums">{t}</span>
          <span className="text-white/50">·</span>
          <span>Video · 720p</span>
        </div>
        <div className={cn(glassPill, 'flex items-center gap-2')}>
          <Shield className="h-4 w-4 text-emerald-300" />
          <span className="text-white/75">E2E encrypted</span>
        </div>
      </div>

      <div className="absolute right-4 top-4 z-30 flex items-center gap-2">
        <QualityPill quality={quality} />
        <button
          type="button"
          onClick={onLayoutChange}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.06] text-white/85 backdrop-blur-xl transition hover:bg-white/[0.10] active:scale-95"
          aria-label="Layout"
          title="Layout"
        >
          <Columns2 className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onFullscreen}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.06] text-white/85 backdrop-blur-xl transition hover:bg-white/[0.10] active:scale-95"
          aria-label="Fullscreen"
          title="Fullscreen"
        >
          <Maximize2 className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1">
        <div className="absolute inset-0">
          {remoteHasVideo ? (
            <div className="absolute inset-0" style={{ boxShadow: remoteShadow }}>
              <video
                ref={registerRemoteVideo}
                autoPlay
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          ) : (
            <Fallback name={remoteName} initial={remoteInitial} />
          )}

          <div className="absolute bottom-4 left-4 rounded-full border border-white/[0.08] bg-[rgba(20,15,30,0.7)] px-3 py-2 text-xs font-semibold text-white/85 backdrop-blur-[40px]">
            <div className="flex items-center gap-2">
              <span className="max-w-[42vw] truncate">{remoteName}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-white/60">{status === 'reconnecting' ? 'Reconnecting' : 'Live'}</span>
              <span className="ml-1 inline-flex items-center gap-1 text-white/60">
                {remoteAudio.isSpeaking ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
              </span>
            </div>
          </div>
        </div>

        <motion.div
          className="absolute bottom-[100px] right-6 z-30 h-[110px] w-[160px] overflow-hidden rounded-2xl border-2 border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
          drag
          dragConstraints={{ left: -300, right: 0, top: -200, bottom: 0 }}
          dragElastic={0.1}
          dragMomentum={false}
          onDragEnd={(_e, info) => {
            setPipPos({ x: info.point.x, y: info.point.y });
          }}
          whileDrag={{ scale: 1.05 }}
          whileHover={{ scale: 1.02 }}
          style={{ cursor: 'grab' }}
        >
          {localStream && !videoOff && (localStream.getVideoTracks?.()?.length || 0) > 0 ? (
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover [transform:scaleX(-1)]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-600 via-violet-700 to-fuchsia-700">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/25 text-3xl font-bold text-white">
                {localInitial}
              </div>
            </div>
          )}
          <div className="absolute bottom-2 left-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur">
            You
          </div>
          <div className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-black/40" />
          {muted ? (
            <div className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30">
              <MicOff className="h-4 w-4" />
            </div>
          ) : null}
        </motion.div>
      </div>

      <div className="relative z-40 pb-6">
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
                onClick={doToggleVideo}
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.10] transition',
                  videoOff
                    ? 'bg-red-500 text-white shadow-[0_10px_26px_rgba(239,68,68,0.35)] hover:bg-red-600 active:scale-95'
                    : 'bg-white/[0.08] text-white/90 hover:bg-white/[0.12] active:scale-95'
                )}
                aria-label={videoOff ? 'Turn camera on' : 'Turn camera off'}
              >
                {videoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              </button>

              <button
                type="button"
                onClick={onScreenShare}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.08] text-white/90 transition hover:bg-white/[0.12] active:scale-95"
                aria-label="Screen share"
              >
                <Monitor className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => onReaction?.('✨')}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.08] text-[#f97316] transition hover:bg-white/[0.12] active:scale-95"
                aria-label="Reactions"
              >
                <Sparkles className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={onShowParticipants}
                className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.08] text-white/90 transition hover:bg-white/[0.12] active:scale-95"
                aria-label="Participants"
              >
                <Users className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white/10 px-1 text-[10px] font-bold text-white ring-1 ring-white/15">
                  {participantCount}
                </span>
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
      </div>
    </div>
  );
}

