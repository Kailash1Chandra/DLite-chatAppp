'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, Laugh, Mic, MicOff, MoreHorizontal, PartyPopper, Flame, Monitor, SmilePlus, Video, VideoOff, PhoneOff } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatTimer(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds || 0)));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const two = (n) => String(n).padStart(2, '0');
  if (hh > 0) return `${two(hh)}:${two(mm)}:${two(ss)}`;
  return `${two(mm)}:${two(ss)}`;
}

function useCallTimer(startedAt, status) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    if (status !== 'connected') return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [startedAt, status]);
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
  const acRef = useRef(null);

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
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) throw new Error('No AudioContext');
      if (!acRef.current) acRef.current = new AudioCtx();
      const ac = acRef.current;
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
          // ignore
        }
        rafRef.current = window.requestAnimationFrame(loop);
      };

      rafRef.current = window.requestAnimationFrame(loop);
    } catch {
      // ignore
    }

    return () => {
      cancelled = true;
      try {
        if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      } catch {
        /* ignore */
      }
      rafRef.current = null;
      speakingSinceRef.current = null;
      setIsSpeaking(false);
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
  const [quality, setQuality] = useState({ tier: 'poor', label: 'Poor', color: '#ef4444', bars: 1 });

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
        let bars = 1;

        if (rtt < 100 && lossPct < 1) {
          tier = 'excellent';
          label = 'Excellent';
          color = '#10b981';
          bars = 3;
        } else if (rtt < 250 && lossPct < 3) {
          tier = 'good';
          label = 'Good';
          color = '#84cc16';
          bars = 3;
        } else if (rtt < 500 && lossPct < 7) {
          tier = 'fair';
          label = 'Fair';
          color = '#f59e0b';
          bars = 2;
        }

        if (!disposed) setQuality({ tier, label, color, bars });
      } catch {
        if (!disposed) setQuality({ tier: 'poor', label: 'Poor', color: '#ef4444', bars: 1 });
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

function LiveWaveform({ level, isSpeaking, count = 28 }) {
  const t0 = useRef(Date.now());
  const bars = useMemo(() => Array.from({ length: count }, (_v, i) => i), [count]);
  const bell = useCallback(
    (i) => {
      const x = (i - (count - 1) / 2) / ((count - 1) / 2);
      return Math.exp(-x * x * 1.6);
    },
    [count]
  );

  return (
    <div className="flex items-end justify-center gap-[3px]" aria-hidden="true">
      {bars.map((i) => {
        const base = 0.1 + bell(i) * 0.9;
        const idle = 0.18 + 0.08 * Math.sin(((Date.now() - t0.current) / 1000) * 2 + i * 0.22);
        const jitter = (Math.sin(((Date.now() - t0.current) / 1000) * 18 + i * 1.7) + 1) / 2;
        const intensity = isSpeaking ? Math.min(1, level * 1.25 + jitter * 0.25) : idle;
        const h = 4 + intensity * 32 * base;
        return (
          <div
            key={i}
            className="w-1 rounded-full"
            style={{
              height: `${h}px`,
              background: 'linear-gradient(180deg, #fb923c, #ea580c)',
              transition: 'height 80ms ease-out',
              filter: 'drop-shadow(0 6px 12px rgba(234,88,12,0.15))',
            }}
          />
        );
      })}
    </div>
  );
}

function ConnectionQualityPill({ quality }) {
  return (
    <div className="pointer-events-none inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] font-semibold text-white/85 backdrop-blur-md">
      <span className="inline-flex items-end gap-0.5" aria-hidden="true">
        <span
          className="w-1 rounded-sm"
          style={{ height: 6, backgroundColor: quality.bars >= 1 ? quality.color : 'rgba(255,255,255,0.2)' }}
        />
        <span
          className="w-1 rounded-sm"
          style={{ height: 10, backgroundColor: quality.bars >= 2 ? quality.color : 'rgba(255,255,255,0.2)' }}
        />
        <span
          className="w-1 rounded-sm"
          style={{ height: 14, backgroundColor: quality.bars >= 3 ? quality.color : 'rgba(255,255,255,0.2)' }}
        />
      </span>
      <span style={{ color: quality.color }}>{quality.label}</span>
    </div>
  );
}

function CallTimerPill({ startedAt, status }) {
  const seconds = useCallTimer(startedAt, status);
  return (
    <div className="pointer-events-none inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] font-semibold text-white/85 backdrop-blur-md">
      <motion.span
        className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]"
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 1.6, repeat: Infinity }}
        aria-hidden="true"
      />
      <span className="tabular-nums" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {status === 'reconnecting' ? 'Reconnecting…' : formatTimer(seconds)}
      </span>
    </div>
  );
}

function AvatarWithRings({ user, isSpeaking, level }) {
  const ringDur = isSpeaking ? 1.3 : 3.2;
  const ringScale = isSpeaking ? 1.1 : 1.03;
  const ringOpacity = isSpeaking ? 0.95 : 0.55;

  const boxShadow = isSpeaking
    ? `0 12px 40px rgba(249, 115, 22, 0.6), 0 0 0 ${4 + level * 12}px rgba(249, 115, 22, ${0.2 + level * 0.3})`
    : '0 12px 40px rgba(249, 115, 22, 0.4)';

  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        className="absolute h-[200px] w-[200px] rounded-full"
        style={{ background: 'rgba(249, 115, 22, 0.15)' }}
        animate={{ scale: [1, ringScale, 1], opacity: [0.6, ringOpacity, 0.6] }}
        transition={{ duration: ringDur, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute h-[160px] w-[160px] rounded-full"
        style={{ background: 'rgba(249, 115, 22, 0.25)' }}
        animate={{ scale: [1, ringScale * 0.98, 1], opacity: [0.7, ringOpacity, 0.7] }}
        transition={{ duration: ringDur, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div
        className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/30"
        style={{ boxShadow }}
      >
        {user?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-500 via-amber-500 to-rose-500 text-4xl font-bold text-white">
            {String(user?.initial || user?.name || 'U').slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}

function SelfPiP({ user, stream, videoOn, muted }) {
  const videoRef = useRef(null);
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (!stream) return;
    try {
      el.srcObject = stream;
      Promise.resolve(el.play?.()).catch(() => undefined);
    } catch {
      /* ignore */
    }
  }, [stream, videoOn]);

  const hasVideo = Boolean(stream?.getVideoTracks?.()?.length);
  const showVideo = videoOn && hasVideo;

  return (
    <motion.div
      className="absolute bottom-5 right-5 z-20 h-[130px] w-[100px] overflow-hidden rounded-2xl border-2 border-white/15 shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
      drag
      dragConstraints={{ left: -300, right: 0, top: -200, bottom: 0 }}
      dragElastic={0.1}
      dragMomentum={false}
      whileDrag={{ scale: 1.05 }}
      whileHover={{ scale: 1.02 }}
    >
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover [transform:scaleX(-1)]"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-600 to-violet-800 text-4xl font-bold text-white">
          {String(user?.initial || user?.name || 'Y').slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="absolute bottom-2 left-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur">
        You
      </div>
      {muted ? (
        <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30">
          <MicOff className="h-4 w-4" />
        </div>
      ) : null}
    </motion.div>
  );
}

function ReactionsLayer({ reactions }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      <AnimatePresence>
        {reactions.map((r) => (
          <motion.div
            key={r.id}
            className="absolute bottom-28 left-1/2 text-4xl"
            style={{ transform: `translateX(${r.x * 100}%)`, filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.35))' }}
            initial={{ y: 0, opacity: 0, scale: 0.5 }}
            animate={{ y: -300, opacity: [0, 1, 1, 0], scale: [0.5, 1.4, 1.2, 1] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: 'easeOut' }}
          >
            {r.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function ControlButton({ onClick, active, danger, accent, ariaLabel, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'flex h-12 w-12 items-center justify-center rounded-full text-white transition active:scale-95',
        danger
          ? 'bg-red-500 shadow-[0_4px_16px_rgba(239,68,68,0.4)] hover:bg-red-600'
          : active
            ? accent === 'violet'
              ? 'bg-violet-600 hover:bg-violet-700'
              : 'bg-white/20 hover:bg-white/25'
            : 'bg-white/10 hover:bg-white/20'
      )}
    >
      {children}
    </button>
  );
}

function FloatingControls({
  muted,
  videoOff,
  mode,
  onToggleMic,
  onToggleVideo,
  onScreenShare,
  onEnd,
  onOpenReactions,
  onMore,
}) {
  return (
    <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/55 px-3 py-2 backdrop-blur-xl">
        <ControlButton
          ariaLabel={muted ? 'Unmute microphone' : 'Mute microphone'}
          onClick={onToggleMic}
          active={muted}
          accent="none"
        >
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </ControlButton>

        {mode === 'video' ? (
          <ControlButton
            ariaLabel={videoOff ? 'Turn camera on' : 'Turn camera off'}
            onClick={onToggleVideo}
            active={!videoOff}
            accent="violet"
          >
            {videoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </ControlButton>
        ) : (
          <ControlButton ariaLabel="Screen share" onClick={onScreenShare}>
            <Monitor className="h-5 w-5" />
          </ControlButton>
        )}

        <ControlButton ariaLabel="Screen share" onClick={onScreenShare}>
          <Monitor className="h-5 w-5" />
        </ControlButton>

        <ControlButton ariaLabel="Reactions" onClick={onOpenReactions}>
          <SmilePlus className="h-5 w-5" />
        </ControlButton>

        <ControlButton ariaLabel="More" onClick={onMore}>
          <MoreHorizontal className="h-5 w-5" />
        </ControlButton>

        <div className="mx-1 h-7 w-px bg-white/10" aria-hidden="true" />

        <button
          type="button"
          onClick={onEnd}
          aria-label="End call"
          className="flex h-12 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-[0_4px_16px_rgba(239,68,68,0.4)] transition hover:bg-red-600 active:scale-95"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function StreamVideo({ stream, muted = false, mirrored = false, className = '', onError }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!stream) {
      try {
        el.srcObject = null;
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      if (el.srcObject !== stream) el.srcObject = stream;
      Promise.resolve(el.play?.()).catch(() => undefined);
    } catch {
      /* ignore */
    }
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      onError={onError}
      className={cn('h-full w-full object-cover', mirrored && '[transform:scaleX(-1)]', className)}
    />
  );
}

export default function PremiumCallUI({
  remoteUser,
  localUser,
  localStream,
  remoteStream,
  peerConnection,
  mode = 'audio',
  status = 'connecting',
  startedAt,
  onEnd,
  onToggleMic,
  onToggleVideo,
  onScreenShare,
  onReaction,
  onMore,
}) {
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(mode !== 'video');
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [reactions, setReactions] = useState([]);

  const remoteAudio = useAudioLevel(remoteStream);
  const quality = useConnectionQuality(peerConnection);

  const applyMic = useCallback(
    (nextMuted) => {
      try {
        localStream?.getAudioTracks?.()?.forEach((t) => (t.enabled = !nextMuted));
      } catch {
        /* ignore */
      }
    },
    [localStream]
  );

  const applyVideo = useCallback(
    (nextOff) => {
      try {
        localStream?.getVideoTracks?.()?.forEach((t) => (t.enabled = !nextOff));
      } catch {
        /* ignore */
      }
    },
    [localStream]
  );

  useEffect(() => {
    applyMic(muted);
  }, [muted, applyMic]);

  useEffect(() => {
    applyVideo(videoOff);
  }, [videoOff, applyVideo]);

  useEffect(() => {
    setVideoOff(mode !== 'video');
  }, [mode]);

  const addReaction = useCallback(
    (emoji) => {
      const id = `r_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const x = (Math.random() * 0.12 - 0.06) * 100;
      setReactions((prev) => [...prev, { id, emoji, x }]);
      window.setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 2100);
      try {
        onReaction?.(emoji);
      } catch {
        /* ignore */
      }
    },
    [onReaction]
  );

  const subtitle =
    status === 'reconnecting'
      ? 'Reconnecting…'
      : status === 'connected'
        ? 'Connected · HD audio'
        : 'Connecting…';

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden rounded-[1.75rem] bg-black shadow-2xl shadow-black/35"
      style={{
        background:
          'radial-gradient(circle at 50% 30%, #7c2d12 0%, #431407 40%, #1a0f0a 80%)',
      }}
    >
      <div className="absolute left-4 top-4 z-30">
        <CallTimerPill startedAt={startedAt} status={status} />
      </div>
      <div className="absolute right-4 top-4 z-30">
        <ConnectionQualityPill quality={quality} />
      </div>

      <ReactionsLayer reactions={reactions} />

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-6">
        {mode === 'video' ? (
          <div className="relative mx-auto flex h-full w-full max-w-[1160px] min-h-0 flex-1 flex-col">
            <div className="grid h-full min-h-0 w-full grid-cols-1 gap-4 md:grid-cols-2">
              <div className="relative overflow-hidden rounded-2xl bg-black/40 ring-1 ring-white/10 shadow-[0_24px_80px_-60px_rgba(0,0,0,0.9)]">
                {remoteStream ? (
                  <StreamVideo stream={remoteStream} className="absolute inset-0" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <AvatarWithRings user={remoteUser} isSpeaking={remoteAudio.isSpeaking} level={remoteAudio.level} />
                  </div>
                )}
                <div className="absolute left-4 top-4 rounded-full bg-black/45 px-3 py-1 text-xs font-semibold text-white/90 ring-1 ring-white/10 backdrop-blur">
                  {remoteUser?.name || 'User'}
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl bg-black/40 ring-1 ring-white/10 shadow-[0_24px_80px_-60px_rgba(0,0,0,0.9)]">
                {localStream && !videoOff ? (
                  <StreamVideo stream={localStream} muted mirrored className="absolute inset-0" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/30">
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-600 to-violet-800 text-5xl font-bold text-white">
                        {String(localUser?.initial || localUser?.name || 'Y').slice(0, 1).toUpperCase()}
                      </div>
                    </div>
                  </div>
                )}
                <div className="absolute left-4 top-4 rounded-full bg-black/45 px-3 py-1 text-xs font-semibold text-white/90 ring-1 ring-white/10 backdrop-blur">
                  You
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-5 text-center">
              <AvatarWithRings user={remoteUser} isSpeaking={remoteAudio.isSpeaking} level={remoteAudio.level} />
              <div>
                <p className="text-2xl font-bold tracking-tight text-white">{remoteUser?.name || 'Call'}</p>
                <p className="mt-1 text-sm text-white/75">
                  <span className={cn(status === 'connected' ? 'text-emerald-300' : 'text-white/70')}>●</span> {subtitle}
                </p>
              </div>

              <div className="mt-1">
                <LiveWaveform level={remoteAudio.level} isSpeaking={remoteAudio.isSpeaking} count={28} />
              </div>
            </div>

            <SelfPiP user={localUser} stream={localStream} videoOn={mode === 'video' && !videoOff} muted={muted} />
          </>
        )}
      </div>

      <FloatingControls
        muted={muted}
        videoOff={videoOff}
        mode={mode}
        onToggleMic={() => {
          const next = !muted;
          setMuted(next);
          onToggleMic?.(next);
        }}
        onToggleVideo={() => {
          const next = !videoOff;
          setVideoOff(next);
          onToggleVideo?.(next);
        }}
        onScreenShare={onScreenShare}
        onEnd={onEnd}
        onMore={onMore}
        onOpenReactions={() => setReactionsOpen((v) => !v)}
      />

      <AnimatePresence>
        {reactionsOpen ? (
          <motion.div
            className="absolute bottom-[92px] left-1/2 z-40 -translate-x-1/2"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.16 }}
          >
            <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-black/55 p-2 backdrop-blur-xl">
              {[
                { e: '❤️', I: Heart },
                { e: '😂', I: Laugh },
                { e: '👍', I: null },
                { e: '🎉', I: PartyPopper },
                { e: '🔥', I: Flame },
                { e: '😮', I: null },
              ].map((x) => (
                <button
                  key={x.e}
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-xl transition hover:scale-125 active:scale-95"
                  onClick={() => addReaction(x.e)}
                  aria-label={`React ${x.e}`}
                >
                  {x.e}
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

