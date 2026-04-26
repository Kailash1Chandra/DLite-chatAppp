"use client"

import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

type Props = {
  isActive: boolean
  intensity: number
  children: ReactNode
  className?: string
}

export function ActiveSpeakerRing({ isActive, intensity, children, className }: Props) {
  const t = Math.max(0, Math.min(1, Number(intensity || 0)))
  const px = 4 + t * 4
  const blur = 18 + t * 18
  const alpha = isActive ? 0.24 + t * 0.28 : 0
  const glow = `0 0 0 ${px}px rgba(249, 115, 22, ${alpha}), 0 0 ${blur}px rgba(249, 115, 22, ${alpha * 0.9})`
  return (
    <div className={cn("relative", className)} style={{ boxShadow: isActive ? glow : "none", borderRadius: "inherit" }}>
      {children}
    </div>
  )
}

