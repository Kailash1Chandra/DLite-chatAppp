"use client"

let singleton: AudioContext | null = null
let gestureReady = false
let listenersAttached = false

function attachGestureListenersOnce() {
  if (typeof window === "undefined") return
  if (listenersAttached) return
  listenersAttached = true

  const mark = () => {
    gestureReady = true
    window.removeEventListener("pointerdown", mark, true)
    window.removeEventListener("keydown", mark, true)
    window.removeEventListener("touchstart", mark, true)
  }

  window.addEventListener("pointerdown", mark, true)
  window.addEventListener("keydown", mark, true)
  window.addEventListener("touchstart", mark, true)
}

export function isAudioGestureReady() {
  attachGestureListenersOnce()
  return gestureReady
}

export function getAudioContext(opts?: { createIfNeeded?: boolean }) {
  if (typeof window === "undefined") return null
  attachGestureListenersOnce()
  if (singleton) return singleton
  const createIfNeeded = !!opts?.createIfNeeded
  if (!createIfNeeded) return null
  if (!gestureReady) return null
  const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined
  if (!Ctx) return null
  try {
    singleton = new Ctx()
    return singleton
  } catch {
    singleton = null
    return null
  }
}

export async function resumeAudioContext() {
  // Must only be called from a user gesture handler (click/tap/keydown).
  gestureReady = true
  const ac = getAudioContext({ createIfNeeded: true })
  if (!ac) return false
  try {
    if (ac.state === "suspended") await ac.resume()
    return ac.state !== "suspended"
  } catch {
    return false
  }
}

