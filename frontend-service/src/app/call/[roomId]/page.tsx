"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ZegoExpressEngine } from "zego-express-engine-webrtc";
import { Columns2, Mic, MicOff, Monitor, MonitorOff, Phone, PhoneOff, Users, Video, VideoOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { buildHostedCallUrl, getInviteCodeFromRoomId } from "@/lib/callRoom";
import { cn } from "@/lib/utils";
import { endCall, listenForCallEnded } from "@/lib/call";

type RemoteTile = { streamId: string };

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
  const [videoLayout, setVideoLayout] = useState<"split" | "pip">("split");
  const [endedOverlayVisible, setEndedOverlayVisible] = useState(false);

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
    try {
      nextStream.playVideo?.(document.getElementById("dlite-zego-local"));
    } catch {
      /* ignore */
    }
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
      // Better view: auto-switch to PiP when screen sharing starts.
      setVideoLayout("pip");

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

      try {
        screenStream.playVideo?.(document.getElementById("dlite-zego-local"));
      } catch {
        /* ignore */
      }

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

    const cleanup = async () => {
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
          zg.logoutRoom(roomId);
        }
      } catch {
        /* ignore */
      }

      try {
        if (zg) {
          zg.destroyEngine();
        }
      } catch {
        /* ignore */
      }
    };

    const run = async () => {
      try {
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
        const zg = new ZegoExpressEngine(appId, server);
        engineRef.current = zg;

        // Avoid remote logger websocket being a hard failure in some networks/adblock setups.
        try {
          (zg as any).setLogConfig?.({ logLevel: "error", remoteLogLevel: "disable" });
        } catch {
          /* ignore */
        }

        try {
          const resumed = await (zg as unknown as { resumeAudioContext?: () => Promise<boolean> | boolean }).resumeAudioContext?.();
          if (resumed === false) setNeedsUserGesture(true);
        } catch {
          /* ignore */
        }

        const upsertRemoteTile = (streamId: string, remoteStream: any) => {
          remoteStreamsRef.current[streamId] = remoteStream;
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

        try {
          localStream.playVideo?.(document.getElementById("dlite-zego-local"));
        } catch {
          /* ignore */
        }

        const streamId = `${roomId}-${userId}-${Date.now()}`;
        publishedStreamIdRef.current = streamId;
        if (!streamId.trim()) throw new Error("Invalid stream id");
        await zg.startPublishingStream(streamId, localStream);

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

  useEffect(() => {
    if (!engineRef.current) return;
    const zg = engineRef.current;
    remoteTiles.forEach(({ streamId }) => {
      const remoteStream = remoteStreamsRef.current[streamId];
      const mountId = `dlite-zego-remote-${streamId}`;
      const mountNode = document.getElementById(mountId);
      if (!remoteStream || !mountNode || mountNode.childElementCount > 0) return;
      try {
        const remoteView = zg.createRemoteStreamView(remoteStream);
        remoteView.play(mountId);
      } catch {
        /* ignore */
      }
    });
  }, [remoteTiles]);

  useEffect(() => {
    if (!copiedState) return;
    const t = window.setTimeout(() => setCopiedState(""), 1800);
    return () => window.clearTimeout(t);
  }, [copiedState]);

  if (!roomId) {
    return <div className="p-6 text-sm text-slate-600">Missing roomId.</div>;
  }
  if (!userId) {
    return <div className="p-6 text-sm text-slate-600">Please login to join the call.</div>;
  }

  const primaryRemoteStreamId = remoteTiles[0]?.streamId || "";

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
            {videoLayout === "split" ? (
              <div className="grid h-full w-full grid-cols-1 gap-4 md:grid-cols-2">
                <div className="relative overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-white/10 shadow-[0_24px_80px_-60px_rgba(0,0,0,0.9)]">
                  <div id="dlite-zego-local" ref={localRef} className="absolute inset-0" />
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-white/10 shadow-[0_24px_80px_-60px_rgba(0,0,0,0.9)]">
                  {primaryRemoteStreamId ? (
                    <div id={`dlite-zego-remote-${primaryRemoteStreamId}`} className="absolute inset-0" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-white/70">
                      {status === "connected" ? "Connected" : statusLabel}
                    </div>
                  )}

                  {/* Keep extra remote mounts present (hidden) so playback can attach if needed */}
                  {remoteTiles.slice(1).map(({ streamId }) => (
                    <div key={streamId} className="hidden">
                      <div id={`dlite-zego-remote-${streamId}`} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="relative h-full w-full overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-white/10 shadow-[0_24px_80px_-60px_rgba(0,0,0,0.9)]">
                {primaryRemoteStreamId ? (
                  <div id={`dlite-zego-remote-${primaryRemoteStreamId}`} className="absolute inset-0" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
                    {status === "connected" ? "Connected" : statusLabel}
                  </div>
                )}

                <div className="absolute bottom-4 right-4 h-[140px] w-[210px] overflow-hidden rounded-xl bg-black/50 ring-1 ring-white/15 shadow-lg sm:h-[160px] sm:w-[240px]">
                  <div id="dlite-zego-local" ref={localRef} className="absolute inset-0" />
                </div>

                {/* Keep extra remote mounts present (hidden) so playback can attach if needed */}
                {remoteTiles.slice(1).map(({ streamId }) => (
                  <div key={streamId} className="hidden">
                    <div id={`dlite-zego-remote-${streamId}`} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-center">
            <div className="flex items-center gap-2 rounded-full bg-[#2b2b2b]/80 px-3 py-2 ring-1 ring-white/10 backdrop-blur">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Call"
                title="Call"
              >
                <Phone className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={toggleMic}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                aria-label={isMicEnabled ? "Mute" : "Unmute"}
                title={isMicEnabled ? "Microphone" : "Microphone off"}
              >
                {isMicEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </button>

              {mode === "video" ? (
                <button
                  type="button"
                  onClick={toggleCamera}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
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
                  "flex h-10 w-10 items-center justify-center rounded-full text-white transition",
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
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/70 transition disabled:cursor-not-allowed disabled:opacity-70"
                aria-label="Participants"
                title={`Participants: ${remoteTiles.length + 1}`}
              >
                <Users className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => setVideoLayout((v) => (v === "split" ? "pip" : "split"))}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Change layout"
                title="Change layout"
              >
                <Columns2 className="h-5 w-5" />
              </button>

              <Link
                href="/call"
                className="flex h-10 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/20 transition hover:bg-red-600"
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
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mx-auto w-full max-w-[980px] rounded-2xl border border-ui-border bg-ui-panel p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Call room</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Mode: <span className="font-semibold">Audio</span>
                </p>
              </div>
              <Link
                href="/call"
                className="anim-shimmer relative inline-flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-r from-fuchsia-600 via-violet-600 to-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-fuchsia-500/15 ring-1 ring-white/15 transition hover:-translate-y-0.5 hover:brightness-110"
              >
                Leave
              </Link>
            </div>
          </div>
        </div>
      )}

      {inviteCode ? (
        <div className="pointer-events-none absolute left-4 top-4 hidden md:block">
          <div className="pointer-events-auto rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70 backdrop-blur">
            Invite code: <span className="font-mono font-bold tracking-[0.26em] text-white/90">{inviteCode}</span>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute right-4 top-4 hidden md:block">
        <div className="pointer-events-auto rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] font-semibold text-white/70 backdrop-blur">
          Status: <span className={cn("font-semibold", statusTone)}>{statusLabel}</span>
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
