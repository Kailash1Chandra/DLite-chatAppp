"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ZegoExpressEngine } from "zego-express-engine-webrtc";
import {
  BadgeCheck,
  LayoutGrid,
  Maximize2,
  Mic,
  MicOff,
  Monitor,
  MoreHorizontal,
  PhoneOff,
  PictureInPicture2,
  Shield,
  Sparkles,
  Users,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { buildHostedCallUrl, getInviteCodeFromRoomId } from "@/lib/callRoom";
import { getUserProfileById } from "@/services/chatClient";
import { cn } from "@/lib/utils";
import {
  endCall,
  endHostedCallRoom,
  HOSTED_CALL_DECLINED_MESSAGE,
  joinHostedCallRoom,
  leaveHostedCallRoom,
  listenForCallEnded,
  listenForHostedCallEnded,
  listenForRejection,
} from "@/lib/call";

// Ensure ZEGO remote logger is disabled as early as possible (before engine init).
try {
  (ZegoExpressEngine as unknown as { presetLogConfig?: (c: unknown) => unknown }).presetLogConfig?.({
    logLevel: "disable",
    remoteLogLevel: "disable",
    logURL: "",
  });
} catch {
  /* ignore */
}

type RemoteTile = { streamId: string };

/** ZEGO streamID allows only alphanumeric plus '-' and '_'. */
function sanitizeZegoIdPart(raw: string) {
  const s = String(raw || "").trim();
  if (!s) return "user";
  return s.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 200) || "user";
}

/** Next.js `useParams()` may return `string | string[]` for a dynamic segment. */
function routeParamToString(value: string | string[] | undefined): string {
  if (value == null) return "";
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value).trim();
}

/** Stable main camera/audio publish id so peers can pull via roomUserUpdate even if roomStreamUpdate is delayed. */
function buildMainPublishStreamId(roomId: string, uid: string) {
  return `${sanitizeZegoIdPart(roomId)}_${sanitizeZegoIdPart(uid)}`;
}

/** Full user-key suffix from main publish stream id (for profile lookup; not truncated). */
function peerStreamUserKey(roomId: string, streamId: string) {
  const prefix = `${sanitizeZegoIdPart(roomId)}_`;
  if (streamId.startsWith(prefix)) {
    const tail = streamId.slice(prefix.length).trim();
    if (tail) return tail;
  }
  return "";
}

/** Best-effort short label from deterministic main stream id (roomPeer suffix). */
function peerLabelFromMainStreamId(roomId: string, streamId: string) {
  const key = peerStreamUserKey(roomId, streamId);
  if (!key) return "Participant";
  return key.length > 24 ? `${key.slice(0, 10)}…` : key;
}

function getInitials(nameOrId: string) {
  const s = String(nameOrId || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = (parts[0] || s)[0] || "?";
  const b = parts.length > 1 ? (parts[parts.length - 1] || "")[0] || "" : "";
  return (a + b).toUpperCase();
}

function AvatarBadge({ label }: { label: string }) {
  const initials = getInitials(label);
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-2xl font-bold text-white ring-1 ring-white/10">
      {initials}
    </div>
  );
}

function formatPeerIdAsDisplayName(id: string) {
  const s = String(id || "")
    .replace(/_/g, " ")
    .trim();
  if (!s) return "Participant";
  return s
    .split(/\s+/)
    .map((w) => (w.length ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
    .filter(Boolean)
    .join(" ");
}

/** ZEGO sometimes passes an object as `reason`; stringifying avoids `[object Object]` in the UI. */
function zegoReasonToString(reason: unknown): string {
  if (reason == null) return "";
  if (typeof reason === "string") return reason;
  if (typeof reason === "number" || typeof reason === "boolean") return String(reason);
  if (reason instanceof Error) return reason.message || "Error";
  if (typeof reason === "object") {
    const o = reason as Record<string, unknown>;
    for (const k of ["message", "reason", "state", "desc", "error"]) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    try {
      return JSON.stringify(reason);
    } catch {
      return "Unknown room state";
    }
  }
  return String(reason);
}

/**
 * Any value → safe UI string. Never relies on default `${obj}` / String(obj) for plain objects
 * (that becomes "[object Object]"). Used for error state and critical labels.
 */
const FALLBACK_CALL_HINT =
  "Sign in, open a valid room link, and allow microphone (and camera for video). If it still fails, check the browser console (F12).";

function isGarbageErrorMessage(raw: string): boolean {
  const s = raw.trim();
  return s === "[object Object]" || s === "Error: [object Object]" || /^Error:\s*\[object Object\]$/i.test(s);
}

/**
 * ZEGO / WebRTC often reject with `Error` whose `message` is literally "[object Object]" while
 * codes live on other own properties. Walk `getOwnPropertyNames` (not only enumerable).
 */
function collectErrorOwnProperties(err: Error, depth = 0): Record<string, unknown> {
  const anyE = err as Error & Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const maxDepth = 2;
  for (const k of Object.getOwnPropertyNames(anyE)) {
    if (k === "stack") continue;
    const v = anyE[k];
    if (typeof v === "function") continue;
    if (k === "message" && typeof v === "string" && isGarbageErrorMessage(v)) continue;
    if (k === "name" && (v === "Error" || v === "TypeError" || v === "DOMException")) continue;
    if (v === undefined) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    } else if (v instanceof Error && depth < maxDepth) {
      const inner = collectErrorOwnProperties(v, depth + 1);
      if (Object.keys(inner).length) out[k] = inner;
      else if (v.message && !isGarbageErrorMessage(v.message)) out[k] = v.message.trim();
    } else if (v != null && typeof v === "object") {
      try {
        out[k] = JSON.parse(JSON.stringify(v)) as unknown;
      } catch {
        try {
          out[k] = JSON.stringify(v);
        } catch {
          out[k] = "[object]";
        }
      }
    }
  }
  return out;
}

function normalizeUiError(input: unknown): string {
  if (input == null) return "";
  if (typeof input === "string") {
    const s = input.trim();
    if (isGarbageErrorMessage(s)) return FALLBACK_CALL_HINT;
    return input;
  }
  if (typeof input === "number" && Number.isFinite(input)) return String(input);
  if (typeof input === "boolean") return String(input);
  if (input instanceof Error) {
    const raw = input.message?.trim() ?? "";
    if (raw && !isGarbageErrorMessage(raw)) return raw;
    const cause = (input as Error & { cause?: unknown }).cause;
    if (cause !== undefined) {
      const fromCause = normalizeUiError(cause);
      if (fromCause && fromCause !== FALLBACK_CALL_HINT && !isGarbageErrorMessage(fromCause)) return fromCause;
    }
    const extras = collectErrorOwnProperties(input);
    const preferredKeys = [
      "message",
      "msg",
      "reason",
      "description",
      "detail",
      "state",
      "desc",
      "errorMessage",
      "error_msg",
      "errorMsg",
    ];
    for (const k of preferredKeys) {
      const v = extras[k];
      if (typeof v === "string" && v.trim() && !isGarbageErrorMessage(v)) return v.trim();
    }
    const codeVal = extras.code ?? extras.errorCode;
    if (typeof codeVal === "number" && Number.isFinite(codeVal)) return `Error code: ${codeVal}`;
    if (typeof codeVal === "string" && codeVal.trim()) return `Error code: ${codeVal.trim()}`;
    if (Object.keys(extras).length) {
      try {
        const json = JSON.stringify(extras);
        const clipped = json.length > 420 ? `${json.slice(0, 400)}…` : json;
        return `Call failed: ${clipped}`;
      } catch {
        /* fall through */
      }
    }
    return FALLBACK_CALL_HINT;
  }
  if (typeof input === "object") {
    if (typeof Response !== "undefined" && input instanceof Response) {
      return `HTTP ${input.status}${input.statusText ? ` ${input.statusText}` : ""}`.trim();
    }
    const o = input as Record<string, unknown>;
    for (const k of [
      "message",
      "reason",
      "error",
      "msg",
      "description",
      "detail",
      "state",
      "extendedData",
      "extraInfo",
    ]) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (v != null && typeof v === "object" && !(v instanceof Response)) {
        const nested = normalizeUiError(v);
        if (nested && nested !== FALLBACK_CALL_HINT && !isGarbageErrorMessage(nested)) return nested;
      }
    }
    for (const k of ["code", "errorCode"]) {
      const v = o[k];
      if (typeof v === "number" && Number.isFinite(v)) return `Error code ${v}`;
    }
    try {
      return JSON.stringify(input);
    } catch {
      return "Something went wrong";
    }
  }
  const s = String(input).trim();
  return isGarbageErrorMessage(s) ? FALLBACK_CALL_HINT : String(input);
}

function errorToUserMessage(e: unknown, fallback = "Something went wrong"): string {
  const n = normalizeUiError(e);
  return n.trim() || fallback;
}

function looksLikeMediaDeviceError(msg: string): boolean {
  const s = String(msg || "");
  return (
    /NotFoundError/i.test(s) ||
    /Requested device not found/i.test(s) ||
    /device not found/i.test(s) ||
    /NotAllowedError/i.test(s) ||
    /Permission denied/i.test(s) ||
    /denied/i.test(s) ||
    /NotReadableError/i.test(s) ||
    /Could not start video source/i.test(s) ||
    /OverconstrainedError/i.test(s)
  );
}

/**
 * DevTools: filter console by `[D-LITE call]` to see the real error (stack, cause, raw value).
 */
function logCallRoomFailure(context: string, err: unknown, extra?: Record<string, unknown>) {
  const payload: Record<string, unknown> = {
    context,
    uiMessage: normalizeUiError(err) || errorToUserMessage(err, ""),
    raw: err,
    ...extra,
  };
  if (err instanceof Error) {
    payload.name = err.name;
    payload.message = err.message;
    payload.stack = err.stack;
    const c = (err as Error & { cause?: unknown }).cause;
    if (c !== undefined) payload.cause = c;
    const extras = collectErrorOwnProperties(err);
    if (Object.keys(extras).length) payload.errorExtras = extras;
  }
  if (err && typeof err === "object" && !(err instanceof Error)) {
    if (typeof Response === "undefined" || !(err instanceof Response)) {
      try {
        payload.asJson = JSON.stringify(err);
      } catch {
        /* ignore */
      }
    }
  }
  console.error("[D-LITE call]", payload);
}

/** Always-on trace for connectivity issues (filter DevTools by `[D-LITE call]`). */
function callDiagInfo(message: string, detail?: Record<string, unknown>) {
  try {
    if (detail && Object.keys(detail).length) console.info("[D-LITE call]", message, detail);
    else console.info("[D-LITE call]", message);
  } catch {
    /* ignore */
  }
}

/** Profile / peer display: never turn arbitrary objects into "[object Object]" names. */
function safeDisplayName(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    for (const k of ["username", "name", "full_name", "displayName", "nickname", "email", "label"]) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  }
  return "";
}

function zegoStreamIdString(streamID: unknown): string {
  if (typeof streamID === "string" && streamID.trim()) return streamID.trim();
  const s = zegoReasonToString(streamID).trim();
  return s && s !== "[object Object]" ? s : "stream";
}

function zegoLikeToMediaStream(s: unknown): MediaStream | null {
  if (!s) return null;
  if (s instanceof MediaStream) return s;
  try {
    const anyS = s as { getAudioTracks?: () => MediaStreamTrack[]; getVideoTracks?: () => MediaStreamTrack[] };
    const at = anyS.getAudioTracks?.() || [];
    const vt = anyS.getVideoTracks?.() || [];
    const tracks = [...at, ...vt];
    if (tracks.length) return new MediaStream(tracks);
  } catch {
    /* ignore */
  }
  return null;
}

function useStreamAudioLevel(stream: MediaStream | null, active: boolean) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!active || !stream) {
      setLevel(0);
      return;
    }
    let ctx: AudioContext | null = null;
    let raf = 0;
    try {
      ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) sum += data[i];
        const avg = sum / (data.length * 255);
        setLevel(Math.min(1, avg * 3.2));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } catch {
      setLevel(0);
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
      try {
        void ctx?.close();
      } catch {
        /* ignore */
      }
    };
  }, [stream, active]);
  return level;
}

function audioQualityFromZego(q: number): { label: string; bars: number } {
  switch (q) {
    case 0:
      return { label: "Excellent", bars: 4 };
    case 1:
      return { label: "Good", bars: 3 };
    case 2:
      return { label: "Fair", bars: 2 };
    case 3:
      return { label: "Poor", bars: 1 };
    case 4:
      return { label: "Bad", bars: 0 };
    default:
      return { label: "—", bars: 0 };
  }
}

function VoiceCallWaveform({ level, idle = false }: { level: number; idle?: boolean }) {
  const bars = useMemo(() => Array.from({ length: 28 }, (_v, i) => i), []);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), idle ? 100 : 66);
    return () => window.clearInterval(id);
  }, [idle]);
  return (
    <div className="flex h-12 w-full max-w-xl items-end justify-center gap-[2px] px-4" aria-hidden="true">
      {bars.map((i) => {
        const phase = tick * 0.12 + i * 0.55;
        const idleWave = idle ? (Math.sin(phase) + 1) * 0.14 : 0;
        const live = Math.max(0.1, level * (0.58 + Math.sin(i * 0.35) * 0.22));
        const energy = idle ? Math.max(idleWave, live * 0.95) : live;
        const h = 4 + energy * 40;
        return (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            className="w-[3px] max-w-[3px] shrink-0 rounded-full"
            style={{
              height: `${h}px`,
              background: "linear-gradient(180deg, #c084fc, #f472b6)",
              transition: idle ? "height 95ms ease-out" : "height 45ms ease-out",
              opacity: 0.85 + energy * 0.15,
              boxShadow: "0 0 12px rgba(192,132,252,0.25)",
            }}
          />
        );
      })}
    </div>
  );
}

function ConnectionSignalBars({ bars, tone }: { bars: number; tone: "good" | "mid" | "bad" }) {
  const h = [10, 16, 22];
  const cls =
    tone === "good"
      ? "bg-emerald-400"
      : tone === "mid"
        ? "bg-amber-400"
        : "bg-rose-400";
  return (
    <div className="flex items-end gap-0.5" aria-hidden="true">
      {h.map((height, i) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className={cn("w-1 rounded-[1px]", i < bars ? cls : "bg-white/20")}
          style={{ height: `${height}px` }}
        />
      ))}
    </div>
  );
}

function tryPlayLocalVideo(stream: any, localNode: HTMLDivElement | null) {
  if (!stream) return;
  const node = localNode || (typeof document !== "undefined" ? (document.getElementById("dlite-zego-local") as any) : null);
  if (!node) return;
  try {
    stream.playVideo?.(node);
  } catch {
    /* ignore */
  }
}

async function applyZegoLoggingPolicy(zg?: InstanceType<typeof ZegoExpressEngine>) {
  // Disable both local + remote logs (remote logger can open `weblogger-wss...` / `zglog/ws` sockets).
  const config = { logLevel: "disable" as const, remoteLogLevel: "disable" as const, logURL: "" };

  // Prefer configuring logging *before* engine init when supported.
  try {
    const preset = (ZegoExpressEngine as unknown as { presetLogConfig?: (c: unknown) => unknown }).presetLogConfig?.(config);
    await Promise.resolve(preset).catch(() => undefined);
  } catch {
    /* ignore */
  }

  // Instance API (typed `setLogConfig` returns boolean in SDK 3.12).
  try {
    zg?.setLogConfig?.(config);
  } catch {
    /* ignore */
  }
}

/**
 * Zego 3.12 `presetLogConfig` does not persist `remoteLogLevel`; `setLogConfig` records it for
 * telemetry but cloud bootstrap may still call `enableWebSocketLog(true)`. Turn off the weblogger
 * socket on the internal logger (`an`) when the SDK exposes it.
 */
function tameZegoRemoteLogger(zg: InstanceType<typeof ZegoExpressEngine> | null | undefined) {
  if (!zg) return;
  try {
    const zgv = zg as unknown as { appConfig?: { log_config?: { ws_log?: number } } };
    const lc = zgv.appConfig?.log_config;
    if (lc && typeof lc === "object") lc.ws_log = 0;
  } catch {
    /* ignore */
  }
  const logger = (zg as unknown as { an?: Record<string, unknown> }).an as
    | {
        /** Second arg `true` clears cache per zego-express-logger (default was hiding cleanup). */
        enableWebSocketLog?: (enabled: boolean, clearCache?: boolean) => void;
        setRemoteLogLevel?: (level: string) => boolean;
        setLogLevel?: (level: string) => boolean;
      }
    | undefined;
  if (!logger) return;
  try {
    logger.setLogLevel?.("disable");
    logger.setRemoteLogLevel?.("disable");
    logger.enableWebSocketLog?.(false, true);
  } catch {
    /* ignore */
  }
}

/**
 * ZEGOCLOUD hosted room page.
 *
 * URL:
 * - /call/<roomId>?mode=video|audio
 */
export default function ZegoCallRoomPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const roomId = routeParamToString((params as { roomId?: string | string[] })?.roomId);
  const mode = String(searchParams?.get("mode") || "video").toLowerCase() === "audio" ? "audio" : "video";
  const isAdmin = String(searchParams?.get("admin") || "").trim() === "1";

  const userId = String(user?.id || "").trim();
  const userName = (safeDisplayName(user?.username) || userId || "User").trim();
  const inviteCode = useMemo(() => getInviteCodeFromRoomId(roomId), [roomId]);

  const localRef = useRef<HTMLDivElement | null>(null);
  const videoStageRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ZegoExpressEngine | null>(null);
  const localStreamRef = useRef<any>(null);
  const publishedStreamIdRef = useRef<string>("");
  const screenStreamRef = useRef<any>(null);
  const screenStreamIdRef = useRef<string>("");
  const remoteStreamsRef = useRef<Record<string, any>>({});

  const [status, setStatus] = useState<
    "idle" | "getting_token" | "initializing" | "logging_in" | "publishing" | "waiting_remote" | "connected" | "error"
  >("idle");
  const [error, setErrorRaw] = useState<string>("");
  const setError = useCallback((next: unknown) => {
    setErrorRaw(normalizeUiError(next));
  }, []);
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  const [remoteTiles, setRemoteTiles] = useState<RemoteTile[]>([]);
  const remoteTilesRef = useRef<RemoteTile[]>([]);
  const [copiedState, setCopiedState] = useState<"" | "code" | "link">("");
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(mode === "video");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const reconnectingRef = useRef(false);
  const engineDestroyTimerRef = useRef<number | null>(null);
  const [endedOverlayVisible, setEndedOverlayVisible] = useState(false);
  const [remoteVideoState, setRemoteVideoState] = useState<Record<string, boolean>>({});
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [callNow, setCallNow] = useState<number>(Date.now());
  const [remotePlayQuality, setRemotePlayQuality] = useState<number>(-1);
  const [remotePeerDelayMs, setRemotePeerDelayMs] = useState<number | null>(null);
  const [remotePeerProfileName, setRemotePeerProfileName] = useState("");
  const [speakerOn, setSpeakerOn] = useState(true);
  /** Video UI: spotlight + PiP vs two equal tiles. */
  const [videoLayout, setVideoLayout] = useState<"focus" | "dual">("focus");
  const primaryRemoteStreamIdForLayoutReset = remoteTiles[0]?.streamId ?? "";
  const streamPollRef = useRef<number | null>(null);
  const roomPeersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    remoteTilesRef.current = remoteTiles;
  }, [remoteTiles]);

  useEffect(() => {
    if (!primaryRemoteStreamIdForLayoutReset) setVideoLayout("focus");
  }, [primaryRemoteStreamIdForLayoutReset]);

  const server = useMemo(() => "wss://webliveroom-api.zego.im/ws", []);
  const hostedCallPath = useMemo(() => buildHostedCallUrl(roomId, mode), [mode, roomId]);
  const peerUserId = useMemo(() => {
    // If this hosted room id is a DM room (`dm-a--b`), we can detect the peer and sync "end call" for both sides.
    const raw = String(roomId || "").trim();
    if (!raw.startsWith("dm-")) return "";
    const rest = raw.slice(3);
    const parts = rest.split("--").map((s) => s.trim()).filter(Boolean);
    if (parts.length !== 2) return "";
    if (parts[0] === userId) return parts[1];
    if (parts[1] === userId) return parts[0];
    return "";
  }, [roomId, userId]);
  const shouldBroadcastEndToRoom = useMemo(() => Boolean(peerUserId) || isAdmin, [isAdmin, peerUserId]);
  const statusLabel = useMemo(() => {
    switch (status) {
      case "getting_token":
        return "Preparing call…";
      case "initializing":
        return "Starting media engine…";
      case "logging_in":
        return "Connecting to room…";
      case "publishing":
        return "Starting your stream…";
      case "waiting_remote":
        return "Waiting for others to join";
      case "connected":
        return "Live";
      case "error":
        return "Connection issue";
      default:
        return "Ready";
    }
  }, [status]);

  const applyLocalTrackState = useMemo(
    () => (stream: any) => {
      if (!stream) return;
      try {
        const audioTracks = stream.getAudioTracks?.() || [];
        audioTracks.forEach((track: MediaStreamTrack) => {
          track.enabled = isMicEnabled;
        });
      } catch {
        /* ignore */
      }

      try {
        const videoTracks = stream.getVideoTracks?.() || [];
        const shouldEnableVideo = mode === "video" && isCameraEnabled;
        videoTracks.forEach((track: MediaStreamTrack) => {
          track.enabled = shouldEnableVideo;
        });
      } catch {
        /* ignore */
      }
    },
    [isCameraEnabled, isMicEnabled, mode]
  );

  const toggleMic = () => {
    const next = !isMicEnabled;
    setIsMicEnabled(next);
    const stream = localStreamRef.current;
    if (!stream) return;
    try {
      const audioTracks = stream.getAudioTracks?.() || [];
      audioTracks.forEach((track: MediaStreamTrack) => {
        track.enabled = next;
      });
    } catch {
      /* ignore */
    }
  };

  const toggleCamera = () => {
    if (mode !== "video") return;
    const next = !isCameraEnabled;
    setIsCameraEnabled(next);
    const stream = localStreamRef.current;
    if (!stream) return;
    try {
      const videoTracks = stream.getVideoTracks?.() || [];
      videoTracks.forEach((track: MediaStreamTrack) => {
        track.enabled = next;
      });
    } catch {
      /* ignore */
    }
  };

  const stopPublishedStream = async (zg: ZegoExpressEngine | null, streamId: string, stream: any) => {
    if (!zg || !streamId || !stream) return;
    try {
      zg.stopPublishingStream(streamId);
    } catch {
      /* ignore */
    }
    try {
      zg.destroyStream(stream);
    } catch {
      /* ignore */
    }
  };

  const safeStopPublishingById = (zg: ZegoExpressEngine | null, streamId: string) => {
    if (!zg) return;
    const id = String(streamId || "").trim();
    if (!id) return;
    try {
      zg.stopPublishingStream(id);
    } catch {
      /* ignore */
    }
  };

  const republishCameraStream = async (zg: ZegoExpressEngine) => {
    const nextStream =
      mode === "audio"
        ? await zg.createZegoStream({ camera: { audio: true, video: false } })
        : await zg.createZegoStream({ camera: { audio: true, video: true } });
    localStreamRef.current = nextStream;
    applyLocalTrackState(nextStream);
    tryPlayLocalVideo(nextStream, localRef.current);
    // In some layouts the node may mount a tick later; retry once.
    window.setTimeout(() => tryPlayLocalVideo(nextStream, localRef.current), 0);
    const nextStreamId = buildMainPublishStreamId(roomId, userId);
    publishedStreamIdRef.current = nextStreamId;
    await zg.startPublishingStream(nextStreamId, nextStream);
  };

  const toggleScreenShare = async () => {
    if (mode !== "video") return;
    const zg = engineRef.current;
    if (!zg) return;

    try {
      if (isScreenSharing) {
        setIsScreenSharing(false);
        const screenId = screenStreamIdRef.current;
        const screenStream = screenStreamRef.current;
        screenStreamIdRef.current = "";
        screenStreamRef.current = null;
        await stopPublishedStream(zg, screenId, screenStream);

        // Restore camera stream publishing.
        const camId = publishedStreamIdRef.current;
        const camStream = localStreamRef.current;
        publishedStreamIdRef.current = "";
        localStreamRef.current = null;
        await stopPublishedStream(zg, camId, camStream);
        await republishCameraStream(zg);
        return;
      }

      // Switch publishing from camera -> screen.
      setIsScreenSharing(true);

      const camId = publishedStreamIdRef.current;
      const camStream = localStreamRef.current;
      publishedStreamIdRef.current = "";
      localStreamRef.current = null;
      await stopPublishedStream(zg, camId, camStream);

      const screenStream = await zg.createZegoStream({
        screen: {
          audio: false,
          video: { quality: 1 },
        },
      });
      screenStreamRef.current = screenStream;

      tryPlayLocalVideo(screenStream, localRef.current);
      window.setTimeout(() => tryPlayLocalVideo(screenStream, localRef.current), 0);

      const screenId = `${sanitizeZegoIdPart(roomId)}_${sanitizeZegoIdPart(userId)}_scr_${Date.now()}`;
      screenStreamIdRef.current = screenId;
      await zg.startPublishingStream(screenId, screenStream);

      // If the user stops sharing via browser UI, revert back.
      const screenTrack: MediaStreamTrack | undefined = screenStream?.getVideoTracks?.()?.[0];
      if (screenTrack) {
        screenTrack.onended = () => {
          toggleScreenShare().catch(() => undefined);
        };
      }
    } catch (e) {
      setIsScreenSharing(false);
      setError(errorToUserMessage(e, "Screen share failed"));
    }
  };

  useEffect(() => {
    if (mode !== "video") {
      setIsCameraEnabled(false);
    } else {
      setIsCameraEnabled(true);
    }
  }, [mode]);

  useEffect(() => {
    if (!roomId) return;
    if (!userId) return;

    let cancelled = false;
    let peerPlayDebounceTimer: number | null = null;
    let postPublishDiagTimer: number | null = null;
    const loggerTameTimers: number[] = [];

    const scheduleZegoLoggerTaming = (engine: InstanceType<typeof ZegoExpressEngine> | null) => {
      tameZegoRemoteLogger(engine);
      [320, 900, 2200].forEach((ms) => {
        loggerTameTimers.push(window.setTimeout(() => tameZegoRemoteLogger(engine), ms));
      });
    };

    const stopRemoteStreams = (zg: ZegoExpressEngine | null) => {
      const remoteIds = Object.keys(remoteStreamsRef.current);
      remoteIds.forEach((streamId) => {
        try {
          zg?.stopPlayingStream(streamId);
        } catch {
          /* ignore */
        }
      });
      remoteStreamsRef.current = {};
      roomPeersRef.current = new Set();
      setRemoteTiles([]);
    };

    const clearPendingEngineDestroy = () => {
      if (engineDestroyTimerRef.current !== null) {
        window.clearTimeout(engineDestroyTimerRef.current);
        engineDestroyTimerRef.current = null;
      }
    };

    const cleanup = async () => {
      loggerTameTimers.splice(0).forEach((id) => window.clearTimeout(id));
      if (peerPlayDebounceTimer !== null) {
        window.clearTimeout(peerPlayDebounceTimer);
        peerPlayDebounceTimer = null;
      }
      if (postPublishDiagTimer !== null) {
        window.clearTimeout(postPublishDiagTimer);
        postPublishDiagTimer = null;
      }
      clearPendingEngineDestroy();
      if (streamPollRef.current !== null) {
        try {
          window.clearInterval(streamPollRef.current);
        } catch {
          /* ignore */
        }
        streamPollRef.current = null;
      }

      const zg = engineRef.current;
      engineRef.current = null;

      stopRemoteStreams(zg);

      try {
        if (zg && screenStreamRef.current && screenStreamIdRef.current) {
          safeStopPublishingById(zg, screenStreamIdRef.current);
        }
      } catch {
        /* ignore */
      }
      try {
        if (zg && screenStreamRef.current) {
          zg.destroyStream(screenStreamRef.current);
          screenStreamRef.current = null;
          screenStreamIdRef.current = "";
        }
      } catch {
        /* ignore */
      }

      // Stop camera publishing only if we have a valid stream id.
      safeStopPublishingById(zg, publishedStreamIdRef.current);
      publishedStreamIdRef.current = "";

      try {
        if (zg && localStreamRef.current) {
          zg.destroyStream(localStreamRef.current);
          localStreamRef.current = null;
        }
      } catch {
        /* ignore */
      }

      try {
        if (zg) {
          await Promise.resolve((zg as unknown as { logoutRoom?: (r: string) => unknown }).logoutRoom?.(roomId)).catch(
            () => undefined
          );
        }
      } catch {
        /* ignore */
      }

      // Defer engine destruction slightly. ZEGO may still have in-flight post-login tasks
      // (cloud settings / loggers). Destroying immediately can trigger internal null deref errors.
      // Close the weblogger socket first so Chrome is less likely to log a spurious WebSocket error.
      if (zg) {
        const zgToDestroy = zg;
        try {
          tameZegoRemoteLogger(zgToDestroy);
        } catch {
          /* ignore */
        }
        engineDestroyTimerRef.current = window.setTimeout(() => {
          engineDestroyTimerRef.current = null;
          try {
            zgToDestroy.destroyEngine();
          } catch {
            /* ignore */
          }
        }, 380);
      }
    };

    const run = async () => {
      try {
        clearPendingEngineDestroy();
        setError("");
        setNeedsUserGesture(false);
        setRemoteTiles([]);
        roomPeersRef.current = new Set();
        const loggedQuietPeerPlayFail = new Set<string>();
        setStatus("getting_token");

        const tokenAbort = new AbortController();
        const tokenTimeout = window.setTimeout(() => tokenAbort.abort(), 12_000);
        const tokenRes = await fetch("/api/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, roomId }),
          signal: tokenAbort.signal,
        });
        window.clearTimeout(tokenTimeout);
        const tokenRaw = await tokenRes.text();
        let tokenJson: Record<string, unknown> = {};
        if (tokenRaw.trim()) {
          try {
            tokenJson = JSON.parse(tokenRaw) as Record<string, unknown>;
          } catch {
            tokenJson = {
              success: false,
              message: `Token API returned non-JSON (HTTP ${tokenRes.status}). ${tokenRaw.slice(0, 180).trim()}${tokenRaw.length > 180 ? "…" : ""}`,
            };
          }
        }
        if (!tokenRes.ok || tokenJson?.success === false) {
          const apiDetail = normalizeUiError(tokenJson?.message);
          const statusHint =
            tokenRes.status === 401 || tokenRes.status === 403
              ? "Not authorized to start this call. Sign in again and retry."
              : "";
          throw new Error(apiDetail || statusHint || `Could not get call token (HTTP ${tokenRes.status}).`);
        }
        const appId = Number(tokenJson?.appId);
        const token = String(tokenJson?.token || "");
        if (!appId || Number.isNaN(appId) || !token) throw new Error("Invalid token response");
        if (cancelled) return;

        setStatus("initializing");
        await applyZegoLoggingPolicy();
        if (cancelled) return;
        const zg = new ZegoExpressEngine(appId, server);
        engineRef.current = zg;
        await applyZegoLoggingPolicy(zg);
        scheduleZegoLoggerTaming(zg);
        if (cancelled) return;

        // Lower-latency realtime scenario (important for audio call "live voice" delay).
        // ZegoScenario.StandardVideoCall = 4 (enum in SDK typings). Must be set before loginRoom.
        try {
          zg.setRoomScenario?.(4 as any);
        } catch {
          /* ignore */
        }

        try {
          (zg as unknown as { setDebugVerbose?: (v: boolean) => void }).setDebugVerbose?.(false);
        } catch {
          /* ignore */
        }

        try {
          const resumed = await (zg as unknown as { resumeAudioContext?: () => Promise<boolean> | boolean }).resumeAudioContext?.();
          if (resumed === false) setNeedsUserGesture(true);
        } catch {
          /* ignore */
        }
        if (cancelled) return;

        const upsertRemoteTile = (streamId: string, remoteStream: any) => {
          remoteStreamsRef.current[streamId] = remoteStream;
          try {
            const hasVideo = (remoteStream?.getVideoTracks?.() || []).length > 0;
            setRemoteVideoState((prev) => ({ ...prev, [streamId]: hasVideo }));
          } catch {
            setRemoteVideoState((prev) => ({ ...prev, [streamId]: false }));
          }
          setRemoteTiles((current) => {
            if (current.some((tile) => tile.streamId === streamId)) return current;
            return [...current, { streamId }];
          });
          setStatus("connected");
          setError("");
        };

        const removeRemoteTiles = (streamIds: string[]) => {
          streamIds.forEach((streamId) => {
            try {
              zg.stopPlayingStream(streamId);
            } catch {
              /* ignore */
            }
            delete remoteStreamsRef.current[streamId];
          });
          setRemoteVideoState((prev) => {
            const next = { ...prev };
            streamIds.forEach((id) => delete next[id]);
            return next;
          });
          setRemoteTiles((current) => {
            const next = current.filter((tile) => !streamIds.includes(tile.streamId));
            if (next.length === 0) {
              setStatus("waiting_remote");
            }
            return next;
          });
        };

        const tryPlayPeerMainStreams = async (opts?: { quiet?: boolean }) => {
          const quiet = opts?.quiet !== false;
          for (const peerId of roomPeersRef.current) {
            if (peerId === userId) continue;
            const sid = buildMainPublishStreamId(roomId, peerId);
            if (!sid || sid === publishedStreamIdRef.current) continue;
            if (remoteStreamsRef.current[sid]) continue;
            try {
              const remoteStream = await zg.startPlayingStream(sid);
              upsertRemoteTile(sid, remoteStream);
            } catch (e) {
              if (!quiet) {
                const msg = normalizeUiError(e);
                setError(msg ? `Could not play remote stream: ${msg}` : "Could not play remote stream");
              } else if (!loggedQuietPeerPlayFail.has(sid)) {
                loggedQuietPeerPlayFail.add(sid);
                logCallRoomFailure(`startPlayingStream (peer main, quiet path) sid=${sid}`, e, {
                  roomId,
                  localUserId: userId,
                  roomPeers: [...roomPeersRef.current],
                });
              }
            }
          }
        };

        const scheduleTryPlayPeerMainStreams = () => {
          if (cancelled) return;
          if (peerPlayDebounceTimer !== null) window.clearTimeout(peerPlayDebounceTimer);
          peerPlayDebounceTimer = window.setTimeout(() => {
            peerPlayDebounceTimer = null;
            tryPlayPeerMainStreams({ quiet: true }).catch(() => undefined);
          }, 140);
        };

        const zegoLog = (...args: unknown[]) => {
          if (process.env.NODE_ENV !== "development") return;
          try {
            // eslint-disable-next-line no-console
            console.log(...args);
          } catch {
            /* ignore */
          }
        };

        const onRoomStreamUpdate = async (_roomID: string, updateType: "ADD" | "DELETE", streamList: any[]) => {
          if (cancelled) return;
          if (!Array.isArray(streamList) || streamList.length === 0) return;

          zegoLog("[zego] roomStreamUpdate", { updateType, count: streamList.length });
          if (updateType === "ADD") {
            const ids = streamList
              .map((s) => String(s?.streamID || s?.streamId || "").trim())
              .filter(Boolean);
            if (ids.length) callDiagInfo("roomStreamUpdate ADD", { streamIDs: ids });
          }

          if (updateType === "DELETE") {
            const deletedIds = streamList
              .map((s) => String(s?.streamID || s?.streamId || "").trim())
              .filter(Boolean);
            removeRemoteTiles(deletedIds);
            return;
          }

          for (const s of streamList) {
            const remoteStreamId = String(s?.streamID || s?.streamId || "").trim();
            if (!remoteStreamId) continue;
            if (remoteStreamId === publishedStreamIdRef.current) continue;
            if (remoteStreamsRef.current[remoteStreamId]) continue;
            try {
              const remoteStream = await zg.startPlayingStream(remoteStreamId);
              upsertRemoteTile(remoteStreamId, remoteStream);
            } catch (e) {
              const msg = normalizeUiError(e);
              setError(msg ? `Could not play remote stream: ${msg}` : "Could not play remote stream");
            }
          }
        };

        const onRoomUserUpdate = async (_roomID: string, updateType: "ADD" | "DELETE", userList: any[]) => {
          if (cancelled) return;
          if (!Array.isArray(userList)) return;
          zegoLog("[zego] roomUserUpdate", { updateType, count: userList.length });
          if (updateType === "ADD") {
            const ids = userList.map((u) => String(u?.userID || u?.userId || "").trim()).filter(Boolean);
            if (ids.length) callDiagInfo("roomUserUpdate ADD", { userIDs: ids });
          }
          if (updateType === "DELETE") {
            const removedStreamIds: string[] = [];
            for (const u of userList) {
              const pid = String(u?.userID || u?.userId || "").trim();
              if (pid) {
                roomPeersRef.current.delete(pid);
                removedStreamIds.push(buildMainPublishStreamId(roomId, pid));
              }
            }
            if (removedStreamIds.length) removeRemoteTiles(removedStreamIds);
            return;
          }
          for (const u of userList) {
            const pid = String(u?.userID || u?.userId || "").trim();
            if (pid) roomPeersRef.current.add(pid);
          }
          scheduleTryPlayPeerMainStreams();
        };

        const onRoomStateChanged = async (_roomID: string, reason: unknown, errorCode: number) => {
          if (cancelled) return;
          const reasonText = zegoReasonToString(reason);
          if (reasonText.toUpperCase() === "DISCONNECTED") {
            if (!reconnectingRef.current) {
              reconnectingRef.current = true;
              setStatus("logging_in");
              try {
                const r = await fetch("/api/token", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId, roomId }),
                });
                const j = await r.json().catch(() => ({}));
                const nextToken = String(j?.token || "");
                if (nextToken) {
                  try {
                    await zg.renewToken(nextToken, roomId);
                  } catch {
                    /* ignore */
                  }
                  try {
                    zg.logoutRoom(roomId);
                  } catch {
                    /* ignore */
                  }
                  await zg.loginRoom(roomId, nextToken, { userID: userId, userName }, { userUpdate: true });
                  if (localStreamRef.current && publishedStreamIdRef.current) {
                    try {
                      await zg.startPublishingStream(publishedStreamIdRef.current, localStreamRef.current);
                    } catch {
                      /* ignore */
                    }
                  }
                }
              } catch {
                /* ignore */
              } finally {
                reconnectingRef.current = false;
              }
            }
          }
          if (errorCode && errorCode !== 0) {
            const detail = reasonText || "unknown";
            setError(`Room state: ${detail} (code ${errorCode})`);
          }
        };

        zg.on("roomStreamUpdate", onRoomStreamUpdate);
        zg.on("roomStateChanged", onRoomStateChanged);
        try {
          (zg as unknown as { on?: (event: string, cb: (...args: unknown[]) => void) => void }).on?.(
            "roomUserUpdate",
            (rid: string, updateType: string, userList: any[]) => {
              const ut = updateType === "DELETE" || updateType === "ADD" ? updateType : "ADD";
              onRoomUserUpdate(rid, ut, userList).catch(() => undefined);
            }
          );
        } catch {
          /* ignore */
        }

        try {
          (zg as unknown as { on?: (event: string, cb: (...args: unknown[]) => void) => void }).on?.(
            "playerStateUpdate",
            (_roomID: string, streamID: unknown, state: { errorCode?: number } | undefined) => {
              if (cancelled) return;
              const code = Number(state?.errorCode || 0);
              if (code) setError(`Play failed (${zegoStreamIdString(streamID)}): code ${code}`);
            }
          );
          (zg as unknown as { on?: (event: string, cb: (...args: unknown[]) => void) => void }).on?.(
            "publisherStateUpdate",
            (_roomID: string, streamID: unknown, state: { errorCode?: number } | undefined) => {
              if (cancelled) return;
              const code = Number(state?.errorCode || 0);
              if (code) setError(`Publish failed (${zegoStreamIdString(streamID)}): code ${code}`);
            }
          );
          (zg as unknown as { on?: (event: string, cb: (...args: unknown[]) => void) => void }).on?.(
            "playQualityUpdate",
            (...args: unknown[]) => {
              if (cancelled) return;
              const a1 = args[1];
              const looksLikeStats = a1 !== null && typeof a1 === "object" && "audio" in (a1 as object);
              const streamID = String(looksLikeStats ? args[0] : args[1] || "");
              const stats = (looksLikeStats ? a1 : args[2]) as
                | { audio?: { audioQuality?: number }; peerToPeerDelay?: number }
                | undefined;
              if (!streamID || streamID === publishedStreamIdRef.current) return;
              const q = Number(stats?.audio?.audioQuality);
              if (Number.isFinite(q)) setRemotePlayQuality(q);
              const d = stats?.peerToPeerDelay;
              if (typeof d === "number" && Number.isFinite(d)) setRemotePeerDelayMs(Math.round(d));
            }
          );
        } catch {
          /* ignore */
        }

        setStatus("logging_in");
        const ok = await zg.loginRoom(roomId, token, { userID: userId, userName }, { userUpdate: true });
        if (!ok) throw new Error("loginRoom failed");
        if (cancelled) return;

        setStatus("publishing");
        let localStream: any = null;
        try {
          if (mode === "audio") {
            localStream = await zg.createZegoStream({ camera: { audio: true, video: false } });
          } else {
            // Prefer camera+mic for video calls, but fall back to audio-only when
            // the browser has no camera device (NotFoundError) or it becomes unavailable.
            try {
              localStream = await zg.createZegoStream({ camera: { audio: true, video: true } });
            } catch (err) {
              const msg = normalizeUiError(err);
              const isNotFound =
                /NotFoundError/i.test(msg) ||
                /Requested device not found/i.test(msg) ||
                /device not found/i.test(msg) ||
                /no.*(camera|video)/i.test(msg);
              if (!isNotFound) throw err;
              callDiagInfo("camera missing; falling back to audio-only stream", { roomId, localUserId: userId, msg });
              setIsCameraEnabled(false);
              localStream = await zg.createZegoStream({ camera: { audio: true, video: false } });
            }
          }
        } catch (err) {
          const msg = normalizeUiError(err);
          // Important: allow joining as a listener even if mic/camera is missing or blocked.
          // This fixes "both sides can't connect" when one device can't publish but can still play.
          if (looksLikeMediaDeviceError(msg)) {
            callDiagInfo("local media unavailable; joining as listener", { roomId, localUserId: userId, msg });
            setIsCameraEnabled(false);
            setIsMicEnabled(false);
            setError(
              msg
                ? `Mic/camera unavailable. Joining as listener. ${msg}`
                : "Mic/camera unavailable. Joining as listener."
            );
            localStream = null;
          } else {
            const wrap = new Error(msg || "Could not access microphone/camera");
            (wrap as Error & { cause?: unknown }).cause = err;
            throw wrap;
          }
        }
        localStreamRef.current = localStream;
        if (localStream) {
          applyLocalTrackState(localStream);
          // Enable AEC/ANS/AGC to improve clarity and reduce perceived lag/echo.
          try {
            await zg.setAudioConfig?.(localStream, { AEC: true, AGC: true, ANS: true } as any);
          } catch {
            /* ignore */
          }

          tryPlayLocalVideo(localStream, localRef.current);
          window.setTimeout(() => tryPlayLocalVideo(localStream, localRef.current), 0);
          window.setTimeout(() => tryPlayLocalVideo(localStream, localRef.current), 250);

          const streamId = buildMainPublishStreamId(roomId, userId);
          publishedStreamIdRef.current = streamId;
          if (!streamId.trim()) throw new Error("Invalid stream id");
          await zg.startPublishingStream(streamId, localStream);
          if (cancelled) return;
        } else {
          publishedStreamIdRef.current = "";
        }

        roomPeersRef.current.add(userId);
        await tryPlayPeerMainStreams({ quiet: true });

        // Web SDK has no public getRoomStreamList; roomStreamUpdate can be delayed. Retry deterministic peer pulls.
        let tries = 0;
        if (streamPollRef.current !== null) window.clearInterval(streamPollRef.current);
        streamPollRef.current = window.setInterval(() => {
          tries += 1;
          if (cancelled) return;
          if (remoteTilesRef.current.length > 0) {
            if (streamPollRef.current !== null) window.clearInterval(streamPollRef.current);
            streamPollRef.current = null;
            return;
          }
          tryPlayPeerMainStreams({ quiet: true }).catch(() => undefined);
          if (tries >= 40) {
            if (streamPollRef.current !== null) window.clearInterval(streamPollRef.current);
            streamPollRef.current = null;
            if (!cancelled && remoteTilesRef.current.length === 0) {
              const others = [...roomPeersRef.current].filter((id) => id && id !== userId);
              if (others.length > 0) {
                callDiagInfo("stream poll exhausted; final play attempt (non-quiet)", {
                  roomId,
                  localUserId: userId,
                  peers: others,
                  expectedMainSids: others.map((p) => buildMainPublishStreamId(roomId, p)),
                });
                void tryPlayPeerMainStreams({ quiet: false });
              }
            }
          }
        }, 650);

        if (postPublishDiagTimer !== null) window.clearTimeout(postPublishDiagTimer);
        postPublishDiagTimer = window.setTimeout(() => {
          postPublishDiagTimer = null;
          if (cancelled) return;
          if (remoteTilesRef.current.length > 0) return;
          const others = [...roomPeersRef.current].filter((id) => id && id !== userId);
          if (others.length === 0) return;
          callDiagInfo("post-publish delayed play (non-quiet)", {
            roomId,
            localUserId: userId,
            peers: others,
            expectedMainSids: others.map((p) => buildMainPublishStreamId(roomId, p)),
          });
          void tryPlayPeerMainStreams({ quiet: false });
        }, 6000);

        setStatus("waiting_remote");
      } catch (e) {
        if (cancelled) return;
        logCallRoomFailure("Zego run() / token / login / publish", e);
        setStatus("error");
        setError(errorToUserMessage(e, "Call failed"));
        await cleanup();
      }
    };

    run();

    return () => {
      cancelled = true;
      cleanup();
    };
    // Do not depend on applyLocalTrackState / isMicEnabled — toggling mic must not re-login or change publish stream id.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: mic/camera only via applyLocalTrackState effect
  }, [mode, roomId, server, userId, userName]);

  // Join call-service room channel (for cross-client "end call" sync).
  useEffect(() => {
    if (!userId || !roomId) return () => undefined;
    joinHostedCallRoom({ userId, roomId }).catch(() => undefined);
    return () => {
      leaveHostedCallRoom({ userId, roomId }).catch(() => undefined);
    };
  }, [roomId, userId]);

  // If someone ends the hosted room call, close this page too.
  useEffect(() => {
    if (!userId || !roomId) return () => undefined;
    return listenForHostedCallEnded(userId, roomId, () => {
      setEndedOverlayVisible(true);
      window.setTimeout(() => router.replace("/call"), 1200);
    });
  }, [roomId, router, userId]);

  useEffect(() => {
    if (!userId || !peerUserId) return () => undefined;
    // When peer ends the call, close this page too.
    return listenForCallEnded(
      userId,
      () => {
        setEndedOverlayVisible(true);
        window.setTimeout(() => router.replace("/call"), 1600);
      },
      { fromUserId: peerUserId }
    );
  }, [peerUserId, router, userId]);

  // Callee declined the ring — show message and leave (DM / known peer only).
  useEffect(() => {
    if (!userId || !peerUserId) return () => undefined;
    return listenForRejection(
      userId,
            (payload) => {
        if (!payload) return;
        setError(normalizeUiError(payload.message) || HOSTED_CALL_DECLINED_MESSAGE);
        setEndedOverlayVisible(true);
        window.setTimeout(() => router.replace("/call"), 2200);
      },
      { fromUserId: peerUserId }
    );
  }, [peerUserId, router, userId]);

  const handleLeave = async () => {
    setError("");
    // Tell the peer to close too (DM hosted room only).
    if (userId && peerUserId) {
      endCall({ userId, peerUserId }).catch(() => undefined);
    }
    // For hosted rooms: if admin (group) or DM (1v1), end room for everyone.
    if (userId && roomId && shouldBroadcastEndToRoom) {
      endHostedCallRoom({ userId, roomId }).catch(() => undefined);
    }
    setEndedOverlayVisible(true);
    window.setTimeout(() => router.replace("/call"), 1600);
  };

  useEffect(() => {
    applyLocalTrackState(localStreamRef.current);
  }, [applyLocalTrackState]);

  // Re-bind local preview after screen-share toggles (stream object / node timing).
  useEffect(() => {
    const s = localStreamRef.current || screenStreamRef.current;
    if (!s) return;
    tryPlayLocalVideo(s, localRef.current);
    window.setTimeout(() => tryPlayLocalVideo(s, localRef.current), 0);
  }, [isScreenSharing, videoLayout]);

  // Re-bind local preview when PiP vs solo layout changes (video mode).
  useEffect(() => {
    if (mode !== "video") return;
    const s = localStreamRef.current || screenStreamRef.current;
    if (!s) return;
    tryPlayLocalVideo(s, localRef.current);
    window.setTimeout(() => tryPlayLocalVideo(s, localRef.current), 0);
    window.setTimeout(() => tryPlayLocalVideo(s, localRef.current), 250);
  }, [mode, remoteTiles, videoLayout]);

  useEffect(() => {
    if (!engineRef.current) return;
    const zg = engineRef.current;
    remoteTiles.forEach(({ streamId }) => {
      const remoteStream = remoteStreamsRef.current[streamId];
      const mountId = `dlite-zego-remote-${streamId}`;
      const mountNode = document.getElementById(mountId);
      if (!remoteStream) return;
      try {
        // Always attach remote audio even in audio-only UI (no mount divs exist there).
        const audioId = `dlite-zego-audio-${streamId}`;
        let audio = document.getElementById(audioId) as HTMLAudioElement | null;
        if (!audio) {
          audio = document.createElement("audio");
          audio.id = audioId;
          audio.autoplay = true;
          audio.muted = false;
          audio.volume = 1;
          audio.style.display = "none";
          document.body.appendChild(audio);
        }
        try {
          (remoteStream as any).playAudio?.(audio);
        } catch {
          /* ignore */
        }
        try {
          (audio as any).srcObject = remoteStream;
        } catch {
          /* ignore */
        }
        Promise.resolve(audio.play()).catch(() => undefined);

        // Video binding only when we actually have a mount node (video UI).
        if (!mountNode) return;
        // Re-bind on layout switch: clear previous child if it belonged to a different stream.
        const prevBound = (mountNode as HTMLElement).dataset.boundStreamId || "";
        if (prevBound !== streamId) {
          mountNode.innerHTML = "";
          (mountNode as HTMLElement).dataset.boundStreamId = streamId;
        }

        // Use ZEGO's renderer for video (most reliable across stream object shapes).
        const remoteView = zg.createRemoteStreamView(remoteStream);
        remoteView.play(mountId);
        // Some browsers/layouts mount the node a tick late; retry once to avoid black tiles.
        window.setTimeout(() => {
          try {
            const n = document.getElementById(mountId);
            if (!n) return;
            const v = zg.createRemoteStreamView(remoteStream);
            v.play(mountId);
          } catch {
            /* ignore */
          }
        }, 0);

      } catch {
        /* ignore */
      }
    });
  }, [remoteTiles]);

  useEffect(() => {
    // Cleanup any dangling remote audio elements when streams go away.
    const active = new Set(remoteTiles.map((t) => t.streamId));
    const els = Array.from(document.querySelectorAll('audio[id^="dlite-zego-audio-"]')) as HTMLAudioElement[];
    for (const el of els) {
      const id = String(el.id || "");
      const streamId = id.replace("dlite-zego-audio-", "");
      if (!active.has(streamId)) {
        try {
          (el as any).srcObject = null;
        } catch {
          /* ignore */
        }
        try {
          el.remove();
        } catch {
          /* ignore */
        }
      }
    }
  }, [remoteTiles]);

  useEffect(() => {
    if (!copiedState) return;
    const t = window.setTimeout(() => setCopiedState(""), 1800);
    return () => window.clearTimeout(t);
  }, [copiedState]);

  useEffect(() => {
    if (status !== "connected") return;
    setCallStartedAt((prev) => prev ?? Date.now());
  }, [status]);

  useEffect(() => {
    if (!callStartedAt) return;
    if (status !== "connected") return;
    const t = window.setInterval(() => setCallNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [callStartedAt, status]);

  useEffect(() => {
    if (remoteTiles.length === 0) {
      setRemotePlayQuality(-1);
      setRemotePeerDelayMs(null);
    }
  }, [remoteTiles.length]);

  useEffect(() => {
    if (mode !== "audio") return;
    const audios = Array.from(document.querySelectorAll('audio[id^="dlite-zego-audio-"]')) as HTMLAudioElement[];
    audios.forEach((a) => {
      a.muted = !speakerOn;
      a.volume = speakerOn ? 1 : 0;
    });
  }, [mode, remoteTiles, speakerOn]);

  const remotePrimaryStreamId = remoteTiles[0]?.streamId ?? "";

  useEffect(() => {
    let cancelled = false;
    const streamId = String(remotePrimaryStreamId || "").trim();
    const fromStream = streamId ? peerStreamUserKey(roomId, streamId) : "";
    const lookupId = String(peerUserId || "").trim() || fromStream;
    if (!lookupId || !roomId) {
      setRemotePeerProfileName("");
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const p = await getUserProfileById(lookupId).catch(() => null);
        if (cancelled) return;
        const usernameRaw =
          (p as Record<string, unknown> | null)?.username ||
          (p as { user_metadata?: Record<string, string> } | null)?.user_metadata?.username ||
          (p as { user_metadata?: Record<string, string> } | null)?.user_metadata?.full_name ||
          (p as { user_metadata?: Record<string, string> } | null)?.user_metadata?.name ||
          (p as Record<string, unknown> | null)?.email ||
          "";
        const rawStr = safeDisplayName(usernameRaw) || safeDisplayName((p as Record<string, unknown> | null)?.email);
        const isUuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawStr);
        const emailStr = safeDisplayName((p as Record<string, unknown> | null)?.email);
        const fromEmail = emailStr && emailStr.includes("@") ? emailStr.split("@")[0] : "";
        const next =
          rawStr && !isUuidLike ? rawStr : fromEmail || "";
        setRemotePeerProfileName(next);
      } catch {
        if (!cancelled) setRemotePeerProfileName("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, peerUserId, remotePrimaryStreamId]);

  const primaryRemoteStreamIdForLevel = mode === "audio" ? remoteTiles[0]?.streamId || "" : "";
  const activeRemoteWave =
    mode === "audio" && status === "connected" && Boolean(primaryRemoteStreamIdForLevel);
  const activeLocalWave = mode === "audio" && !activeRemoteWave;
  const remoteMediaForLevel = activeRemoteWave
    ? zegoLikeToMediaStream(remoteStreamsRef.current[primaryRemoteStreamIdForLevel])
    : null;
  const localMediaForLevel = activeLocalWave ? zegoLikeToMediaStream(localStreamRef.current) : null;
  const remoteMicLevel = useStreamAudioLevel(remoteMediaForLevel, activeRemoteWave);
  const localMicLevel = useStreamAudioLevel(localMediaForLevel, activeLocalWave);
  const voiceWaveLevel = activeRemoteWave ? remoteMicLevel : localMicLevel;

  if (!roomId) {
    return <div className="p-6 text-sm text-slate-600">Missing roomId.</div>;
  }
  if (!userId) {
    return <div className="p-6 text-sm text-slate-600">Please login to join the call.</div>;
  }

  const primaryRemoteStreamId = remoteTiles[0]?.streamId || "";
  const localHasVideo = mode === "video" && isCameraEnabled;
  const localAvatarLabel = safeDisplayName(user?.username) || safeDisplayName(user?.email) || userId || "Me";
  const remoteStreamKey = primaryRemoteStreamId ? peerStreamUserKey(roomId, primaryRemoteStreamId) : "";
  const peerNameQuery = String(searchParams?.get("peer") || searchParams?.get("peerName") || "").trim();
  const peerLocQuery = String(searchParams?.get("loc") || "").trim();
  const voicePeerDisplayName =
    peerNameQuery ||
    safeDisplayName(remotePeerProfileName) ||
    (remoteStreamKey ? formatPeerIdAsDisplayName(remoteStreamKey) : "") ||
    "Participant";
  const voicePeerHandleRaw = (peerUserId || remoteStreamKey || "").replace(/\s+/g, "");
  const voicePeerSubtitle = [voicePeerHandleRaw ? `@${voicePeerHandleRaw.slice(0, 48)}` : "", peerLocQuery]
    .filter(Boolean)
    .join(" · ");
  const durationSec = callStartedAt ? Math.max(0, Math.floor((callNow - callStartedAt) / 1000)) : 0;
  const mm = String(Math.floor(durationSec / 60)).padStart(2, "0");
  const ss = String(durationSec % 60).padStart(2, "0");
  const voiceQuality = audioQualityFromZego(remotePlayQuality);
  const connLabel =
    status === "connected" && primaryRemoteStreamId
      ? remotePlayQuality >= 0
        ? voiceQuality.label
        : "Excellent"
      : statusLabel;
  const connBars = status === "connected" && primaryRemoteStreamId ? (remotePlayQuality >= 0 ? voiceQuality.bars : 4) : 0;
  const connTone: "good" | "mid" | "bad" =
    remotePlayQuality >= 3 ? "bad" : remotePlayQuality === 2 ? "mid" : "good";
  const videoConnText =
    status === "connected" && primaryRemoteStreamId
      ? `${normalizeUiError(connLabel)}${remotePeerDelayMs != null ? ` ${remotePeerDelayMs}ms` : ""}`
      : normalizeUiError(statusLabel);
  const callParticipantCount = remoteTiles.length + 1;

  const controlBtn =
    "relative flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/10 backdrop-blur " +
    "transition duration-150 ease-out will-change-transform " +
    "hover:bg-white/15 hover:-translate-y-[1px] hover:shadow-[0_10px_30px_-16px_rgba(255,255,255,0.25)] " +
    "active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black";

  return (
    <div
      className={cn(
        "relative flex min-h-[calc(100vh-56px)] w-full flex-col overflow-hidden rounded-[1.75rem] bg-[#0a0612] shadow-2xl shadow-black/35",
        "p-4 sm:p-5"
      )}
    >
      {/* ZEGO video: contain on main/solo so the full frame fits; cover in PiP & thumbs. */}
      <style jsx global>{`
        [data-zego-view='remote-main'] video,
        [data-zego-view='solo'] video {
          width: 100%;
          height: 100%;
          object-fit: contain !important;
          object-position: center !important;
          background: #000;
        }
        [data-zego-view='remote-thumb'] video,
        [data-zego-view='pip'] video {
          width: 100%;
          height: 100%;
          object-fit: cover !important;
          object-position: center !important;
          background: #000;
        }
        [data-zego-view='dual-remote'] video,
        [data-zego-view='dual-local'] video {
          width: 100%;
          height: 100%;
          object-fit: contain !important;
          object-position: center !important;
          background: #0d0d0d;
        }
      `}</style>

      {error.trim() ? (
        <div className="relative z-50 mb-3 w-full">
          <div
            role="alert"
            className="flex w-full items-start justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-50 shadow-lg backdrop-blur"
          >
            <div className="min-w-0">
              <p className="font-semibold text-rose-100">Call error</p>
              <p className="mt-1 break-words text-rose-50/90">{error}</p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-xl bg-black/40 px-3 py-2 text-xs font-semibold text-white/90 ring-1 ring-white/10 transition hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70"
              onClick={() => {
                const text = String(error || "").trim();
                if (!text) return;
                try {
                  void navigator.clipboard?.writeText(text);
                } catch {
                  /* ignore */
                }
              }}
            >
              Copy
            </button>
          </div>
        </div>
      ) : null}

      {mode === "video" ? (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
          <div
            ref={videoStageRef}
            className={cn(
              "relative z-10 flex min-h-[min(72vh,680px)] flex-1 flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#07050c] shadow-2xl",
              videoLayout === "dual" ? "px-0 pb-0 pt-0 sm:px-0 sm:pb-0 sm:pt-0" : "px-3 pb-36 pt-3 sm:px-5 sm:pb-40 sm:pt-5"
            )}
          >
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-950/90 via-[#0a0612] to-black" />
              <div className="absolute -left-24 -top-24 h-[380px] w-[380px] rounded-full bg-fuchsia-600/18 blur-[90px]" />
              <div className="absolute -bottom-32 -right-20 h-[440px] w-[440px] rounded-full bg-violet-600/22 blur-[95px]" />
              <div className="absolute inset-0 bg-black/35" />
            </div>

            <div
              className={cn(
                "relative z-10 flex w-full flex-col self-center",
                videoLayout === "dual" ? "max-w-none gap-0" : "max-w-[1280px] gap-3"
              )}
            >
              {videoLayout !== "dual" ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col gap-2">
                    <div className="inline-flex w-fit flex-wrap items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3.5 py-2 text-xs font-semibold text-white/90 shadow-lg backdrop-blur-md">
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70 opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                      </span>
                      <span className="tabular-nums tracking-tight text-white">
                        {mm}:{ss}
                      </span>
                      <span className="text-white/35" aria-hidden="true">
                        |
                      </span>
                      <span className="text-white/85">Video · 720p</span>
                      {isScreenSharing ? (
                        <span className="rounded-full bg-amber-500/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-100 ring-1 ring-amber-400/35">
                          Sharing
                        </span>
                      ) : null}
                      {isAdmin ? (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/75">Host</span>
                      ) : null}
                    </div>
                    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-100/95 backdrop-blur">
                      <Shield className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                      E2E encrypted
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-2 text-xs font-semibold text-white/90 shadow-md backdrop-blur-md">
                      <ConnectionSignalBars bars={connBars} tone={connTone} />
                      <span className={cn(remotePlayQuality >= 3 ? "text-rose-200" : "text-emerald-100")}>{videoConnText}</span>
                    </div>
                    <button
                      type="button"
                      disabled={!primaryRemoteStreamId}
                      onClick={async () => {
                        if (!primaryRemoteStreamId) return;
                        const mount = document.getElementById(`dlite-zego-remote-${primaryRemoteStreamId}`);
                        const vid = mount?.querySelector("video") as HTMLVideoElement | undefined;
                        if (!vid || !document.pictureInPictureEnabled) return;
                        try {
                          if (document.pictureInPictureElement === vid) await document.exitPictureInPicture();
                          else await vid.requestPictureInPicture();
                        } catch {
                          /* ignore */
                        }
                      }}
                      className={cn(
                        controlBtn,
                        "h-10 w-10 disabled:cursor-not-allowed disabled:opacity-45",
                        "focus-visible:ring-offset-[#0a0612]"
                      )}
                      aria-label="Picture in picture"
                      title="Picture in picture"
                    >
                      <PictureInPicture2 className="h-[18px] w-[18px]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const el = videoStageRef.current;
                        if (!el) return;
                        if (!document.fullscreenElement) void el.requestFullscreen?.().catch(() => undefined);
                        else void document.exitFullscreen?.();
                      }}
                      className={cn(controlBtn, "h-10 w-10 focus-visible:ring-offset-[#0a0612]")}
                      aria-label="Fullscreen"
                      title="Fullscreen"
                    >
                      <Maximize2 className="h-[18px] w-[18px]" />
                    </button>
                  </div>
                </div>
              ) : null}

              <div className={cn("relative flex min-h-0 flex-1 flex-col", videoLayout === "dual" ? "mt-0" : "mt-1")}>
                {remoteTiles.length > 1 && videoLayout !== "dual" ? (
                  <div className="mb-2 flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
                    {remoteTiles.slice(1).map(({ streamId }) => (
                      <div
                        key={streamId}
                        className="relative h-[88px] w-[132px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/50 shadow-lg"
                      >
                        <div
                          id={`dlite-zego-remote-${streamId}`}
                          data-zego-view="remote-thumb"
                          className="absolute inset-0"
                        />
                        {remoteVideoState[streamId] === false ? (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/65 text-lg font-bold text-white/90">
                            {getInitials(peerLabelFromMainStreamId(roomId, streamId))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                <div
                  className={cn(
                    "relative flex flex-1 overflow-hidden bg-black",
                    videoLayout === "dual"
                      ? "min-h-0 rounded-none border-0 shadow-none"
                      : "min-h-[min(52vh,520px)] rounded-2xl border border-white/10 shadow-[0_24px_80px_-55px_rgba(0,0,0,0.92)]",
                    primaryRemoteStreamId && videoLayout === "dual"
                      ? "flex-col items-stretch justify-center"
                      : "items-center justify-center"
                  )}
                >
                  {!primaryRemoteStreamId ? (
                    <>
                      <div
                        id="dlite-zego-local"
                        ref={localRef}
                        data-zego-view="solo"
                        className={cn("absolute inset-0", !localHasVideo && !isScreenSharing && "opacity-0")}
                      />
                      {!localHasVideo && !isScreenSharing ? (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
                          {user?.photoURL ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={String(user.photoURL)}
                              alt=""
                              className="h-28 w-28 rounded-full object-cover ring-2 ring-white/15"
                            />
                          ) : (
                            <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-fuchsia-600 to-violet-700 text-4xl font-extrabold text-white ring-2 ring-white/15">
                              {getInitials(localAvatarLabel)}
                            </div>
                          )}
                        </div>
                      ) : null}
                      {(status !== "connected" || (!localHasVideo && !isScreenSharing)) ? (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                          <p className="max-w-sm rounded-2xl bg-black/55 px-4 py-3 text-center text-sm leading-relaxed text-white/85 backdrop-blur">
                            {status === "error" && error.trim() ? error : statusLabel}
                          </p>
                        </div>
                      ) : null}
                    </>
                  ) : videoLayout === "dual" ? (
                    <div className="grid min-h-0 w-full flex-1 grid-cols-1 gap-px bg-black sm:grid-cols-2">
                      <div
                        data-dlite-dual-tile="remote"
                        className="relative aspect-video w-full min-w-0 overflow-hidden rounded-xl bg-neutral-900 shadow-[inset_0_0_0_2px_rgba(34,211,238,0.85)]"
                      >
                        <div
                          id={`dlite-zego-remote-${primaryRemoteStreamId}`}
                          data-zego-view="dual-remote"
                          className="absolute inset-0"
                        />
                        {remoteVideoState[primaryRemoteStreamId] === false ? (
                          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-900 px-4 text-center">
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-700 text-2xl font-extrabold text-white/90 ring-2 ring-white/10 sm:h-24 sm:w-24 sm:text-3xl">
                              {getInitials(voicePeerDisplayName)}
                            </div>
                            <p className="flex items-center justify-center gap-1 text-xs text-white/55">
                              <VideoOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              Camera off
                            </p>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-black/55 text-white/90 backdrop-blur-sm transition hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
                          aria-label="Fullscreen this tile"
                          title="Fullscreen"
                          onClick={(e) => {
                            const tile = (e.currentTarget as HTMLElement).closest("[data-dlite-dual-tile]") as HTMLElement | null;
                            if (!tile) return;
                            if (document.fullscreenElement === tile) void document.exitFullscreen?.();
                            else void tile.requestFullscreen?.().catch(() => undefined);
                          }}
                        >
                          <Maximize2 className="h-4 w-4" />
                        </button>
                        <div className="pointer-events-none absolute bottom-3 left-1/2 z-[1] flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 truncate rounded-full bg-black/65 px-3 py-1.5 text-xs font-semibold text-white/95 backdrop-blur-sm">
                          <span className="truncate">{voicePeerDisplayName}</span>
                          <Mic className="h-3.5 w-3.5 shrink-0 text-white/70" aria-hidden="true" />
                        </div>
                      </div>
                      <div
                        data-dlite-dual-tile="local"
                        className="relative aspect-video w-full min-w-0 overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-white/10"
                      >
                        <div
                          id="dlite-zego-local"
                          ref={localRef}
                          data-zego-view="dual-local"
                          className={cn("absolute inset-0", !localHasVideo && !isScreenSharing && "opacity-0")}
                        />
                        {!localHasVideo && !isScreenSharing ? (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-neutral-900">
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-700 text-2xl font-extrabold text-white/90 ring-2 ring-white/10 sm:h-24 sm:w-24">
                              {getInitials(localAvatarLabel)}
                            </div>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-black/55 text-white/90 backdrop-blur-sm transition hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                          aria-label="Fullscreen this tile"
                          title="Fullscreen"
                          onClick={(e) => {
                            const tile = (e.currentTarget as HTMLElement).closest("[data-dlite-dual-tile]") as HTMLElement | null;
                            if (!tile) return;
                            if (document.fullscreenElement === tile) void document.exitFullscreen?.();
                            else void tile.requestFullscreen?.().catch(() => undefined);
                          }}
                        >
                          <Maximize2 className="h-4 w-4" />
                        </button>
                        <div className="pointer-events-none absolute bottom-3 left-1/2 z-[1] flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 truncate rounded-full bg-black/65 px-3 py-1.5 text-xs font-semibold text-white/95 backdrop-blur-sm">
                          <span className="truncate">{localAvatarLabel}</span>
                          {isMicEnabled ? (
                            <Mic className="h-3.5 w-3.5 shrink-0 text-white/70" aria-hidden="true" />
                          ) : (
                            <MicOff className="h-3.5 w-3.5 shrink-0 text-rose-300" aria-hidden="true" />
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        id={`dlite-zego-remote-${primaryRemoteStreamId}`}
                        data-zego-view="remote-main"
                        className="absolute inset-0"
                      />
                      {remoteVideoState[primaryRemoteStreamId] === false ? (
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/50 px-6 text-center">
                          <div className="flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-fuchsia-600 to-violet-700 text-5xl font-extrabold text-white shadow-[0_0_60px_-10px_rgba(192,132,252,0.45)] ring-2 ring-white/15 sm:h-40 sm:w-40 sm:text-6xl">
                            {getInitials(voicePeerDisplayName)}
                          </div>
                          <div>
                            <p className="text-xl font-bold tracking-tight text-white sm:text-2xl">{voicePeerDisplayName}</p>
                            <p className="mt-2 flex items-center justify-center gap-2 text-sm text-white/60">
                              <VideoOff className="h-4 w-4 shrink-0" aria-hidden="true" />
                              Camera off · sharing audio
                            </p>
                          </div>
                        </div>
                      ) : null}

                      <div className="pointer-events-none absolute bottom-4 left-4 z-[1] max-w-[min(90%,280px)] truncate rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-md">
                        <span>{voicePeerDisplayName}</span>
                        <Mic className="ml-2 inline-block h-3.5 w-3.5 align-text-bottom text-white/70" aria-hidden="true" />
                      </div>

                      <div className="absolute bottom-4 right-4 z-[2] w-[min(32vw,220px)] overflow-hidden rounded-xl border border-white/15 bg-black/60 shadow-2xl ring-1 ring-white/10 backdrop-blur-sm">
                        <div className="relative aspect-video w-full">
                          <div
                            id="dlite-zego-local"
                            ref={localRef}
                            data-zego-view="pip"
                            className={cn("absolute inset-0", !localHasVideo && !isScreenSharing && "opacity-0")}
                          />
                          {!localHasVideo && !isScreenSharing ? (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50">
                              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-fuchsia-600 to-violet-700 text-lg font-bold text-white">
                                {getInitials(localAvatarLabel)}
                              </div>
                            </div>
                          ) : null}
                          <div className="pointer-events-none absolute left-2 top-2 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-black/40" />
                          <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur">
                            You
                          </div>
                          <div className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-black/55 p-1 text-white/90 backdrop-blur">
                            {isMicEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute bottom-5 left-0 right-0 z-20 flex justify-center px-2 sm:bottom-7">
              <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#141018]/95 px-3 py-2.5 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.95)] backdrop-blur-md">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={controlBtn}
                  aria-label={isMicEnabled ? "Mute" : "Unmute"}
                  title={isMicEnabled ? "Microphone" : "Microphone off"}
                >
                  {isMicEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </button>

                <button
                  type="button"
                  onClick={toggleCamera}
                  className={cn(
                    controlBtn,
                    !isCameraEnabled && "!bg-red-600/95 !ring-red-500/45 hover:!bg-red-600"
                  )}
                  aria-label={isCameraEnabled ? "Camera off" : "Camera on"}
                  title={isCameraEnabled ? "Camera" : "Camera off"}
                >
                  {isCameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </button>

                <button
                  type="button"
                  onClick={toggleScreenShare}
                  className={cn(
                    controlBtn,
                    isScreenSharing ? "bg-white/20 hover:bg-white/25" : "bg-white/10 hover:bg-white/20"
                  )}
                  aria-label={isScreenSharing ? "Stop sharing" : "Share screen"}
                  title={isScreenSharing ? "Stop sharing" : "Share screen"}
                >
                  <Monitor className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  disabled={!primaryRemoteStreamId}
                  onClick={() => setVideoLayout((v) => (v === "focus" ? "dual" : "focus"))}
                  className={cn(
                    controlBtn,
                    videoLayout === "dual" && primaryRemoteStreamId
                      ? "bg-white/20 hover:bg-white/25"
                      : "bg-white/10 hover:bg-white/20",
                    !primaryRemoteStreamId && "cursor-not-allowed opacity-45 hover:-translate-y-0 hover:shadow-none"
                  )}
                  aria-label={videoLayout === "dual" ? "Spotlight layout" : "Split view (two wide tiles)"}
                  title={videoLayout === "dual" ? "Spotlight (main + small You)" : "Split: side-by-side 16:9 tiles"}
                >
                  <LayoutGrid className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  disabled
                  className={cn(
                    controlBtn,
                    "text-white/70 disabled:cursor-not-allowed disabled:opacity-70 hover:-translate-y-0 hover:shadow-none"
                  )}
                  aria-label="Effects"
                  title="Effects"
                >
                  <Sparkles className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  disabled
                  className={cn(
                    controlBtn,
                    "relative text-white/70 disabled:cursor-not-allowed disabled:opacity-70 hover:-translate-y-0 hover:shadow-none"
                  )}
                  aria-label="Participants"
                  title={`Participants: ${callParticipantCount}`}
                >
                  <Users className="h-5 w-5" />
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold text-white shadow-sm">
                    {callParticipantCount}
                  </span>
                </button>

                <button
                  type="button"
                  disabled
                  className={cn(
                    controlBtn,
                    "text-white/70 disabled:cursor-not-allowed disabled:opacity-70 hover:-translate-y-0 hover:shadow-none"
                  )}
                  aria-label="More options"
                  title="More"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleLeave()}
                  className="ml-1 inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-red-500 px-4 text-sm font-semibold text-white shadow-lg shadow-red-500/30 ring-1 ring-red-400/35 transition duration-150 ease-out hover:-translate-y-[1px] hover:bg-red-600 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0612]"
                >
                  <PhoneOff className="h-5 w-5" />
                  End
                </button>
              </div>
            </div>

            {error ? (
              <p className="relative z-30 mx-auto mt-2 w-full max-w-xl rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-200">
                {error}
              </p>
            ) : null}

            {needsUserGesture ? (
              <div className="relative z-30 mx-auto mt-2 flex w-full max-w-xl items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-xs text-white/70">Browser blocked audio autoplay. Click to enable audio.</p>
                <button
                  type="button"
                  className="rounded-full bg-gradient-to-r from-ui-grad-from to-ui-grad-to px-3 py-1 text-[11px] font-semibold text-white shadow-sm hover:brightness-110"
                  onClick={async () => {
                    try {
                      await (
                        engineRef.current as unknown as { resumeAudioContext?: () => Promise<boolean> | boolean }
                      )?.resumeAudioContext?.();
                      try {
                        const audios = Array.from(
                          document.querySelectorAll('audio[id^="dlite-zego-audio-"]')
                        ) as HTMLAudioElement[];
                        audios.forEach((a) => {
                          a.muted = false;
                          a.volume = 1;
                          Promise.resolve(a.play()).catch(() => undefined);
                        });
                      } catch {
                        /* ignore */
                      }
                      setNeedsUserGesture(false);
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  Enable
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="relative mx-auto flex w-full max-w-[1160px] flex-1 flex-col justify-center pb-6">
            <div className="absolute inset-0 overflow-hidden rounded-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-950/80 via-[#0a0612] to-black" />
              <div className="absolute -left-24 -top-24 h-[380px] w-[380px] rounded-full bg-fuchsia-600/20 blur-[90px]" />
              <div className="absolute -bottom-32 -right-20 h-[440px] w-[440px] rounded-full bg-violet-600/25 blur-[95px]" />
              <div className="absolute inset-0 bg-black/40" />
            </div>

            <div className="relative z-10 mx-auto flex w-full max-w-[820px] flex-col px-4 py-8 text-white sm:px-6">
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-2">
                  <div className="inline-flex w-fit items-center gap-2.5 rounded-full border border-white/10 bg-black/45 px-3.5 py-2 text-xs font-semibold text-white/90 shadow-lg backdrop-blur-md">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70 opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                    </span>
                    <span className="tabular-nums tracking-tight text-white">{mm}:{ss}</span>
                    <span className="text-white/35" aria-hidden="true">
                      |
                    </span>
                    <span className="text-white/80">Voice · HD</span>
                    {isAdmin ? (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/75">Host</span>
                    ) : null}
                  </div>
                  <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-100/95 backdrop-blur">
                    <Shield className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                    End-to-end encrypted
                  </div>
                </div>

                <div className="mt-1 inline-flex w-fit items-center gap-2 self-start rounded-full border border-white/10 bg-black/45 px-3 py-2 text-xs font-semibold text-white/90 shadow-md backdrop-blur-md sm:mt-0 sm:self-auto">
                  <ConnectionSignalBars bars={connBars} tone={connTone} />
                  <span className={cn(remotePlayQuality >= 3 ? "text-rose-200" : "text-emerald-100")}>{connLabel}</span>
                </div>
              </div>

              <div className="mx-auto mt-12 flex w-full max-w-lg flex-col items-center text-center sm:mt-16">
                <div className="relative">
                  <div
                    className="pointer-events-none absolute -inset-3 rounded-full border border-dashed border-white/20"
                    aria-hidden="true"
                  />
                  <div className="pointer-events-none absolute -inset-8 rounded-full bg-gradient-to-br from-fuchsia-500/15 to-violet-600/10 blur-2xl" />
                  <div className="pointer-events-none absolute -inset-5 rounded-full ring-1 ring-white/10" />
                  <div className="relative flex h-36 w-36 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-amber-400 via-fuchsia-600 to-violet-700 text-5xl font-extrabold tracking-tight text-white shadow-[0_0_60px_-10px_rgba(192,132,252,0.55)] ring-2 ring-white/15 sm:h-40 sm:w-40 sm:text-6xl">
                    {getInitials(voicePeerDisplayName)}
                  </div>
                </div>

                <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{voicePeerDisplayName}</h2>
                  {status === "connected" && primaryRemoteStreamId ? (
                    <BadgeCheck className="h-7 w-7 shrink-0 text-sky-400" aria-label="Verified" />
                  ) : null}
                </div>
                {voicePeerSubtitle ? (
                  <p className="mt-2 max-w-md text-sm text-white/55">{voicePeerSubtitle}</p>
                ) : (
                  <p className="mt-2 text-sm text-white/55">
                    {status === "connected" ? "Voice call" : status === "error" && error.trim() ? error : statusLabel}
                  </p>
                )}

                <div className="mt-8 w-full rounded-full border border-white/10 bg-black/50 px-2 py-3 shadow-inner backdrop-blur-md">
                  <VoiceCallWaveform level={voiceWaveLevel} idle={status !== "connected"} />
                </div>
              </div>

              <div className="mx-auto mt-10 flex w-full max-w-[540px] justify-center px-1">
                <div className="flex w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#141018]/90 px-3 py-2.5 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.9)] backdrop-blur-md">
                  <button
                    type="button"
                    onClick={toggleMic}
                    className={controlBtn}
                    aria-label={isMicEnabled ? "Mute" : "Unmute"}
                    title={isMicEnabled ? "Microphone" : "Microphone off"}
                  >
                    {isMicEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSpeakerOn((v) => !v)}
                    className={cn(controlBtn, !speakerOn && "bg-white/5 opacity-90")}
                    aria-label={speakerOn ? "Speaker on" : "Speaker off"}
                    title={speakerOn ? "Speaker" : "Speaker muted"}
                  >
                    {speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push(buildHostedCallUrl(roomId, "video"))}
                    className={controlBtn}
                    aria-label="Switch to video call"
                    title="Video (camera off in voice mode)"
                  >
                    <VideoOff className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    disabled
                    className={cn(
                      controlBtn,
                      "text-white/70 disabled:cursor-not-allowed disabled:opacity-70 hover:-translate-y-0 hover:shadow-none"
                    )}
                    aria-label="Effects"
                    title="Effects"
                  >
                    <Sparkles className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    disabled
                    className={cn(
                      controlBtn,
                      "text-white/70 disabled:cursor-not-allowed disabled:opacity-70 hover:-translate-y-0 hover:shadow-none"
                    )}
                    aria-label="More options"
                    title="More"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLeave()}
                    className="ml-1 inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-red-500 px-4 text-sm font-semibold text-white shadow-lg shadow-red-500/30 ring-1 ring-red-400/35 transition duration-150 ease-out hover:-translate-y-[1px] hover:bg-red-600 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0612]"
                  >
                    <PhoneOff className="h-5 w-5" />
                    End
                  </button>
                </div>
              </div>

              {error ? (
                <p className="mx-auto mt-6 w-full max-w-lg rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-200">
                  {error}
                </p>
              ) : null}

              {needsUserGesture ? (
                <div className="mx-auto mt-4 flex w-full max-w-lg items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-xs text-white/70">Browser blocked audio autoplay. Click to enable audio.</p>
                  <button
                    type="button"
                    className="rounded-full bg-gradient-to-r from-ui-grad-from to-ui-grad-to px-3 py-1 text-[11px] font-semibold text-white shadow-sm hover:brightness-110"
                    onClick={async () => {
                      try {
                        await (
                          engineRef.current as unknown as { resumeAudioContext?: () => Promise<boolean> | boolean }
                        )?.resumeAudioContext?.();
                        try {
                          const audios = Array.from(
                            document.querySelectorAll('audio[id^="dlite-zego-audio-"]')
                          ) as HTMLAudioElement[];
                          audios.forEach((a) => {
                            a.muted = !speakerOn;
                            a.volume = speakerOn ? 1 : 0;
                            Promise.resolve(a.play()).catch(() => undefined);
                          });
                        } catch {
                          /* ignore */
                        }
                        setNeedsUserGesture(false);
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    Enable
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {endedOverlayVisible ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="max-w-sm rounded-2xl border border-white/10 bg-black/50 px-5 py-4 text-center text-white shadow-xl">
            <p className="text-sm font-semibold">Call ended</p>
            {error ? <p className="mt-2 text-xs leading-relaxed text-amber-100/90">{error}</p> : null}
            <p className="mt-2 text-xs text-white/70">Returning to calls…</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
