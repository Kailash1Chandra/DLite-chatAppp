const { HttpError } = require("../utils/httpError");
const { createRoom, joinRoom, leaveRoom, getRoom, listRoomUsers } = require("../services/roomService");
const { tryInsertRoom, tryInsertMembership, tryDeleteMembership } = require("../services/roomDbService");

async function createRoomHandler(req, res, next) {
  try {
    const roomID = String(req.body?.roomID || "").trim();
    const room = await createRoom({ roomID, user: req.user });
    await tryInsertRoom({ roomID: room.roomID, createdBy: req.user?.id }).catch(() => undefined);
    await tryInsertMembership({ roomID: room.roomID, userID: req.user?.id }).catch(() => undefined);
    res.json({ ok: true, roomID: room.roomID, users: listRoomUsers(room) });
  } catch (e) {
    next(e);
  }
}

async function joinRoomHandler(req, res, next) {
  try {
    const roomID = String(req.body?.roomID || "").trim();
    const room = await joinRoom({ roomID, user: req.user });
    await tryInsertMembership({ roomID: room.roomID, userID: req.user?.id }).catch(() => undefined);
    res.json({ ok: true, roomID: room.roomID, users: listRoomUsers(room) });
  } catch (e) {
    next(e);
  }
}

async function leaveRoomHandler(req, res, next) {
  try {
    const roomID = String(req.body?.roomID || "").trim();
    const room = await leaveRoom({ roomID, user: req.user });
    await tryDeleteMembership({ roomID: room.roomID, userID: req.user?.id }).catch(() => undefined);
    res.json({ ok: true, roomID: room.roomID, users: listRoomUsers(room) });
  } catch (e) {
    next(e);
  }
}

// Optional utility for debugging / admin consoles
async function getRoomHandler(req, res, next) {
  try {
    const roomID = String(req.params?.roomID || "").trim();
    if (!roomID) throw new HttpError(400, "roomID is required");
    const room = await getRoom({ roomID });
    res.json({ ok: true, roomID: room.roomID, users: listRoomUsers(room) });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  createRoom: createRoomHandler,
  joinRoom: joinRoomHandler,
  leaveRoom: leaveRoomHandler,
  getRoom: getRoomHandler,
};

