const { Server } = require("socket.io")
const { supabasePublic, getUserByID } = require("../config/supabase")
const { corsOptions } = require("../utils/corsOptions")
const { getDisplayName } = require("../utils/displayName")
const {
  ensureRoom,
  addUserToRoom,
  removeUserFromRoom,
  listUsers,
  getRoom,
  markActive,
  markEnded,
  addPendingInvitee,
  removePendingInvitee,
  isPendingInvitee,
} = require("../services/roomStore")
const inviteService = require("../services/inviteService")

function ts() {
  return new Date().toISOString()
}

/**
 * Socket auth:
 * Client should pass token via:
 * - `auth: { token }` (recommended)
 * - or `Authorization: Bearer <token>` header
 */
async function authenticateSocket(socket) {
  const tokenFromAuth = String(socket.handshake?.auth?.token || "").trim()
  const header = String(socket.handshake?.headers?.authorization || "")
  const tokenFromHeader = header.startsWith("Bearer ") ? header.slice(7).trim() : ""
  const token = tokenFromAuth || tokenFromHeader
  if (!token) throw new Error("Missing token")

  const { data, error } = await supabasePublic.auth.getUser(token)
  if (error || !data?.user) throw new Error("Invalid token")
  return { user: data.user, token }
}

function safeHandler(socket, eventName, handler) {
  return async (data, ack) => {
    try {
      await handler(data || {}, ack)
    } catch (err) {
      const msg = err && err.message ? err.message : String(err || "Server error")
      console.error(`[socket:${eventName}]`, { userID: socket.data.user?.id, err: msg })
      const errorPayload = { ok: false, error: { code: err?.code || "INTERNAL", message: msg || "Server error" } }
      if (typeof ack === "function") ack(errorPayload)
      else socket.emit("error", { event: eventName, ...errorPayload.error })
    }
  }
}

function initSocketServer(httpServer) {
  const io = new Server(httpServer, { cors: corsOptions })

  // userId -> Set<socketId>
  const userSockets = new Map()
  // socketId -> userId
  const socketUsers = new Map()

  function roomChannel(roomID) {
    return `room:${roomID}`
  }

  function emitToUser(userID, event, payload) {
    const socketIds = userSockets.get(userID)
    if (!socketIds || socketIds.size === 0) return false
    for (const sid of socketIds) io.to(sid).emit(event, payload)
    return true
  }

  function socketsInRoom(roomID) {
    const set = io.sockets.adapter.rooms.get(roomChannel(roomID))
    return set ? Array.from(set) : []
  }

  function userHasAnySocketInRoom(userID, roomID) {
    const sids = socketsInRoom(roomID)
    for (const sid of sids) {
      if (socketUsers.get(sid) === userID) return true
    }
    return false
  }

  function broadcastMembers(roomID) {
    const room = getRoom(roomID)
    io.to(roomChannel(roomID)).emit("room:membersUpdated", { roomID, users: room ? listUsers(room) : [] })
  }

  async function fullyRemoveUserFromRoomIfNoOtherSockets({ roomID, userID }) {
    const rid = String(roomID || "").trim()
    const uid = String(userID || "").trim()
    if (!rid || !uid) return
    if (userHasAnySocketInRoom(uid, rid)) return
    removeUserFromRoom(rid, uid)
    broadcastMembers(rid)
  }

  function makeRoomID(callerID, calleeID) {
    const a = String(callerID || "").trim()
    const b = String(calleeID || "").trim()
    const sa = a.slice(0, 8)
    const sb = b.slice(0, 8)
    return `call-${sa}-${sb}-${Date.now()}`
  }

  function userIsBusy(userID) {
    const uid = String(userID || "").trim()
    if (!uid) return false
    for (const room of require("../services/roomStore").rooms.values()) {
      if (!room) continue
      if (room.status !== "active") continue
      if (room.users && room.users.has(uid)) return true
    }
    return false
  }

  async function endRoomAs(roomID, endedBy) {
    const rid = String(roomID || "").trim()
    if (!rid) return { durationSeconds: 0 }
    inviteService.cancelAllForRoom(rid)
    const out = markEnded(rid, endedBy)
    const durationSeconds = out.durationSeconds || 0
    io.to(roomChannel(rid)).emit("call:ended", { roomID: rid, endedBy: String(endedBy || "").trim(), durationSeconds })

    // Remove all members from store after emitting, but keep room for grace cleanup.
    const room = getRoom(rid)
    if (room && room.users) {
      for (const uid of Array.from(room.users.keys())) {
        removeUserFromRoom(rid, uid)
      }
    }
    broadcastMembers(rid)

    // Make sockets leave the socket.io room
    const sids = socketsInRoom(rid)
    for (const sid of sids) {
      const s = io.sockets.sockets.get(sid)
      if (s) {
        try {
          s.leave(roomChannel(rid))
        } catch {
          // ignore
        }
        if (s.data?.rooms && s.data.rooms instanceof Set) {
          try {
            s.data.rooms.delete(rid)
          } catch {
            // ignore
          }
        }
      }
    }
    return { durationSeconds }
  }

  io.on("connection", async (socket) => {
    try {
      const { user, token } = await authenticateSocket(socket)
      socket.data.user = user
      socket.data.accessToken = token
      socket.data.rooms = new Set()

      const userId = String(user.id || "").trim()
      const set = userSockets.get(userId) || new Set()
      set.add(socket.id)
      userSockets.set(userId, set)
      socketUsers.set(socket.id, userId)

      socket.emit("auth:ok", { userID: userId })

      socket.on(
        "room:join",
        safeHandler(socket, "room:join", async (payload) => {
          const id = String(payload?.roomID || "").trim()
          if (!id) return
          ensureRoom(id, { status: "ringing", createdBy: userId })
          socket.join(roomChannel(id))
          socket.data.rooms.add(id)
          addUserToRoom(id, {
            userID: userId,
            displayName: getDisplayName(user),
            avatar: user?.user_metadata?.avatar_url || null,
          })
          broadcastMembers(id)
        })
      )

      socket.on(
        "room:leave",
        safeHandler(socket, "room:leave", async (payload) => {
          const id = String(payload?.roomID || "").trim()
          if (!id) return
          try {
            socket.leave(roomChannel(id))
          } catch {
            // ignore
          }
          try {
            socket.data.rooms.delete(id)
          } catch {
            // ignore
          }
          await fullyRemoveUserFromRoomIfNoOtherSockets({ roomID: id, userID: userId })
        })
      )

      // ===== Call lifecycle =====
      socket.on(
        "call:start",
        safeHandler(socket, "call:start", async (payload, ack) => {
          const calleeID = String(payload?.calleeID || "").trim()
          const type = String(payload?.type || "audio").trim() === "video" ? "video" : "audio"
          if (!calleeID) throw Object.assign(new Error("calleeID is required"), { code: "BAD_REQUEST" })
          if (calleeID === userId) throw Object.assign(new Error("Cannot call yourself"), { code: "BAD_REQUEST" })

          const callee = await getUserByID(calleeID)
          if (!callee) throw Object.assign(new Error("User not found"), { code: "USER_NOT_FOUND" })

          if (userIsBusy(userId)) throw Object.assign(new Error("You are already in an active call"), { code: "USER_BUSY" })
          if (userIsBusy(calleeID)) throw Object.assign(new Error("User is busy"), { code: "USER_BUSY" })

          const roomID = makeRoomID(userId, calleeID)
          ensureRoom(roomID, { type, isGroup: false, createdBy: userId, status: "ringing" })

          // Caller joins immediately
          socket.join(roomChannel(roomID))
          socket.data.rooms.add(roomID)
          addUserToRoom(roomID, {
            userID: userId,
            displayName: getDisplayName(user),
            avatar: user?.user_metadata?.avatar_url || null,
          })

          const { expiresAt } = inviteService.create({
            roomID,
            calleeID,
            callerID: userId,
            type,
            onTimeout: async ({ roomID: rid, calleeID: cid, callerID: caller, type: t }) => {
              // Missed/timeout semantics
              emitToUser(caller, "call:missed", { roomID: rid, callee: cid, type: t })
              emitToUser(cid, "call:timeout", { roomID: rid })
              await endRoomAs(rid, caller)
            },
          })
          addPendingInvitee(roomID, calleeID, null)

          const delivered = emitToUser(calleeID, "call:incoming", {
            roomID,
            caller: { userID: userId, displayName: getDisplayName(user), avatar: user?.user_metadata?.avatar_url || null },
            type,
            expiresAt,
          })

          if (!delivered) {
            // user offline
            inviteService.cancel(roomID, calleeID)
            removePendingInvitee(roomID, calleeID)
            throw Object.assign(new Error("User is offline"), { code: "USER_OFFLINE" })
          }

          if (typeof ack === "function") ack({ ok: true, roomID, expiresAt })
        })
      )

      socket.on(
        "call:accept",
        safeHandler(socket, "call:accept", async (payload, ack) => {
          const roomID = String(payload?.roomID || "").trim()
          const room = getRoom(roomID)
          if (!room) throw Object.assign(new Error("Room not found"), { code: "ROOM_NOT_FOUND" })
          if (!isPendingInvitee(roomID, userId)) throw Object.assign(new Error("No pending invite"), { code: "NOT_INVITED" })

          inviteService.cancel(roomID, userId)
          removePendingInvitee(roomID, userId)
          socket.join(roomChannel(roomID))
          socket.data.rooms.add(roomID)
          addUserToRoom(roomID, {
            userID: userId,
            displayName: getDisplayName(user),
            avatar: user?.user_metadata?.avatar_url || null,
          })
          markActive(roomID)
          broadcastMembers(roomID)
          io.to(roomChannel(roomID)).emit("call:accepted", { roomID, by: userId })
          if (typeof ack === "function") ack({ ok: true, roomID })
        })
      )

      socket.on(
        "call:reject",
        safeHandler(socket, "call:reject", async (payload, ack) => {
          const roomID = String(payload?.roomID || "").trim()
          const reason = String(payload?.reason || "declined").trim()
          const room = getRoom(roomID)
          if (!room) throw Object.assign(new Error("Room not found"), { code: "ROOM_NOT_FOUND" })
          if (!isPendingInvitee(roomID, userId)) throw Object.assign(new Error("No pending invite"), { code: "NOT_INVITED" })

          inviteService.cancel(roomID, userId)
          removePendingInvitee(roomID, userId)
          const callerID = String(room.createdBy || "").trim()
          if (callerID) emitToUser(callerID, "call:rejected", { roomID, by: userId, reason })

          // If no other pending invitees and only caller is there, end the room
          if ((room.pendingInvitees?.size || 0) === 0) {
            await endRoomAs(roomID, callerID || userId)
          }

          if (typeof ack === "function") ack({ ok: true, roomID })
        })
      )

      socket.on(
        "call:cancel",
        safeHandler(socket, "call:cancel", async (payload, ack) => {
          const roomID = String(payload?.roomID || "").trim()
          const room = getRoom(roomID)
          if (!room) throw Object.assign(new Error("Room not found"), { code: "ROOM_NOT_FOUND" })
          if (String(room.createdBy || "").trim() !== userId) throw Object.assign(new Error("Not allowed"), { code: "FORBIDDEN" })
          if (room.status !== "ringing") throw Object.assign(new Error("Call is not ringing"), { code: "INVALID_STATE" })

          inviteService.cancelAllForRoom(roomID)
          // Notify pending invitees
          const pending = room.pendingInvitees ? Array.from(room.pendingInvitees.keys()) : []
          for (const pid of pending) emitToUser(pid, "call:cancelled", { roomID, by: userId })
          for (const pid of pending) removePendingInvitee(roomID, pid)

          await endRoomAs(roomID, userId)
          if (typeof ack === "function") ack({ ok: true, roomID })
        })
      )

      socket.on(
        "call:end",
        safeHandler(socket, "call:end", async (payload, ack) => {
          const roomID = String(payload?.roomID || "").trim()
          const room = getRoom(roomID)
          if (!room) throw Object.assign(new Error("Room not found"), { code: "ROOM_NOT_FOUND" })
          if (!room.users || !room.users.has(userId)) throw Object.assign(new Error("Not a room member"), { code: "FORBIDDEN" })

          await endRoomAs(roomID, userId)
          if (typeof ack === "function") ack({ ok: true, roomID })
        })
      )

      socket.on("disconnect", async () => {
        const roomsJoined = socket.data.rooms instanceof Set ? Array.from(socket.data.rooms) : []

        // Remove socket from userSockets first (multi-tab requires remaining sockets visibility)
        const s = userSockets.get(userId)
        if (s) {
          s.delete(socket.id)
          if (s.size === 0) userSockets.delete(userId)
        }
        socketUsers.delete(socket.id)

        for (const roomID of roomsJoined) {
          const room = getRoom(roomID)
          if (!room) continue

          // Leave socket.io room
          try {
            socket.leave(roomChannel(roomID))
          } catch {
            // ignore
          }

          // Multi-tab: only act if user has no other sockets in this room
          if (userHasAnySocketInRoom(userId, roomID)) continue

          if (room.status === "ringing") {
            // If caller disconnects during ringing -> cancel
            if (String(room.createdBy || "").trim() === userId) {
              inviteService.cancelAllForRoom(roomID)
              const pending = room.pendingInvitees ? Array.from(room.pendingInvitees.keys()) : []
              for (const pid of pending) emitToUser(pid, "call:cancelled", { roomID, by: userId })
              for (const pid of pending) removePendingInvitee(roomID, pid)
              await endRoomAs(roomID, userId)
              continue
            }

            // Pending invitee disconnects -> reject as no_answer
            if (isPendingInvitee(roomID, userId)) {
              inviteService.cancel(roomID, userId)
              removePendingInvitee(roomID, userId)
              const callerID = String(room.createdBy || "").trim()
              if (callerID) emitToUser(callerID, "call:rejected", { roomID, by: userId, reason: "no_answer" })
              if ((room.pendingInvitees?.size || 0) === 0) await endRoomAs(roomID, callerID || userId)
              continue
            }
          }

          if (room.status === "active") {
            // Active call: remove member; if alone remains, end call
            removeUserFromRoom(roomID, userId)
            broadcastMembers(roomID)
            const leftCount = room.users ? room.users.size : 0
            if (leftCount <= 1) {
              const remaining = room.users ? Array.from(room.users.keys())[0] : null
              await endRoomAs(roomID, remaining || userId)
            }
            continue
          }

          // Default: just clean membership
          removeUserFromRoom(roomID, userId)
          broadcastMembers(roomID)
        }

        try {
          socket.data.rooms.clear()
        } catch {
          // ignore
        }
      })
    } catch (e) {
      socket.emit("auth:error", { message: "Unauthorized" })
      socket.disconnect(true)
    }
  })

  function shutdown(reason) {
    const r = String(reason || "server_shutdown")
    console.log(`[socket] shutdown begin`, { ts: ts(), reason: r })
    try {
      io.emit("server:shutdown", { reason: r })
    } catch {
      // ignore
    }
    try {
      io.disconnectSockets(true)
    } catch {
      // ignore
    }
    console.log(`[socket] shutdown complete`, { ts: ts() })
  }

  return { io, emitToUser, shutdown }
}

module.exports = { initSocketServer }

