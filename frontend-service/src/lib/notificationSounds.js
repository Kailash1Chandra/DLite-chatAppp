const SOUND_FILES = {
  'incoming-call': '/sounds/incoming-call.mp3',
  'outgoing-call': '/sounds/outgoing-call.mp3',
  'message-received': '/sounds/message-received.mp3',
  'message-sent': '/sounds/message-sent.mp3',
  'call-ended': '/sounds/call-ended.mp3',
  notification: '/sounds/notification.mp3',
}

const players = new Map()
let muted = false
let vibrateTimer = null

function loadMuted() {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('d_lite_sounds_muted') === '1'
  } catch {
    return false
  }
}

function saveMuted(v) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem('d_lite_sounds_muted', v ? '1' : '0')
  } catch {
    // ignore
  }
}

function ensureAudio(id) {
  if (players.has(id)) return players.get(id)
  const url = SOUND_FILES[id]
  const audio = typeof Audio !== 'undefined' ? new Audio(url) : null
  const rec = { id, url, audio, beeper: null }
  players.set(id, rec)
  return rec
}

function createBeeper() {
  let intervalId = null
  let ac = null
  function beep() {
    try {
      if (!ac) ac = new AudioContext()
      if (ac.state === 'suspended') return
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'sine'
      osc.frequency.value = 840
      gain.gain.value = 0.08
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start()
      osc.stop(ac.currentTime + 0.18)
    } catch {
      // ignore
    }
  }
  return {
    start() {
      if (intervalId) return
      beep()
      intervalId = setInterval(beep, 1200)
    },
    stop() {
      if (intervalId) clearInterval(intervalId)
      intervalId = null
    },
    async resumeAfterGesture() {
      try {
        if (!ac) ac = new AudioContext()
        if (ac.state === 'suspended') await ac.resume()
        return true
      } catch {
        return false
      }
    },
  }
}

async function play(id, opts = {}) {
  if (typeof window === 'undefined') return
  if (muted) return

  const rec = ensureAudio(id)
  const volume = Math.max(0, Math.min(1, Number(opts.volume ?? 1)))
  const loop = !!opts.loop

  // If file missing or Audio fails, fallback to beeper for ringtone-style ids.
  if (!rec.audio || !rec.url) {
    if (!rec.beeper) rec.beeper = createBeeper()
    rec.beeper.start()
    return
  }

  try {
    rec.audio.loop = loop
    rec.audio.volume = volume
    rec.audio.currentTime = 0
    await rec.audio.play()
  } catch {
    // fallback for autoplay/file issues
    if (!rec.beeper) rec.beeper = createBeeper()
    rec.beeper.start()
  }
}

function stop(id) {
  const rec = players.get(id)
  if (!rec) return
  try {
    if (rec.audio) {
      rec.audio.pause()
      rec.audio.currentTime = 0
      rec.audio.loop = false
    }
  } catch {
    // ignore
  }
  try {
    rec.beeper?.stop?.()
  } catch {
    // ignore
  }
}

function stopAll() {
  for (const id of players.keys()) stop(id)
  stopVibration()
}

async function preload() {
  if (typeof window === 'undefined') return
  muted = loadMuted()
  for (const id of Object.keys(SOUND_FILES)) {
    try {
      const rec = ensureAudio(id)
      if (rec.audio) rec.audio.preload = 'auto'
    } catch {
      // ignore
    }
  }
}

function setMuted(next) {
  muted = !!next
  saveMuted(muted)
  if (muted) stopAll()
}

function isMuted() {
  return !!muted
}

function vibrate(pattern) {
  if (typeof window === 'undefined') return false
  const can = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
  if (!can) return false
  try {
    return navigator.vibrate(pattern)
  } catch {
    return false
  }
}

function startVibrationLoop(pattern, intervalMs = 1400) {
  stopVibration()
  vibrate(pattern)
  vibrateTimer = setInterval(() => vibrate(pattern), intervalMs)
}

function stopVibration() {
  if (vibrateTimer) clearInterval(vibrateTimer)
  vibrateTimer = null
  try {
    vibrate(0)
  } catch {
    // ignore
  }
}

export const notificationSounds = {
  SOUND_FILES,
  preload,
  play,
  stop,
  stopAll,
  setMuted,
  isMuted,
  vibrate,
  startVibrationLoop,
  stopVibration,
}

