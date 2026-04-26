const active = new Map()

function isSupported() {
  return typeof window !== 'undefined' && typeof window.Notification !== 'undefined'
}

function getPermission() {
  if (!isSupported()) return 'denied'
  return window.Notification.permission
}

async function requestPermission() {
  if (!isSupported()) return 'denied'
  try {
    return await window.Notification.requestPermission()
  } catch {
    return getPermission()
  }
}

function safeClose(n) {
  try {
    n.close()
  } catch {
    // ignore
  }
}

function show({ title, body, icon, tag, onClick, requireInteraction, silent }) {
  if (!isSupported()) return null
  if (getPermission() !== 'granted') return null
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return null

  const t = String(tag || '').trim()
  if (t) {
    const prev = active.get(t)
    if (prev) safeClose(prev)
  }

  const n = new window.Notification(String(title || 'D-Lite'), {
    body: String(body || ''),
    icon: String(icon || '/favicon.ico'),
    tag: t || undefined,
    requireInteraction: !!requireInteraction,
    silent: !!silent,
  })

  if (t) active.set(t, n)

  const closeAfter = requireInteraction ? 0 : 8000
  if (closeAfter) {
    window.setTimeout(() => {
      safeClose(n)
      if (t && active.get(t) === n) active.delete(t)
    }, closeAfter)
  }

  n.onclick = () => {
    try {
      window.focus()
    } catch {
      // ignore
    }
    try {
      if (typeof onClick === 'function') onClick()
    } catch {
      // ignore
    }
    safeClose(n)
    if (t && active.get(t) === n) active.delete(t)
  }

  n.onclose = () => {
    if (t && active.get(t) === n) active.delete(t)
  }

  return n
}

function showCallNotification({ callerName, callerAvatar, type, onAccept, onReject }) {
  const name = String(callerName || 'Incoming call')
  const kind = String(type || 'audio') === 'video' ? 'Video call' : 'Voice call'
  return show({
    title: `Incoming ${kind}`,
    body: name,
    icon: String(callerAvatar || '/favicon.ico'),
    tag: 'incoming_call',
    requireInteraction: true,
    silent: false,
    onClick: () => {
      // Browser Notification actions are not reliably supported cross-browser.
      // Click focuses the tab; in-app overlay handles accept/reject.
      if (typeof onAccept === 'function') onAccept()
      if (typeof onReject === 'function') void onReject
    },
  })
}

function close(tag) {
  const t = String(tag || '').trim()
  if (!t) return
  const n = active.get(t)
  if (n) safeClose(n)
  active.delete(t)
}

function closeAll() {
  for (const n of active.values()) safeClose(n)
  active.clear()
}

export const browserNotifications = {
  isSupported,
  getPermission,
  requestPermission,
  show,
  showCallNotification,
  close,
  closeAll,
}

