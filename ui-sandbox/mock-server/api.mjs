import express from "express";
import cors from "cors";

const PORT = Number(process.env.PORT || 4000);

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

function nowIso() {
  return new Date().toISOString();
}

function randId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
}

function ok(data) {
  return { success: true, ...data };
}

function fail(message, status = 400) {
  return { status, body: { success: false, message } };
}

// ===== In-memory mock DB =====
const state = {
  users: new Map(), // id -> {id,email,username,avatar_url,created_at,password}
  tokens: new Map(), // token -> userId
  dms: new Map(), // dmKey -> { chatId, users:[a,b] }
  messagesByChat: new Map(), // chatId -> [{id,chat_id,sender_id,content,type,created_at,is_deleted}]
  chatSettings: new Map(), // `${uid}:${chatId}` -> {archived,locked,hidden,last_read_at}
  reactions: new Map(), // `${messageId}:${userId}:${emoji}` -> true
  pins: new Map(), // `${chatId}:${userId}` -> [{message_id,created_at}]
  presence: new Map(), // userId -> {status,last_seen}
  groups: new Map(), // groupId -> {id,name,created_by,created_at,members: Map<userId, role>}
};

function normalizeGroupId(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  // preserve existing ids (e.g. group_xxx), otherwise namespace it.
  return raw.startsWith("group_") ? raw : `group_${raw}`;
}

function ensureGroup({ groupKey, actorId }) {
  const gid = normalizeGroupId(groupKey);
  if (!gid) return null;
  const existing = state.groups.get(gid);
  if (existing) {
    if (actorId) {
      const role = existing.members.get(actorId);
      if (!role) existing.members.set(actorId, "member");
    }
    return existing;
  }
  const g = {
    id: gid,
    name: String(groupKey || "").trim() || gid,
    created_by: actorId || "",
    created_at: nowIso(),
    members: new Map(),
  };
  if (actorId) g.members.set(actorId, "admin");
  state.groups.set(gid, g);
  return g;
}

function ensureUser({ email, username, password }) {
  const e = String(email || "").trim().toLowerCase();
  const u = String(username || e.split("@")[0] || "user").trim();
  if (!e) return null;
  const existing = [...state.users.values()].find((x) => x.email === e);
  if (existing) return existing;
  const id = randId("user");
  const user = {
    id,
    email: e,
    username: u,
    avatar_url: "",
    created_at: nowIso(),
    password: String(password || "password"),
  };
  state.users.set(id, user);
  state.presence.set(id, { status: "offline", last_seen: null });
  return user;
}

function issueToken(userId) {
  const token = randId("token");
  state.tokens.set(token, userId);
  return token;
}

function authUser(req) {
  const raw = String(req.headers.authorization || "");
  const token = raw.toLowerCase().startsWith("bearer ") ? raw.split(" ", 2)[1].trim() : "";
  if (!token) return null;
  const uid = state.tokens.get(token);
  if (!uid) return null;
  return state.users.get(uid) || null;
}

function dmKey(a, b) {
  const x = String(a || "").trim();
  const y = String(b || "").trim();
  return ["dm", x < y ? x : y, x < y ? y : x].join(":");
}

function getChatSettings(uid, chatId) {
  const k = `${uid}:${chatId}`;
  return state.chatSettings.get(k) || { archived: false, locked: false, hidden: false, last_read_at: "1970-01-01T00:00:00Z" };
}

function setChatSettings(uid, chatId, patch) {
  const k = `${uid}:${chatId}`;
  const curr = getChatSettings(uid, chatId);
  const next = { ...curr, ...patch };
  state.chatSettings.set(k, next);
  return next;
}

function safeUserForClient(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    user_metadata: {
      username: user.username,
      avatar_url: user.avatar_url || "",
    },
  };
}

// ===== Meta =====
app.get("/", (_req, res) => res.json(ok({ service: "mock-api", message: "D-Lite UI mock API" })));
app.get("/health", (_req, res) => res.json(ok({ status: "ok" })));

// ===== Auth (matches core-backend response shape via authClient.parseAuthResponse) =====
app.post("/auth/signup", (req, res) => {
  const { email, password, username } = req.body || {};
  const user = ensureUser({ email, password, username });
  if (!user) return res.status(400).json({ success: false, message: "Email is required" });
  const token = issueToken(user.id);
  return res.status(201).json(ok({ message: "Signup successful", data: { accessToken: token, user: safeUserForClient(user) } }));
});

app.post("/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  const e = String(email || "").trim().toLowerCase();
  const p = String(password || "");
  if (!e || !p) return res.status(400).json({ success: false, message: "Email and password are required" });
  const user = [...state.users.values()].find((x) => x.email === e);
  if (!user || user.password !== p) return res.status(401).json({ success: false, message: "Invalid email or password" });
  const token = issueToken(user.id);
  return res.json(ok({ message: "Login successful", data: { accessToken: token, user: safeUserForClient(user) } }));
});

app.post("/auth/otp/request", (req, res) => {
  const { email } = req.body || {};
  if (!String(email || "").trim()) return res.status(400).json({ success: false, message: "email is required" });
  return res.json(ok({ message: "OTP sent (mock)", data: { ok: true } }));
});

app.post("/auth/otp/verify", (req, res) => {
  const { email, token } = req.body || {};
  if (!String(email || "").trim() || !String(token || "").trim()) return res.status(400).json({ success: false, message: "email and token are required" });
  const user = ensureUser({ email, password: "password", username: String(email || "").split("@")[0] });
  const accessToken = issueToken(user.id);
  return res.json(ok({ message: "OTP verified (mock)", data: { accessToken, user: safeUserForClient(user) } }));
});

app.get("/auth/me", (req, res) => {
  const user = authUser(req);
  if (!user) return res.status(401).json({ success: false, message: "Invalid token" });
  return res.json(ok({ data: { user: safeUserForClient(user) } }));
});

// ===== Chat =====
app.get("/chat/users/search", (req, res) => {
  const user = authUser(req);
  if (!user) return res.status(401).json({ success: false, message: "Invalid token" });
  const term = String(req.query.username || "").trim().toLowerCase();
  const exclude = String(req.query.exclude || "").trim();
  if (!term) return res.json(ok({ users: [] }));
  const users = [...state.users.values()]
    .filter((u) => u.id !== exclude)
    .filter((u) => u.username.toLowerCase().includes(term))
    .slice(0, 15)
    .map((u) => ({ id: u.id, username: u.username, avatar_url: u.avatar_url || "" }));
  return res.json(ok({ users }));
});

app.get("/chat/presence/:userId", (req, res) => {
  const me = authUser(req);
  if (!me) return res.status(401).json({ success: false, message: "Invalid token" });
  const target = String(req.params.userId || "").trim();
  const p = state.presence.get(target) || { status: "offline", last_seen: null };
  return res.json(ok({ presence: { userId: target, status: p.status, last_seen: p.last_seen } }));
});

app.post("/chat/dm/ensure", (req, res) => {
  const me = authUser(req);
  if (!me) return res.status(401).json({ success: false, message: "Invalid token" });
  const peerId = String(req.body?.peerId || req.body?.receiverId || req.body?.userId || "").trim();
  if (!peerId) return res.status(400).json({ success: false, message: "peerId is required" });
  if (peerId === me.id) return res.status(400).json({ success: false, message: "Cannot DM yourself" });
  if (!state.users.has(peerId)) {
    // auto-create a peer user for UI testing
    state.users.set(peerId, { id: peerId, email: "", username: peerId.slice(0, 6), avatar_url: "", created_at: nowIso(), password: "" });
    state.presence.set(peerId, { status: "offline", last_seen: null });
  }
  const key = dmKey(me.id, peerId);
  const existing = state.dms.get(key);
  if (existing) return res.json(ok({ chatId: existing.chatId }));
  const chatId = randId("chat");
  state.dms.set(key, { chatId, users: [me.id, peerId] });
  state.messagesByChat.set(chatId, []);
  return res.json(ok({ chatId }));
});

app.get("/chat/dm/recent", (req, res) => {
  const me = authUser(req);
  if (!me) return res.status(401).json({ success: false, message: "Invalid token" });
  const uid = me.id;

  const items = [];
  for (const dm of state.dms.values()) {
    if (!dm.users.includes(uid)) continue;
    const chatId = dm.chatId;
    const peer = dm.users.find((x) => x !== uid) || "";
    const peerUser = state.users.get(peer);
    const msgs = state.messagesByChat.get(chatId) || [];
    const last = msgs[msgs.length - 1] || null;
    const s = getChatSettings(uid, chatId);
    if (s.hidden) continue;
    const unread = msgs.filter((m) => m.sender_id !== uid && m.created_at > (s.last_read_at || "1970-01-01T00:00:00Z")).length;
    items.push({
      threadId: chatId,
      peerId: peer,
      peerUsername: peerUser?.username || peer.slice(0, 6),
      lastMessage: last ? (last.is_deleted ? "" : last.content) : "",
      lastAt: last ? last.created_at : null,
      unreadCount: unread,
      archived: Boolean(s.archived),
      locked: Boolean(s.locked),
    });
  }
  items.sort((a, b) => String(b.lastAt || "").localeCompare(String(a.lastAt || "")));
  return res.json(ok({ chats: items.slice(0, 60) }));
});

app.post("/chat/dm/recent/read", (req, res) => {
  const me = authUser(req);
  if (!me) return res.status(401).json({ success: false, message: "Invalid token" });
  const threadId = String(req.body?.threadId || req.body?.chatId || "").trim();
  if (!threadId) return res.status(400).json({ success: false, message: "threadId is required" });
  setChatSettings(me.id, threadId, { last_read_at: nowIso() });
  return res.json(ok({}));
});

app.post("/chat/dm/recent/settings", (req, res) => {
  const me = authUser(req);
  if (!me) return res.status(401).json({ success: false, message: "Invalid token" });
  const threadId = String(req.body?.threadId || req.body?.chatId || "").trim();
  if (!threadId) return res.status(400).json({ success: false, message: "threadId is required" });
  const patch = {};
  if (req.body?.archived != null) patch.archived = Boolean(req.body.archived);
  if (req.body?.locked != null) patch.locked = Boolean(req.body.locked);
  if (req.body?.hidden != null) patch.hidden = Boolean(req.body.hidden);
  setChatSettings(me.id, threadId, patch);
  return res.json(ok({}));
});

app.post("/chat/messages/send", (req, res) => {
  const me = authUser(req);
  if (!me) return res.status(401).json({ success: false, message: "Invalid token" });
  const chatId = String(req.body?.chatId || "").trim();
  const content = String(req.body?.content || "").trim();
  const type = String(req.body?.type || "text").trim() || "text";
  if (!chatId || !content) return res.status(400).json({ success: false, message: "chatId and content are required" });
  if (!state.messagesByChat.has(chatId)) state.messagesByChat.set(chatId, []);
  const msg = {
    id: randId("msg"),
    chat_id: chatId,
    sender_id: me.id,
    content,
    type,
    is_deleted: false,
    deleted_at: null,
    deleted_by: null,
    created_at: nowIso(),
  };
  state.messagesByChat.get(chatId).push(msg);
  return res.json(ok({ message: msg }));
});

app.get("/chat/messages/:chatId", (req, res) => {
  const me = authUser(req);
  if (!me) return res.status(401).json({ success: false, message: "Invalid token" });
  const chatId = String(req.params.chatId || "").trim();
  const rows = state.messagesByChat.get(chatId) || [];
  return res.json(ok({ chatId, messages: rows.slice(-200) }));
});

app.post("/chat/messages/:messageId/delete", (req, res) => {
  const me = authUser(req);
  if (!me) return res.status(401).json({ success: false, message: "Invalid token" });
  const messageId = String(req.params.messageId || "").trim();
  for (const rows of state.messagesByChat.values()) {
    const msg = rows.find((m) => m.id === messageId);
    if (!msg) continue;
    if (msg.sender_id !== me.id) return res.status(403).json({ success: false, message: "Not allowed" });
    msg.is_deleted = true;
    msg.deleted_by = me.id;
    msg.deleted_at = nowIso();
    return res.json(ok({ message: msg }));
  }
  return res.status(404).json({ success: false, message: "Message not found" });
});

app.post("/chat/messages/:messageId/edit", (req, res) => {
  const me = authUser(req);
  if (!me) return res.status(401).json({ success: false, message: "Invalid token" });
  const messageId = String(req.params.messageId || "").trim();
  const content = String(req.body?.content || "").trim();
  if (!content) return res.status(400).json({ success: false, message: "content is required" });
  for (const rows of state.messagesByChat.values()) {
    const msg = rows.find((m) => m.id === messageId);
    if (!msg) continue;
    if (msg.sender_id !== me.id) return res.status(403).json({ success: false, message: "Not allowed" });
    if (msg.is_deleted) return res.status(409).json({ success: false, message: "Message was deleted and cannot be edited" });
    msg.content = content;
    return res.json(ok({ message: msg }));
  }
  return res.status(404).json({ success: false, message: "Message not found" });
});

app.post("/chat/messages/:messageId/hide", (req, res) => {
  const me = authUser(req);
  if (!me) return res.status(401).json({ success: false, message: "Invalid token" });
  return res.json(ok({}));
});

app.post("/chat/reactions/toggle", (req, res) => {
  const me = authUser(req);
  if (!me) return res.status(401).json({ success: false, message: "Invalid token" });
  const messageId = String(req.body?.messageId || "").trim();
  const emoji = String(req.body?.emoji || "").trim();
  if (!messageId || !emoji) return res.status(400).json({ success: false, message: "messageId and emoji are required" });
  const key = `${messageId}:${me.id}:${emoji}`;
  const existing = state.reactions.get(key) === true;
  if (existing) {
    state.reactions.delete(key);
    return res.json(ok({ active: false }));
  }
  state.reactions.set(key, true);
  return res.json(ok({ active: true }));
});

app.get("/chat/pins/:chatId", (req, res) => {
  const me = authUser(req);
  if (!me) return res.status(401).json({ success: false, message: "Invalid token" });
  const chatId = String(req.params.chatId || "").trim();
  const key = `${chatId}:${me.id}`;
  const rows = state.pins.get(key) || [];
  const pins = rows.map((p) => {
    const all = state.messagesByChat.get(chatId) || [];
    const msg = all.find((m) => m.id === p.message_id) || {};
    return { chat_id: chatId, user_id: me.id, message_id: p.message_id, created_at: p.created_at, messages: msg };
  });
  return res.json(ok({ chatId, pins }));
});

app.post("/chat/pins/:chatId/pin", (req, res) => {
  const me = authUser(req);
  if (!me) return res.status(401).json({ success: false, message: "Invalid token" });
  const chatId = String(req.params.chatId || "").trim();
  const messageId = String(req.body?.messageId || "").trim();
  if (!messageId) return res.status(400).json({ success: false, message: "messageId is required" });
  const key = `${chatId}:${me.id}`;
  const rows = state.pins.get(key) || [];
  if (!rows.find((x) => x.message_id === messageId)) rows.unshift({ message_id: messageId, created_at: nowIso() });
  state.pins.set(key, rows.slice(0, 50));
  return res.json(ok({}));
});

app.post("/chat/pins/:chatId/unpin", (req, res) => {
  const me = authUser(req);
  if (!me) return res.status(401).json({ success: false, message: "Invalid token" });
  const chatId = String(req.params.chatId || "").trim();
  const messageId = String(req.body?.messageId || "").trim();
  if (!messageId) return res.status(400).json({ success: false, message: "messageId is required" });
  const key = `${chatId}:${me.id}`;
  const rows = (state.pins.get(key) || []).filter((x) => x.message_id !== messageId);
  state.pins.set(key, rows);
  return res.json(ok({}));
});

app.get("/chat/groups/my", (req, res) => {
  const me = authUser(req);
  if (!me) return res.status(401).json({ success: false, message: "Invalid token" });
  const rows = [];
  for (const g of state.groups.values()) {
    if (g.members.has(me.id)) {
      rows.push({
        id: g.id,
        name: g.name,
        memberCount: g.members.size,
        role: g.members.get(me.id) || "member",
        createdBy: g.created_by,
        createdAt: g.created_at,
      });
    }
  }
  rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return res.json(ok({ groups: rows }));
});

app.post("/chat/groups/ensure", (req, res) => {
  const me = authUser(req);
  if (!me) return res.status(401).json({ success: false, message: "Invalid token" });
  const groupKey = String(req.body?.groupKey || req.body?.groupId || "").trim();
  if (!groupKey) return res.status(400).json({ success: false, message: "groupKey is required" });
  const g = ensureGroup({ groupKey, actorId: me.id });
  if (!g) return res.status(400).json({ success: false, message: "groupKey is required" });
  return res.json(ok({ group: { id: g.id, name: g.name, created_by: g.created_by, created_at: g.created_at } }));
});

app.get("/chat/groups/:groupId/members", (req, res) => {
  const me = authUser(req);
  if (!me) return res.status(401).json({ success: false, message: "Invalid token" });
  const gid = normalizeGroupId(req.params.groupId);
  const g = state.groups.get(gid);
  if (!g || !g.members.has(me.id)) return res.status(404).json({ success: false, message: "Group not found" });
  const members = [];
  for (const [uid, role] of g.members.entries()) {
    const u = state.users.get(uid);
    if (!u) continue;
    members.push({ userId: uid, role, user: safeUserForClient(u) });
  }
  return res.json(ok({ groupId: gid, members }));
});

app.post("/chat/groups/:groupId/members/add-by-username", (req, res) => {
  const me = authUser(req);
  if (!me) return res.status(401).json({ success: false, message: "Invalid token" });
  const gid = normalizeGroupId(req.params.groupId);
  const g = state.groups.get(gid);
  if (!g || !g.members.has(me.id)) return res.status(404).json({ success: false, message: "Group not found" });
  const myRole = g.members.get(me.id) || "member";
  if (myRole !== "admin") return res.status(403).json({ success: false, message: "Admin only" });
  const username = String(req.body?.username || "").trim();
  if (!username) return res.status(400).json({ success: false, message: "username is required" });
  const existing = [...state.users.values()].find((u) => String(u.username || "").toLowerCase() === username.toLowerCase());
  const user = existing || { id: randId("user"), email: "", username, avatar_url: "", created_at: nowIso(), password: "" };
  if (!existing) {
    state.users.set(user.id, user);
    state.presence.set(user.id, { status: "offline", last_seen: null });
  }
  if (!g.members.has(user.id)) g.members.set(user.id, "member");
  return res.json(ok({ member: { userId: user.id, role: g.members.get(user.id), user: { id: user.id, username: user.username, avatar_url: "" } } }));
});

app.post("/chat/groups/:groupId/members/remove", (req, res) => {
  const me = authUser(req);
  if (!me) return res.status(401).json({ success: false, message: "Invalid token" });
  const gid = normalizeGroupId(req.params.groupId);
  const g = state.groups.get(gid);
  if (!g || !g.members.has(me.id)) return res.status(404).json({ success: false, message: "Group not found" });
  const myRole = g.members.get(me.id) || "member";
  if (myRole !== "admin") return res.status(403).json({ success: false, message: "Admin only" });
  const targetUserId = String(req.body?.userId || req.body?.memberId || "").trim();
  if (!targetUserId) return res.status(400).json({ success: false, message: "userId is required" });
  if (targetUserId === g.created_by) return res.status(400).json({ success: false, message: "Cannot remove group creator" });
  g.members.delete(targetUserId);
  return res.json(ok({}));
});

app.post("/chat/groups/:groupId/members/set-role", (req, res) => {
  const me = authUser(req);
  if (!me) return res.status(401).json({ success: false, message: "Invalid token" });
  const gid = normalizeGroupId(req.params.groupId);
  const g = state.groups.get(gid);
  if (!g || !g.members.has(me.id)) return res.status(404).json({ success: false, message: "Group not found" });
  const myRole = g.members.get(me.id) || "member";
  if (myRole !== "admin") return res.status(403).json({ success: false, message: "Admin only" });
  const targetUserId = String(req.body?.userId || "").trim();
  const role = String(req.body?.role || "").trim();
  if (!targetUserId || !role) return res.status(400).json({ success: false, message: "userId and role are required" });
  if (!g.members.has(targetUserId)) return res.status(404).json({ success: false, message: "Member not found" });
  if (targetUserId === g.created_by && role !== "admin") return res.status(400).json({ success: false, message: "Creator must remain admin" });
  if (role !== "admin" && role !== "member") return res.status(400).json({ success: false, message: "Invalid role" });
  g.members.set(targetUserId, role);
  return res.json(ok({ member: { userId: targetUserId, role } }));
});

// ===== Start =====
app.listen(PORT, () => {
  console.log(`[mock-api] listening on http://localhost:${PORT}`);
});

