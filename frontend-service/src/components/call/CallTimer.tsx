"use client"

import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"

type Props = {
  startedAt: number
  status: "connecting" | "connected" | "reconnecting"
  className?: string
}

function fmt(secs: number) {
  const s = Math.max(0, Math.floor(secs))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const two = (n: number) => String(n).padStart(2, "0")
  if (hh > 0) return `${two(hh)}:${two(mm)}:${two(ss)}`
  return `${two(mm)}:${two(ss)}`
}

export function CallTimer({ startedAt, status, className }: Props) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (status !== "connected") return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [status])

  const text = useMemo(() => {
    if (status === "reconnecting") return "Reconnecting…"
    if (status === "connecting") return "Connecting…"
    return fmt((now - startedAt) / 1000)
  }, [now, startedAt, status])

  return (
    <div className={cn("inline-flex items-center gap-2 text-sm text-white/80", className)}>
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          status === "connected" ? "bg-emerald-400 call-live-dot" : status === "reconnecting" ? "bg-amber-400" : "bg-white/30"
        )}
        aria-hidden="true"
      />
      <span className="tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
        {text}
      </span>
    </div>
  )
}

