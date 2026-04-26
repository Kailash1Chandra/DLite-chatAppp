"use client"

let singleton: AudioContext | null = null

export function getAudioContext() {
  if (typeof window === "undefined") return null
  if (singleton) return singleton
  const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined
  if (!Ctx) return null
  singleton = new Ctx()
  return singleton
}

export async function resumeAudioContext() {
  const ac = getAudioContext()
  if (!ac) return false
  try {
    if (ac.state === "suspended") await ac.resume()
    return ac.state !== "suspended"
  } catch {
    return false
  }
}

