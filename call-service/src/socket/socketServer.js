const { Server } = require("socket.io");
const { supabasePublic } = require("../config/supabase");
const { corsOptions } = require("../utils/corsOptions");
const { ensureRoom, addUserToRoom, removeUserFromRoom, listUsers, getRoom } = require("../services/roomStore");

/**
 * Socket auth:
 * Client should pass token via:
 * - `auth: { token }` (recommended)
 * - or `Authorization: Bearer <token>` header
 */
async function authenticateSocket(socket) {
  const tokenFromAuth = String(socket.handshake?.auth?.token || "").trim();
  const header = String(socket.handshake?.headers?.authorization || "");
  const tokenFromHeader = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const token = tokenFromAuth || tokenFromHeader;
  if (!token) throw new Error("Missing token");

  const { data, error } = await supabasePublic.auth.getUser(token);
  if (error || !data?.user) throw new Error("Invalid token");
  return data.user;
}

function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: corsOptions,
  });

  // userId -> socketIds
  const userSockets = new Map();

  io.on("connection", async (socket) => {
    try {
      const user = await authenticateSocket(socket);
      socket.data.user = user;

      const userId = user.id;
      const set = userSockets.get(userId) || new Set();
      set.add(socket.id);
      userSockets.set(userId, set);

      socket.emit("auth:ok", { userID: userId });

      socket.on("room:join", ({ roomID }) => {
        const id = String(roomID || "").trim();
        if (!id) return;
        ensureRoom(id);
        socket.join(`room:${id}`);
        addUserToRoom(id, { userID: user.id, username: user.email || "User" });
        const room = getRoom(id);
        io.to(`room:${id}`).emit("room:membersUpdated", { roomID: id, users: room ? listUsers(room) : [] });
      });

      socket.on("room:leave", ({ roomID }) => {
        const id = String(roomID || "").trim();
        if (!id) return;
        socket.leave(`room:${id}`);
        const updated = removeUserFromRoom(id, user.id);
        io.to(`room:${id}`).emit("room:membersUpdated", { roomID: id, users: updated ? listUsers(updated) : [] });
      });

      socket.on("disconnect", () => {
        const s = userSockets.get(userId);
        if (s) {
          s.delete(socket.id);
          if (s.size === 0) userSockets.delete(userId);
        }
      });
    } catch (e) {
      socket.emit("auth:error", { message: "Unauthorized" });
      socket.disconnect(true);
    }
  });

  function emitToUser(userID, event, payload) {
    const socketIds = userSockets.get(userID);
    if (!socketIds || socketIds.size === 0) return false;
    for (const sid of socketIds) io.to(sid).emit(event, payload);
    return true;
  }

  return { io, emitToUser };
}

module.exports = { initSocketServer };

