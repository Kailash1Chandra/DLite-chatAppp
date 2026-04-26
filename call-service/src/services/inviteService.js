const INVITE_TIMEOUT_MS = parseInt(process.env.INVITE_TIMEOUT_MS || "30000", 10)

// Map<`${roomID}:${calleeID}`, { roomID, calleeID, callerID, type, invitedAt, timeoutHandle }>
const invites = new Map()

function key(roomID, calleeID) {
  return `${String(roomID || "").trim()}:${String(calleeID || "").trim()}`
}

function create({ roomID, calleeID, callerID, type, onTimeout }) {
  const rid = String(roomID || "").trim()
  const cid = String(calleeID || "").trim()
  if (!rid || !cid) return { expiresAt: Date.now() + INVITE_TIMEOUT_MS }

  cancel(rid, cid)

  const invitedAt = Date.now()
  const expiresAt = invitedAt + INVITE_TIMEOUT_MS
  const timeoutHandle = setTimeout(() => {
    try {
      invites.delete(key(rid, cid))
    } catch {
      // ignore
    }
    if (typeof onTimeout === "function") {
      try {
        onTimeout({ roomID: rid, calleeID: cid, callerID: String(callerID || "").trim(), type })
      } catch {
        // ignore
      }
    }
  }, INVITE_TIMEOUT_MS)

  invites.set(key(rid, cid), { roomID: rid, calleeID: cid, callerID: String(callerID || "").trim(), type, invitedAt, timeoutHandle })
  return { expiresAt }
}

function cancel(roomID, calleeID) {
  const rid = String(roomID || "").trim()
  const cid = String(calleeID || "").trim()
  const rec = invites.get(key(rid, cid))
  if (!rec) return false
  try {
    clearTimeout(rec.timeoutHandle)
  } catch {
    // ignore
  }
  invites.delete(key(rid, cid))
  return true
}

function cancelAllForRoom(roomID) {
  const rid = String(roomID || "").trim()
  if (!rid) return 0
  let n = 0
  for (const k of invites.keys()) {
    if (!k.startsWith(`${rid}:`)) continue
    const rec = invites.get(k)
    if (rec && rec.timeoutHandle) {
      try {
        clearTimeout(rec.timeoutHandle)
      } catch {
        // ignore
      }
    }
    invites.delete(k)
    n += 1
  }
  return n
}

module.exports = { INVITE_TIMEOUT_MS, invites, create, cancel, cancelAllForRoom }

