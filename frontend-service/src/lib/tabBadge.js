let originalTitle = null
let flashTimer = null
let unread = 0
let originalFaviconHref = null

function setTitle(t) {
  if (typeof document === 'undefined') return
  document.title = t
}

function getFaviconEl() {
  if (typeof document === 'undefined') return null
  return document.querySelector('link[rel="icon"]') || document.querySelector('link[rel="shortcut icon"]')
}

async function loadImage(src) {
  return await new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function setFaviconBadge(count) {
  if (typeof document === 'undefined') return
  const n = Math.max(0, Number(count || 0))
  const link = getFaviconEl()
  if (!link) return
  if (!originalFaviconHref) originalFaviconHref = link.href
  if (!n) {
    link.href = originalFaviconHref || '/favicon.ico'
    return
  }

  try {
    const img = await loadImage(originalFaviconHref || '/favicon.ico')
    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, 0, 0, size, size)
    ctx.fillStyle = '#EF4444'
    ctx.beginPath()
    ctx.arc(size - 16, 16, 14, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 20px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const text = n > 99 ? '99+' : String(n)
    ctx.fillText(text, size - 16, 16)
    link.href = canvas.toDataURL('image/png')
  } catch {
    // ignore
  }
}

function setUnreadCount(n) {
  unread = Math.max(0, Number(n || 0))
  if (typeof document === 'undefined') return
  if (!originalTitle) originalTitle = document.title || 'D-Lite'
  setTitle(unread > 0 ? `(${unread}) D-Lite` : 'D-Lite')
  setFaviconBadge(unread)
}

function flashTitle(message, durationMs = 6000) {
  if (typeof document === 'undefined') return
  if (!document.hidden) return
  if (!originalTitle) originalTitle = document.title || 'D-Lite'
  const msg = String(message || '💬 New message!')
  const endAt = Date.now() + Math.max(1000, Number(durationMs || 0))
  let on = false
  if (flashTimer) clearInterval(flashTimer)
  flashTimer = setInterval(() => {
    if (Date.now() >= endAt || !document.hidden) {
      clearInterval(flashTimer)
      flashTimer = null
      setTitle(unread > 0 ? `(${unread}) D-Lite` : 'D-Lite')
      return
    }
    on = !on
    setTitle(on ? msg : (unread > 0 ? `(${unread}) D-Lite` : 'D-Lite'))
  }, 1000)
}

function clear() {
  unread = 0
  if (flashTimer) clearInterval(flashTimer)
  flashTimer = null
  if (typeof document !== 'undefined') setTitle('D-Lite')
  setFaviconBadge(0)
}

export const tabBadge = { setUnreadCount, flashTitle, setFaviconBadge, clear }

