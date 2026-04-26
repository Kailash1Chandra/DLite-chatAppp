"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { getAudioContext } from "@/lib/audioContext"
import { cn } from "@/lib/utils"

type Props = {
  stream: MediaStream | null
  color?: "orange" | "emerald" | "rose"
  size?: "sm" | "md" | "lg"
}

function barsCount(size: Props["size"]) {
  if (size === "sm") return 22
  if (size === "lg") return 36
  return 32
}

function heightScale(size: Props["size"]) {
  if (size === "sm") return 18
  if (size === "lg") return 34
  return 26
}

function palette(color: Props["color"]) {
  if (color === "emerald") return { quiet: "bg-emerald-300/60", loud: "bg-emerald-500" }
  if (color === "rose") return { quiet: "bg-rose-300/60", loud: "bg-rose-500" }
  return { quiet: "bg-orange-300/60", loud: "bg-orange-500" }
}

export function LiveWaveform({ stream, color = "orange", size = "md" }: Props) {
  const count = barsCount(size)
  const scale = heightScale(size)
  const { quiet, loud } = palette(color)

  const [values, setValues] = useState<number[]>(() => Array.from({ length: count }, () => 0.2))
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const peaksRef = useRef<number[]>(Array.from({ length: count }, () => 0.2))
  const t0Ref = useRef<number>(Date.now())

  const trackKey = useMemo(() => {
    const t = stream?.getAudioTracks?.()?.[0]
    return t ? `${t.id}:${t.enabled ? "1" : "0"}:${t.muted ? "1" : "0"}` : ""
  }, [stream])

  useEffect(() => {
    const ac = getAudioContext()
    if (!ac || !stream) {
      setValues(Array.from({ length: count }, () => 0.2))
      return
    }

    let cancelled = false
    t0Ref.current = Date.now()

    try {
      const analyser = ac.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      analyserRef.current = analyser
      const source = ac.createMediaStreamSource(stream)
      sourceRef.current = source
      source.connect(analyser)

      const data = new Uint8Array(analyser.frequencyBinCount)

      const loop = () => {
        if (cancelled) return
        const t = (Date.now() - t0Ref.current) / 1000
        let next: number[] = []
        try {
          analyser.getByteFrequencyData(data)
          for (let i = 0; i < count; i++) {
            const idx = Math.floor((i / count) * data.length)
            const v = (data[idx] || 0) / 255
            const smooth = (values[i] || 0) * 0.65 + v * 0.35
            const peakPrev = peaksRef.current[i] || 0
            const peak = smooth > peakPrev ? smooth : peakPrev * 0.92
            peaksRef.current[i] = peak
            next.push(Math.max(0.08, Math.min(1, smooth * 0.9 + peak * 0.1)))
          }
        } catch {
          // Idle breathing pattern when silent/no analyser
          next = Array.from({ length: count }, (_v, i) => {
            const s = 0.22 + 0.08 * Math.sin(t * 2 + i * 0.18)
            return s
          })
        }
        setValues(next)
        rafRef.current = window.requestAnimationFrame(loop)
      }

      rafRef.current = window.requestAnimationFrame(loop)
    } catch {
      // ignore
    }

    return () => {
      cancelled = true
      try {
        if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
      } catch {
        // ignore
      }
      rafRef.current = null
      try {
        sourceRef.current?.disconnect()
      } catch {
        // ignore
      }
      try {
        analyserRef.current?.disconnect()
      } catch {
        // ignore
      }
      sourceRef.current = null
      analyserRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey, count])

  return (
    <div
      className={cn(
        "flex items-end justify-center gap-[3px]",
        size === "sm" ? "h-6" : size === "lg" ? "h-12" : "h-9"
      )}
      aria-hidden="true"
    >
      {values.map((v, i) => {
        const intensity = v
        const cls = intensity > 0.55 ? loud : quiet
        return (
          <div
            key={i}
            className={cn("w-1 rounded-full will-change-transform", cls)}
            style={{
              transform: `scaleY(${Math.max(0.12, intensity)})`,
              height: `${scale}px`,
              transformOrigin: "bottom",
              transition: "transform 80ms linear",
            }}
          />
        )
      })}
    </div>
  )
}

