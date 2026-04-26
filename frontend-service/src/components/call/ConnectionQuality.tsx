"use client"

import { useEffect, useMemo, useState } from "react"
import { subscribeQuality, type CallQualitySnapshot } from "@/lib/callQuality"
import { cn } from "@/lib/utils"

type Props = {
  peerConnection: RTCPeerConnection | null
  className?: string
}

function tone(q: CallQualitySnapshot["quality"]) {
  if (q === "excellent") return "text-emerald-300"
  if (q === "good") return "text-amber-300"
  if (q === "fair") return "text-orange-300"
  return "text-rose-300"
}

function label(q: CallQualitySnapshot["quality"]) {
  if (q === "excellent") return "Excellent"
  if (q === "good") return "Good"
  if (q === "fair") return "Fair"
  return "Poor"
}

function bars(q: CallQualitySnapshot["quality"]) {
  if (q === "excellent") return 3
  if (q === "good") return 2
  if (q === "fair") return 1
  return 0
}

export function ConnectionQuality({ peerConnection, className }: Props) {
  const [snap, setSnap] = useState<CallQualitySnapshot>({
    quality: "poor",
    rtt: 0,
    packetLoss: 0,
    fps: 0,
    bitrate: 0,
  })

  useEffect(() => {
    return subscribeQuality(peerConnection, setSnap, 2000)
  }, [peerConnection])

  const active = useMemo(() => bars(snap.quality), [snap.quality])

  return (
    <div
      className={cn(
        "pointer-events-none inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[11px] font-semibold text-white/80 backdrop-blur",
        className
      )}
      aria-label={`Connection quality: ${label(snap.quality)}`}
    >
      <span className={cn("inline-flex items-end gap-0.5", tone(snap.quality))} aria-hidden="true">
        <span className={cn("h-2 w-1 rounded-sm bg-current/60", active >= 1 && "bg-current")} />
        <span className={cn("h-3 w-1 rounded-sm bg-current/60", active >= 2 && "bg-current")} />
        <span className={cn("h-4 w-1 rounded-sm bg-current/60", active >= 3 && "bg-current")} />
      </span>
      <span className="text-white/75">{label(snap.quality)}</span>
    </div>
  )
}

