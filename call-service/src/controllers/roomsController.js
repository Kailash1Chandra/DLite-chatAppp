const { HttpError } = require("../utils/httpError");
const { parse, createRoomSchema, joinRoomSchema, leaveRoomSchema, inviteSchema } = require("../utils/validation");
const { getRoom, ensureRoom, listUsers } = require("../services/roomStore");
const { getDisplayName } = require("../utils/displayName")

async function createRoomHandler(req, res, next) {
  try {
    const { roomID } = parse(createRoomSchema, req.body);
    // Socket is the source of truth for membership. REST only validates / ensures room shell exists.
    const room = ensureRoom(roomID, { status: "ringing", createdBy: String(req.user?.id || "").trim() })
    res.json({ ok: true, roomID: room.roomID, users: listUsers(room) })
  } catch (e) {
    next(e);
  }
}

async function joinRoomHandler(req, res, next) {
  try {
    const { roomID } = parse(joinRoomSchema, req.body);
    const room = getRoom(roomID)
    if (!room) throw new HttpError(404, "Room not found")
    res.json({ ok: true, roomID: room.roomID, users: listUsers(room) })
  } catch (e) {
    next(e);
  }
}

async function leaveRoomHandler(req, res, next) {
  try {
    const { roomID } = parse(leaveRoomSchema, req.body);
    const room = getRoom(roomID);
    if (!room) throw new HttpError(404, "Room not found");
    // Informational only; actual leave happens via socket "room:leave".
    res.json({ ok: true, roomID, users: listUsers(room) })
  } catch (e) {
    next(e);
  }
}

async function inviteToRoomHandler(req, res, next) {
  try {
    const { roomID, inviteeUserID } = parse(inviteSchema, req.body);
    const room = getRoom(roomID);
    if (!room) throw new HttpError(404, "Room not found");

    // Only existing room members can invite others.
    const inviterId = String(req.user?.id || "").trim();
    if (!room.users.has(inviterId)) throw new HttpError(403, "You must be a room member to invite");

    const emitToUser = req.app.get("emitToUser");
    const delivered = typeof emitToUser === "function"
      ? emitToUser(inviteeUserID, "room:invite", {
          roomID,
          invitedBy: { userID: inviterId, displayName: getDisplayName(req.user), avatar: req.user?.user_metadata?.avatar_url || null },
          mode: "voice_or_video",
        })
      : false

    res.json({ ok: true, roomID, inviteeUserID, delivered });
  } catch (e) {
    next(e);
  }
}

module.exports = { createRoomHandler, joinRoomHandler, leaveRoomHandler, inviteToRoomHandler };

