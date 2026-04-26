"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ZegoExpressEngine } from "zego-express-engine-webrtc";
import { Mic, MicOff, Monitor, MonitorOff, Phone, PhoneOff, Users, Video, VideoOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { buildHostedCallUrl, getInviteCodeFromRoomId } from "@/lib/callRoom";
import { cn } from "@/lib/utils";
import { endCall, listenForCallEnded } from "@/lib/call";

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

function AudioWaveform({ active = false }: { active?: boolean }) {
  const bars = useMemo(() => Array.from({ length: 22 }, (_v, i) => i), []);
  return (
    <div className="flex items-end justify-center gap-[3px]" aria-hidden="true">
      {bars.map((i) => {
        const base = 0.22 + Math.sin(i * 0.5) * 0.1;
        const wobble = active ? (Math.sin(Date.now() / 180 + i * 0.75) + 1) / 2 : 0.15;
        const h = 6 + (active ? wobble : base) * 26;
        return (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            className="w-1 rounded-full"
            style={{
              height: `${h}px`,
              background: "linear-gradient(180deg, #fb923c, #ea580c)",
              transition: "height 90ms ease-out",
              filter: "drop-shadow(0 10px 22px rgba(234,88,12,0.20))",
              opacity: 0.95,
            }}
          />
        );
      })}
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
  // Disable both local + remote logs (remote logger can open `weblogger-wss...` sockets).
  // `logURL: ""` explicitly disables log reporting endpoint per ZEGO docs.
  const config = { logLevel: "disable", remoteLogLevel: "disable", logURL: "" } as const;

  // Prefer configuring logging *before* engine init when supported.
  try {
    const preset = (ZegoExpressEngine as unknown as { presetLogConfig?: (c: unknown) => unknown }).presetLogConfig?.(config);
    await Promise.resolve(preset).catch(() => undefined);
  } catch {
    /* ignore */
  }

  // Also apply on the instance (some builds only honor this path) and ensure promise rejections can't escape.
  try {
    const instCfg = (zg as unknown as { setLogConfig?: (c: unknown) => unknown }).setLogConfig?.(config);
    await Promise.resolve(instCfg).catch(() => undefined);
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

  const roomId = String((params as any)?.roomId || "").trim();
  const mode = String(searchParams?.get("mode") || "video").toLowerCase() === "audio" ? "audio" : "video";
  const isAdmin = String(searchParams?.get("admin") || "").trim() === "1";

  const userId = String(user?.id || "").trim();
  const userName = String(user?.username || userId || "User").trim();
  const inviteCode = useMemo(() => getInviteCodeFromRoomId(roomId), [roomId]);

  const localRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ZegoExpressEngine | null>(null);
  const localStreamRef = useRef<any>(null);
  const publishedStreamIdRef = useRef<string>("");
  const screenStreamRef = useRef<any>(null);
  const screenStreamIdRef = useRef<string>("");
  const remoteStreamsRef = useRef<Record<string, any>>({});

  const [status, setStatus] = useState<
    "idle" | "getting_token" | "initializing" | "logging_in" | "publishing" | "waiting_remote" | "connected" | "error"
  >("idle");
  const [error, setError] = useState<string>("");
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  const [remoteTiles, setRemoteTiles] = useState<RemoteTile[]>([]);
  const [copiedState, setCopiedState] = useState<"" | "code" | "link">("");
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(mode === "video");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const reconnectingRef = useRef(false);
  const engineDestroyTimerRef = useRef<number | null>(null);
  const [videoLayout, setVideoLayout] = useState<"whatsapp" | "meet">("meet");
  const [endedOverlayVisible, setEndedOverlayVisible] = useState(false);
  const [remoteVideoState, setRemoteVideoState] = useState<Record<string, boolean>>({});
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [callNow, setCallNow] = useState<number>(Date.now());

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

  const statusTone = useMemo(() => {
    if (status === "connected") return "text-emerald-700 dark:text-emerald-300";
    if (status === "error") return "text-rose-700 dark:text-rose-300";
    if (status === "logging_in" || status === "publishing" || status === "getting_token" || status === "initializing") {
      return "text-amber-700 dark:text-amber-300";
    }
    return "text-slate-700 dark:text-slate-200";
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
    const nextStreamId = `${roomId}-${userId}-${Date.now()}`;
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
      // Better view: auto-switch to WhatsApp-style PiP when screen sharing starts.
      setVideoLayout("whatsapp");

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

      const screenId = `${roomId}-${userId}-screen-${Date.now()}`;
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
      setError(e instanceof Error ? e.message : "Screen share failed");
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
      setRemoteTiles([]);
    };

    const clearPendingEngineDestroy = () => {
      if (engineDestroyTimerRef.current !== null) {
        window.clearTimeout(engineDestroyTimerRef.current);
        engineDestroyTimerRef.current = null;
      }
    };

    const cleanup = async () => {
      clearPendingEngineDestroy();

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
      if (zg) {
        const zgToDestroy = zg;
        engineDestroyTimerRef.current = window.setTimeout(() => {
          engineDestroyTimerRef.current = null;
          try {
            zgToDestroy.destroyEngine();
          } catch {
            /* ignore */
          }
        }, 220);
      }
    };

    const run = async () => {
      try {
        clearPendingEngineDestroy();
        setError("");
        setNeedsUserGesture(false);
        setRemoteTiles([]);
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
        const tokenJson = await tokenRes.json().catch(() => ({}));
        if (!tokenRes.ok || tokenJson?.success === false) {
          throw new Error(tokenJson?.message || "Could not get ZEGO token");
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
        if (cancelled) return;

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

        const onRoomStreamUpdate = async (_roomID: string, updateType: "ADD" | "DELETE", streamList: any[]) => {
          if (cancelled) return;
          if (!Array.isArray(streamList) || streamList.length === 0) return;

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
            } catch {
              /* ignore and continue */
            }
          }
        };

        const onRoomStateChanged = async (_roomID: string, reason: string, errorCode: number) => {
          if (cancelled) return;
          if (String(reason).toUpperCase() === "DISCONNECTED") {
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
                    await zg.renewToken(roomId, nextToken);
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
            setError(`Room state: ${reason} (code ${errorCode})`);
          }
        };

        zg.on("roomStreamUpdate", onRoomStreamUpdate);
        zg.on("roomStateChanged", onRoomStateChanged);

        try {
          (zg as unknown as { on?: (event: string, cb: (...args: unknown[]) => void) => void }).on?.(
            "playerStateUpdate",
            (_roomID: string, streamID: string, state: { errorCode?: number } | undefined) => {
              if (cancelled) return;
              const code = Number(state?.errorCode || 0);
              if (code) setError(`Play failed (${streamID}): code ${code}`);
            }
          );
          (zg as unknown as { on?: (event: string, cb: (...args: unknown[]) => void) => void }).on?.(
            "publisherStateUpdate",
            (_roomID: string, streamID: string, state: { errorCode?: number } | undefined) => {
              if (cancelled) return;
              const code = Number(state?.errorCode || 0);
              if (code) setError(`Publish failed (${streamID}): code ${code}`);
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
        let localStream: any;
        try {
          localStream =
            mode === "audio"
              ? await zg.createZegoStream({ camera: { audio: true, video: false } })
              : await zg.createZegoStream({ camera: { audio: true, video: true } });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(msg || "Could not access microphone/camera");
        }
        localStreamRef.current = localStream;
        applyLocalTrackState(localStream);

        tryPlayLocalVideo(localStream, localRef.current);
        window.setTimeout(() => tryPlayLocalVideo(localStream, localRef.current), 0);

        const streamId = `${roomId}-${userId}-${Date.now()}`;
        publishedStreamIdRef.current = streamId;
        if (!streamId.trim()) throw new Error("Invalid stream id");
        await zg.startPublishingStream(streamId, localStream);
        if (cancelled) return;

        setStatus("waiting_remote");
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : "Call failed");
        await cleanup();
      }
    };

    run();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [applyLocalTrackState, mode, roomId, server, userId, userName]);

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

  const handleLeave = async () => {
    // Tell the peer to close too (DM hosted room only).
    if (userId && peerUserId) {
      endCall({ userId, peerUserId }).catch(() => undefined);
    }
    setEndedOverlayVisible(true);
    window.setTimeout(() => router.replace("/call"), 1600);
  };

  useEffect(() => {
    applyLocalTrackState(localStreamRef.current);
  }, [applyLocalTrackState]);

  // Re-bind local renderer when layout switches (node can remount).
  useEffect(() => {
    const s = localStreamRef.current || screenStreamRef.current;
    if (!s) return;
    tryPlayLocalVideo(s, localRef.current);
    window.setTimeout(() => tryPlayLocalVideo(s, localRef.current), 0);
  }, [videoLayout]);

  useEffect(() => {
    if (!engineRef.current) return;
    const zg = engineRef.current;
    remoteTiles.forEach(({ streamId }) => {
      const remoteStream = remoteStreamsRef.current[streamId];
      const mountId = `dlite-zego-remote-${streamId}`;
      const mountNode = document.getElementById(mountId);
      if (!remoteStream || !mountNode) return;
      try {
        // Re-bind on layout switch: clear previous child if it belonged to a different stream.
        const prevBound = (mountNode as HTMLElement).dataset.boundStreamId || "";
        if (prevBound !== streamId) {
          mountNode.innerHTML = "";
          (mountNode as HTMLElement).dataset.boundStreamId = streamId;
        }

        // Use ZEGO's renderer for video (most reliable across stream object shapes).
        const remoteView = zg.createRemoteStreamView(remoteStream);
        remoteView.play(mountId);

        // Additionally attach audio via a hidden <audio> element to ensure voice plays.
        const audioId = `dlite-zego-audio-${streamId}`;
        let audio = document.getElementById(audioId) as HTMLAudioElement | null;
        if (!audio) {
          audio = document.createElement("audio");
          audio.id = audioId;
          audio.autoplay = true;
          // `playsInline` is a video-only property; keep audio simple.
          audio.style.display = "none";
          document.body.appendChild(audio);
        }
        (audio as any).srcObject = remoteStream;
        Promise.resolve(audio.play()).catch(() => undefined);
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

  if (!roomId) {
    return <div className="p-6 text-sm text-slate-600">Missing roomId.</div>;
  }
  if (!userId) {
    return <div className="p-6 text-sm text-slate-600">Please login to join the call.</div>;
  }

  const primaryRemoteStreamId = remoteTiles[0]?.streamId || "";
  const totalTiles = remoteTiles.length + 1;
  const localHasVideo = mode === "video" && isCameraEnabled;
  const primaryRemoteHasVideo = primaryRemoteStreamId ? remoteVideoState[primaryRemoteStreamId] !== false : false;
  const localAvatarLabel = String(user?.username || user?.email || userId || "Me");
  const remoteAvatarLabel = primaryRemoteStreamId
    ? String(primaryRemoteStreamId.split("-")[1] || "User")
    : "User";
  const durationSec = callStartedAt ? Math.max(0, Math.floor((callNow - callStartedAt) / 1000)) : 0;
  const mm = String(Math.floor(durationSec / 60)).padStart(2, "0");
  const ss = String(durationSec % 60).padStart(2, "0");

  const controlBtn =
    "relative flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/10 backdrop-blur " +
    "transition duration-150 ease-out will-change-transform " +
    "hover:bg-white/15 hover:-translate-y-[1px] hover:shadow-[0_10px_30px_-16px_rgba(255,255,255,0.25)] " +
    "active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black";

  return (
    <div
      className={cn(
        "relative flex min-h-[calc(100vh-56px)] w-full flex-col overflow-hidden rounded-[1.75rem] bg-black shadow-2xl shadow-black/35",
        "p-4 sm:p-5"
      )}
    >
      {mode === "video" ? (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="relative mx-auto w-full max-w-[1160px] flex-1">
            {videoLayout === "whatsapp" ? (
              <div className="relative h-full w-full overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-white/10 shadow-[0_24px_80px_-60px_rgba(0,0,0,0.9)]">
                {primaryRemoteStreamId ? (
                  <>
                    <div id={`dlite-zego-remote-${primaryRemoteStreamId}`} className="absolute inset-0" />
                    {/* When remote camera is off (or voice call), show avatar overlay */}
                    {mode !== "video" || !primaryRemoteHasVideo ? (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <AvatarBadge label={remoteAvatarLabel} />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
                    {status === "connected" ? "Connected" : statusLabel}
                  </div>
                )}

                <div className="absolute bottom-4 right-4 h-[140px] w-[210px] overflow-hidden rounded-xl bg-black/50 ring-1 ring-white/15 shadow-lg sm:h-[160px] sm:w-[240px]">
                  <div id="dlite-zego-local" ref={localRef} className={cn("absolute inset-0", !localHasVideo && "opacity-0")} />
                  {/* When my camera is off (or voice call), show my avatar in the tile */}
                  {mode !== "video" || !localHasVideo ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      {user?.photoURL ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={String(user.photoURL)}
                          alt="Me"
                          className="h-20 w-20 rounded-full object-cover ring-1 ring-white/10"
                        />
                      ) : (
                        <AvatarBadge label={localAvatarLabel} />
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Keep extra remote mounts present (hidden) so playback can attach if needed */}
                {remoteTiles.slice(1).map(({ streamId }) => (
                  <div key={streamId} className="hidden">
                    <div id={`dlite-zego-remote-${streamId}`} />
                  </div>
                ))}
              </div>
            ) : (
              <div
                className={cn(
                  "grid h-full w-full gap-4",
                  totalTiles <= 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-[repeat(auto-fit,minmax(260px,1fr))]"
                )}
              >
                <div className="relative overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-white/10 shadow-[0_24px_80px_-60px_rgba(0,0,0,0.9)]">
                  <div id="dlite-zego-local" ref={localRef} className={cn("absolute inset-0", !localHasVideo && "opacity-0")} />
                  {mode !== "video" || !localHasVideo ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      {user?.photoURL ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={String(user.photoURL)}
                          alt="Me"
                          className="h-24 w-24 rounded-full object-cover ring-1 ring-white/10"
                        />
                      ) : (
                        <AvatarBadge label={localAvatarLabel} />
                      )}
                    </div>
                  ) : null}
                </div>

                {remoteTiles.map(({ streamId }) => (
                  <div
                    key={streamId}
                    className="relative overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-white/10 shadow-[0_24px_80px_-60px_rgba(0,0,0,0.9)]"
                  >
                    <div id={`dlite-zego-remote-${streamId}`} className="absolute inset-0" />
                    {mode !== "video" || remoteVideoState[streamId] === false ? (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <AvatarBadge label={String(streamId.split("-")[1] || "User")} />
                      </div>
                    ) : null}
                  </div>
                ))}

                {!primaryRemoteStreamId ? (
                  <div className="relative overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-white/10 shadow-[0_24px_80px_-60px_rgba(0,0,0,0.9)]">
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
                      {status === "connected" ? "Connected" : statusLabel}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-center">
            <div className="flex items-center gap-2 rounded-full bg-[#2b2b2b]/80 px-3 py-2 ring-1 ring-white/10 backdrop-blur">
              <button
                type="button"
                className={controlBtn}
                aria-label="Call"
                title="Call"
              >
                <Phone className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={toggleMic}
                className={controlBtn}
                aria-label={isMicEnabled ? "Mute" : "Unmute"}
                title={isMicEnabled ? "Microphone" : "Microphone off"}
              >
                {isMicEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </button>

              {mode === "video" ? (
                <button
                  type="button"
                  onClick={toggleCamera}
                  className={controlBtn}
                  aria-label={isCameraEnabled ? "Camera off" : "Camera on"}
                  title={isCameraEnabled ? "Camera" : "Camera off"}
                >
                  {isCameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </button>
              ) : null}

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
                {mode === "video" ? <Monitor className="h-5 w-5" /> : <MonitorOff className="h-5 w-5" />}
              </button>

              <button
                type="button"
                disabled
                className={cn(
                  controlBtn,
                  "text-white/70 disabled:cursor-not-allowed disabled:opacity-70 hover:-translate-y-0 hover:shadow-none"
                )}
                aria-label="Participants"
                title={`Participants: ${remoteTiles.length + 1}`}
              >
                <Users className="h-5 w-5" />
              </button>

              <Link
                href="/call"
                className="flex h-11 w-[52px] items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/25 ring-1 ring-red-400/30 transition duration-150 ease-out hover:-translate-y-[1px] hover:bg-red-600 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                aria-label="Leave"
                title="Leave"
                onClick={(e) => {
                  e.preventDefault();
                  handleLeave();
                }}
              >
                <PhoneOff className="h-5 w-5" />
              </Link>
            </div>
          </div>

          {error ? (
            <p className="mx-auto mt-4 w-full max-w-[1160px] rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </p>
          ) : null}

          {needsUserGesture ? (
            <div className="mx-auto mt-3 flex w-full max-w-[1160px] items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-xs text-white/70">Browser blocked audio autoplay. Click to enable audio.</p>
              <button
                type="button"
                className="rounded-full bg-gradient-to-r from-ui-grad-from to-ui-grad-to px-3 py-1 text-[11px] font-semibold text-white shadow-sm hover:brightness-110"
                onClick={async () => {
                  try {
                    await (engineRef.current as unknown as { resumeAudioContext?: () => Promise<boolean> | boolean })?.resumeAudioContext?.();
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
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="relative mx-auto flex w-full max-w-[1160px] flex-1 flex-col justify-center">
            <div className="absolute inset-0 overflow-hidden rounded-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/15 via-black to-black" />
              <div className="absolute -left-24 -top-24 h-[360px] w-[360px] rounded-full bg-orange-500/25 blur-[80px]" />
              <div className="absolute -bottom-28 -right-24 h-[420px] w-[420px] rounded-full bg-pink-500/15 blur-[90px]" />
              <div className="absolute inset-0 bg-black/35" />
            </div>

            <div className="relative z-10 mx-auto flex w-full max-w-[760px] flex-col items-center px-4 py-10 text-center text-white">
              <div className="flex w-full items-center justify-between">
                <div className="rounded-full bg-black/35 px-3 py-1 text-xs font-semibold text-white/90 ring-1 ring-white/10 backdrop-blur">
                  {mm}:{ss}
                </div>

                <div className="rounded-full bg-black/35 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-white/10 backdrop-blur">
                  {status === "connected" ? "Excellent" : statusLabel}
                </div>
              </div>

              <div className="mt-14">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-orange-500/20 blur-[28px]" />
                  <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-white/10 ring-1 ring-white/15">
                    <span className="text-5xl font-extrabold">{getInitials(remoteAvatarLabel)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 text-2xl font-semibold tracking-tight">{remoteAvatarLabel}</div>
              <div className="mt-1 flex items-center justify-center gap-2 text-sm text-white/70">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {status === "connected" ? "Connected · HD audio" : statusLabel}
              </div>

              <div className="mt-7">
                <AudioWaveform active={status === "connected"} />
              </div>

              <div className="mt-10 flex items-center justify-center">
                <div className="flex items-center gap-2 rounded-full bg-[#2b2b2b]/80 px-3 py-2 ring-1 ring-white/10 backdrop-blur">
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
                    disabled
                    className={cn(
                      controlBtn,
                      "text-white/70 disabled:cursor-not-allowed disabled:opacity-70 hover:-translate-y-0 hover:shadow-none"
                    )}
                    aria-label="Reactions"
                    title="Reactions"
                  >
                    <span className="text-base">♥</span>
                  </button>

                  <button
                    type="button"
                    disabled
                    className={cn(
                      controlBtn,
                      "text-white/70 disabled:cursor-not-allowed disabled:opacity-70 hover:-translate-y-0 hover:shadow-none"
                    )}
                    aria-label="More"
                    title="More"
                  >
                    <span className="text-base">…</span>
                  </button>

                  <Link
                    href="/call"
                    className="flex h-11 w-[52px] items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/25 ring-1 ring-red-400/30 transition duration-150 ease-out hover:-translate-y-[1px] hover:bg-red-600 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    aria-label="Leave"
                    title="Leave"
                    onClick={(e) => {
                      e.preventDefault();
                      handleLeave();
                    }}
                  >
                    <PhoneOff className="h-5 w-5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status UI like screenshot (top center + top right). No IDs shown. */}
      <div className="pointer-events-none absolute left-0 right-0 top-3 flex items-center justify-center px-4">
        <div className="pointer-events-auto rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[11px] font-semibold text-white/70 backdrop-blur">
          {statusLabel}
        </div>
      </div>
      <div className="pointer-events-none absolute right-4 top-3 hidden md:block">
        <div className="pointer-events-auto rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[11px] font-semibold backdrop-blur">
          <span className={cn("text-white/70", statusTone)}>Status:</span>{" "}
          <span className="text-white/75">{statusLabel}</span>
        </div>
      </div>

      <div className="pointer-events-none absolute right-4 top-4 hidden md:block">
        <div className="pointer-events-auto rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] font-semibold text-white/70 backdrop-blur">
          Status: <span className={cn("font-semibold", statusTone)}>{statusLabel}</span>
          {isAdmin ? <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/75">Admin</span> : null}
        </div>
      </div>

      {endedOverlayVisible ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="rounded-2xl border border-white/10 bg-black/50 px-5 py-4 text-center text-white shadow-xl">
            <p className="text-sm font-semibold">Call ended</p>
            <p className="mt-1 text-xs text-white/70">Returning to calls…</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
