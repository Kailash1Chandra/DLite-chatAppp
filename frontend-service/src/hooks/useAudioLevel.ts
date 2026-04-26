"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { getAudioContext, isAudioGestureReady } from "@/lib/audioContext"

export function useAudioLevel(stream: MediaStream | null) {
  const [level, setLevel] = useState(0)
  const [isSpeaking, setIsSpeaking] = useState(false)

  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const speakingSinceRef = useRef<number | null>(null)
  const lastLevelRef = useRef(0)

  const trackKey = useMemo(() => {
    const t = stream?.getAudioTracks?.()?.[0]
    return t ? `${t.id}:${t.enabled ? "1" : "0"}:${t.muted ? "1" : "0"}` : ""
  }, [stream])

  useEffect(() => {
    // Creating/resuming AudioContext before a user gesture causes Chrome autoplay warnings.
    if (!isAudioGestureReady()) {
      setLevel(0)
      setIsSpeaking(false)
      return
    }

    const ac = getAudioContext({ createIfNeeded: true })
    if (!ac || !stream) {
      setLevel(0)
      setIsSpeaking(false)
      return
    }

    let cancelled = false

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
        try {
          analyser.getByteFrequencyData(data)
          let sum = 0
          for (let i = 0; i < data.length; i++) sum += data[i]
          const avg = sum / (data.length * 255)
          const smoothed = lastLevelRef.current * 0.7 + avg * 0.3
          lastLevelRef.current = smoothed
          setLevel(smoothed)

          const now = Date.now()
          const speaking = smoothed > 0.05
          if (speaking) {
            if (!speakingSinceRef.current) speakingSinceRef.current = now
            if (now - speakingSinceRef.current >= 200) setIsSpeaking(true)
          } else {
            speakingSinceRef.current = null
            setIsSpeaking(false)
          }
        } catch {
          // ignore
        }
        rafRef.current = window.requestAnimationFrame(loop)
      }

      rafRef.current = window.requestAnimationFrame(loop)
    } catch {
      // ignore
    }

    return () => {
      cancelled = true
      speakingSinceRef.current = null
      setIsSpeaking(false)
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
  }, [trackKey, stream])

  return { level, isSpeaking, analyser: analyserRef.current }
}

