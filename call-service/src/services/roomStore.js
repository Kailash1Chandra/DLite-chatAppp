// In-memory room store: Map<roomID, room>
// room = {
//   roomID, type, isGroup, createdBy, status,
//   users: Map<userID, { userID, displayName, avatar, joinedAt }>,
//   pendingInvitees: Map<userID, { invitedAt }>,
//   startedAt, endedAt, destroyAt, createdAt
// }
const rooms = new Map()

const DESTROY_GRACE_MS = 5000
const SWEEP_INTERVAL_MS = 10_000

function getRoom(roomID) {
  return rooms.get(roomID) || null
}

function createRoom(roomID, opts) {
  const o = opts || {}
  const room = {
    roomID,
    type: o.type || "audio",
    isGroup: Boolean(o.isGroup),
    createdBy: String(o.createdBy || "").trim(),
    status: o.status || "ringing",
    users: new Map(),
    pendingInvitees: new Map(),
    startedAt: null,
    endedAt: null,
    destroyAt: null,
    createdAt: Date.now(),
  }
  rooms.set(roomID, room)
  return room
}

function ensureRoom(roomID, opts) {
  const existing = getRoom(roomID)
  if (existing) return existing
  return createRoom(roomID, opts)
}

function scheduleDestroyIfEmpty(room) {
  if (!room) return
  if (room.users.size !== 0) return
  room.destroyAt = Date.now() + DESTROY_GRACE_MS
}

function clearDestroy(room) {
  if (!room) return
  room.destroyAt = null
}

function addUserToRoom(roomID, user) {
  const room = getRoom(roomID)
  if (!room) return null
  clearDestroy(room)
  const userID = String(user.userID || "").trim()
  if (!userID) return room
  room.users.set(userID, {
    userID,
    displayName: String(user.displayName || user.username || "User").trim() || "User",
    avatar: user.avatar || null,
    joinedAt: Date.now(),
  })
  return room
}

function removeUserFromRoom(roomID, userID) {
  const room = getRoom(roomID)
  if (!room) return null
  room.users.delete(String(userID || "").trim())
  if (room.users.size === 0) {
    scheduleDestroyIfEmpty(room)
  }
  return room
}

function listUsers(room) {
  const r = room && room.users ? room : null
  if (!r) return []
  return Array.from(r.users.values()).map((u) => ({
    userID: u.userID,
    displayName: u.displayName,
    avatar: u.avatar || null,
    joinedAt: u.joinedAt,
  }))
}

function markActive(roomID) {
  const room = getRoom(roomID)
  if (!room) return null
  room.status = "active"
  room.startedAt = Date.now()
  return room
}

function markEnded(roomID, endedBy) {
  const room = getRoom(roomID)
  if (!room) return { room: null, durationSeconds: 0 }
  room.status = "ended"
  room.endedAt = Date.now()
  const startedAt = Number(room.startedAt || 0)
  const durationSeconds = startedAt ? Math.max(0, Math.floor((room.endedAt - startedAt) / 1000)) : 0
  room.endedBy = String(endedBy || "").trim() || null
  scheduleDestroyIfEmpty(room)
  return { room, durationSeconds }
}

function addPendingInvitee(roomID, userID, timeoutHandle) {
  const room = getRoom(roomID)
  if (!room) return null
  clearDestroy(room)
  const uid = String(userID || "").trim()
  if (!uid) return room
  room.pendingInvitees.set(uid, { invitedAt: Date.now(), timeoutHandle: timeoutHandle || null })
  return room
}

function removePendingInvitee(roomID, userID) {
  const room = getRoom(roomID)
  if (!room) return null
  const uid = String(userID || "").trim()
  const row = room.pendingInvitees.get(uid)
  if (row && row.timeoutHandle) {
    try {
      clearTimeout(row.timeoutHandle)
    } catch {
      // ignore
    }
  }
  room.pendingInvitees.delete(uid)
  if (room.users.size === 0 && room.pendingInvitees.size === 0) {
    scheduleDestroyIfEmpty(room)
  }
  return room
}

function isPendingInvitee(roomID, userID) {
  const room = getRoom(roomID)
  if (!room) return false
  return room.pendingInvitees.has(String(userID || "").trim())
}

function sweepRooms() {
  const now = Date.now()
  for (const [roomID, room] of rooms.entries()) {
    if (!room) continue
    if (room.users.size !== 0) continue
    if (room.destroyAt && now >= room.destroyAt) {
      if (room.users.size === 0) rooms.delete(roomID)
    }
  }
}

let _sweepTimer = null
function startRoomSweeper() {
  if (_sweepTimer) return
  _sweepTimer = setInterval(sweepRooms, SWEEP_INTERVAL_MS)
  try {
    _sweepTimer.unref()
  } catch {
    // ignore
  }
}

function stopRoomSweeper() {
  if (!_sweepTimer) return
  clearInterval(_sweepTimer)
  _sweepTimer = null
}

startRoomSweeper()

module.exports = {
  rooms,
  getRoom,
  createRoom,
  ensureRoom,
  addUserToRoom,
  removeUserFromRoom,
  listUsers,
  markActive,
  markEnded,
  addPendingInvitee,
  removePendingInvitee,
  isPendingInvitee,
  startRoomSweeper,
  stopRoomSweeper,
}

