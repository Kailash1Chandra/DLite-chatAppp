// In-memory room store: Map<roomID, { users: Map<userID, { userID, username, joinedAt }> }>
const rooms = new Map();

function getRoom(roomID) {
  return rooms.get(roomID) || null;
}

function createRoom(roomID) {
  const room = { roomID, users: new Map(), createdAt: Date.now() };
  rooms.set(roomID, room);
  return room;
}

function ensureRoom(roomID) {
  return getRoom(roomID) || createRoom(roomID);
}

function addUserToRoom(roomID, user) {
  const room = getRoom(roomID);
  if (!room) return null;
  room.users.set(user.userID, { ...user, joinedAt: Date.now() });
  return room;
}

function removeUserFromRoom(roomID, userID) {
  const room = getRoom(roomID);
  if (!room) return null;
  room.users.delete(userID);
  if (room.users.size === 0) {
    rooms.delete(roomID);
    return null;
  }
  return room;
}

function listUsers(room) {
  return Array.from(room.users.values()).map((u) => ({
    userID: u.userID,
    username: u.username,
    joinedAt: u.joinedAt,
  }));
}

module.exports = {
  rooms,
  getRoom,
  createRoom,
  ensureRoom,
  addUserToRoom,
  removeUserFromRoom,
  listUsers,
};

