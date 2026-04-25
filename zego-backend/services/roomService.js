const { HttpError } = require("../utils/httpError");

// In-memory storage: roomID -> { createdAt, users: Map(userID -> { userID, username, joinedAt }) }
const rooms = new Map();

function normalizeRoomID(roomID) {
  return String(roomID || "").trim();
}

function normalizeUserID(userID) {
  return String(userID || "").trim();
}

function listRoomUsers(room) {
  return Array.from(room.users.values()).map((u) => ({
    userID: u.userID,
    username: u.username,
    joinedAt: u.joinedAt,
  }));
}

async function createRoom({ roomID, user }) {
  const id = normalizeRoomID(roomID);
  if (!id) throw new HttpError(400, "roomID is required");
  if (rooms.has(id)) throw new HttpError(409, "Room already exists");

  const room = {
    roomID: id,
    createdAt: Date.now(),
    users: new Map(),
  };
  rooms.set(id, room);

  // Creator auto-joins (common behavior).
  await joinRoom({ roomID: id, user, allowCreateIfMissing: false });
  return room;
}

async function joinRoom({ roomID, user, allowCreateIfMissing = false }) {
  const id = normalizeRoomID(roomID);
  if (!id) throw new HttpError(400, "roomID is required");

  let room = rooms.get(id);
  if (!room && allowCreateIfMissing) {
    room = { roomID: id, createdAt: Date.now(), users: new Map() };
    rooms.set(id, room);
  }
  if (!room) throw new HttpError(404, "Room not found");

  const userID = normalizeUserID(user?.id);
  if (!userID) throw new HttpError(401, "Invalid user");

  const username = String(user?.username || "").trim();
  room.users.set(userID, { userID, username, joinedAt: Date.now() });
  return room;
}

async function leaveRoom({ roomID, user }) {
  const id = normalizeRoomID(roomID);
  if (!id) throw new HttpError(400, "roomID is required");
  const room = rooms.get(id);
  if (!room) throw new HttpError(404, "Room not found");

  const userID = normalizeUserID(user?.id);
  if (!userID) throw new HttpError(401, "Invalid user");

  room.users.delete(userID);
  if (room.users.size === 0) {
    rooms.delete(id);
  }
  return room;
}

async function getRoom({ roomID }) {
  const id = normalizeRoomID(roomID);
  if (!id) throw new HttpError(400, "roomID is required");
  const room = rooms.get(id);
  if (!room) throw new HttpError(404, "Room not found");
  return room;
}

module.exports = {
  rooms,
  listRoomUsers,
  createRoom,
  joinRoom,
  leaveRoom,
  getRoom,
};

