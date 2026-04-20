import { createServer } from "node:http";
import { Server } from "socket.io";

const PORT = Number(process.env.SOCKET_PORT || 4003);

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  path: "/socket.io",
});

const connectionsByUser = new Map(); // userId -> Set(socketId)

function userRoom(userId) {
  return `user:${userId}`;
}

function chatRoom(chatId) {
  return `chat:${chatId}`;
}

function broadcastUserStatus(userId, status) {
  io.emit("user_status", { userId, status });
}

io.on("connection", (socket) => {
  const { userId } = socket.handshake.auth || {};
  const uid = String(userId || "").trim();

  if (!uid) {
    socket.emit("socket_error", { message: "Missing userId" });
    socket.disconnect(true);
    return;
  }

  socket.data.userId = uid;
  socket.join(userRoom(uid));

  const set = connectionsByUser.get(uid) || new Set();
  const wasEmpty = set.size === 0;
  set.add(socket.id);
  connectionsByUser.set(uid, set);
  if (wasEmpty) broadcastUserStatus(uid, "online");

  socket.emit("connected", { userId: uid, socketId: socket.id });

  socket.on("join_chat", (data) => {
    const chatId = String(data?.chatId || "").trim();
    if (!chatId) return socket.emit("socket_error", { message: "chatId is required" });
    socket.join(chatRoom(chatId));
  });

  socket.on("send_message", (data) => {
    const chatId = String(data?.chatId || "").trim();
    const senderId = String(data?.senderId || uid || "").trim();
    const content = String(data?.content || "").trim();
    const type = String(data?.type || "text").trim() || "text";
    if (!chatId || !senderId || !content) {
      socket.emit("socket_error", { message: "chatId, senderId, and content are required" });
      return;
    }
    io.to(chatRoom(chatId)).emit("receive_message", {
      chatId,
      senderId,
      content,
      type,
      _id: data?._id || data?.id || null,
      createdAt: data?.createdAt || Date.now(),
    });
  });

  socket.on("typing", (data) => {
    const chatId = String(data?.chatId || "").trim();
    const senderId = String(data?.senderId || uid || "").trim();
    if (!chatId) return;
    socket.to(chatRoom(chatId)).emit("typing", { chatId, senderId });
  });

  socket.on("stop_typing", (data) => {
    const chatId = String(data?.chatId || "").trim();
    const senderId = String(data?.senderId || uid || "").trim();
    if (!chatId) return;
    socket.to(chatRoom(chatId)).emit("stop_typing", { chatId, senderId });
  });

  socket.on("get_user_status", (data) => {
    const target = String(data?.userId || "").trim();
    if (!target) return;
    const online = Boolean(connectionsByUser.get(target)?.size);
    socket.emit("user_status", { userId: target, status: online ? "online" : "offline" });
  });

  // Call events (UI expects these names)
  socket.on("call_user", (payload) => {
    const toUid = String(payload?.toUserId || "").trim();
    if (!toUid || toUid === uid) return;
    io.to(userRoom(toUid)).emit("call_user", {
      fromUserId: uid,
      callType: payload?.callType || "audio",
      offer: payload?.offer,
    });
  });

  socket.on("accept_call", (payload) => {
    const toUid = String(payload?.toUserId || "").trim();
    if (!toUid || toUid === uid || !payload?.answer) return;
    io.to(userRoom(toUid)).emit("call_answer", { fromUserId: uid, answer: payload.answer });
  });

  socket.on("reject_call", (payload) => {
    const toUid = String(payload?.toUserId || "").trim();
    if (!toUid || toUid === uid) return;
    io.to(userRoom(toUid)).emit("call_rejected", { fromUserId: uid, reason: String(payload?.reason || "rejected") });
  });

  socket.on("ice_candidate", (payload) => {
    const toUid = String(payload?.toUserId || "").trim();
    if (!toUid || toUid === uid || payload?.candidate == null) return;
    io.to(userRoom(toUid)).emit("call_ice_candidate", { fromUserId: uid, candidate: payload.candidate });
  });

  socket.on("end_call", (payload) => {
    const toUid = String(payload?.toUserId || "").trim();
    if (!toUid || toUid === uid) return;
    io.to(userRoom(toUid)).emit("call_ended", { fromUserId: uid, reason: String(payload?.reason || "ended") });
  });

  socket.on("disconnect", () => {
    const set = connectionsByUser.get(uid);
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) {
        connectionsByUser.delete(uid);
        broadcastUserStatus(uid, "offline");
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`[mock-sockets] listening on http://localhost:${PORT}`);
});

