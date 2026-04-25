const { HttpError } = require("../utils/httpError");
const { parse, createRoomSchema, joinRoomSchema, leaveRoomSchema, inviteSchema } = require("../utils/validation");
const { getRoom, createRoom, addUserToRoom, removeUserFromRoom, listUsers } = require("../services/roomStore");

async function createRoomHandler(req, res, next) {
  try {
    const { roomID } = parse(createRoomSchema, req.body);
    if (getRoom(roomID)) throw new HttpError(409, "Room already exists");

    const room = createRoom(roomID);
    addUserToRoom(roomID, { userID: req.user.id, username: req.user.email || "User" });
    res.json({ ok: true, roomID: room.roomID, users: listUsers(room) });
  } catch (e) {
    next(e);
  }
}

async function joinRoomHandler(req, res, next) {
  try {
    const { roomID } = parse(joinRoomSchema, req.body);
    const room = getRoom(roomID);
    if (!room) throw new HttpError(404, "Room not found");

    addUserToRoom(roomID, { userID: req.user.id, username: req.user.email || "User" });
    res.json({ ok: true, roomID: room.roomID, users: listUsers(room) });
  } catch (e) {
    next(e);
  }
}

async function leaveRoomHandler(req, res, next) {
  try {
    const { roomID } = parse(leaveRoomSchema, req.body);
    const room = getRoom(roomID);
    if (!room) throw new HttpError(404, "Room not found");

    const updated = removeUserFromRoom(roomID, req.user.id);
    res.json({ ok: true, roomID, users: updated ? listUsers(updated) : [] });
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
          invitedBy: { userID: inviterId, email: req.user?.email || null },
          mode: "voice_or_video",
        })
      : false;

    res.json({ ok: true, roomID, inviteeUserID, delivered });
  } catch (e) {
    next(e);
  }
}

module.exports = { createRoomHandler, joinRoomHandler, leaveRoomHandler, inviteToRoomHandler };

