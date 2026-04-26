import { CallMode } from "@/types/call";

function normalizeRoomParticipant(value: string) {
  return String(value || "").trim().replaceAll("/", "_");
}

export function buildDirectCallRoomId(userA: string, userB: string) {
  const ids = [normalizeRoomParticipant(userA), normalizeRoomParticipant(userB)].filter(Boolean).sort();
  if (ids.length !== 2) return "";
  return `dm-${ids[0]}--${ids[1]}`;
}

export function buildHostedCallUrl(roomId: string, mode: CallMode, opts?: { admin?: boolean }) {
  const params = new URLSearchParams();
  params.set("mode", mode);
  if (opts?.admin) params.set("admin", "1");
  const query = params.toString();
  return `/call/${encodeURIComponent(roomId)}${query ? `?${query}` : ""}`;
}

// Deterministic hosted room id for group chats (so "Group call" always joins same room).
export function buildGroupChatCallRoomId(groupId: string) {
  const id = normalizeRoomParticipant(groupId);
  if (!id) return "";
  return `group-${id}`;
}

function sanitizeInviteCode(value: string) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

export function formatInviteCode(value: string) {
  const code = sanitizeInviteCode(value);
  if (!code) return "";
  if (code.length <= 4) return code;
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function generateInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return formatInviteCode(code);
}

export function buildGroupCallRoomId(inviteCode: string) {
  const code = sanitizeInviteCode(inviteCode);
  if (code.length < 6) return "";
  return `room-${code}`;
}

export function getInviteCodeFromRoomId(roomId: string) {
  const raw = String(roomId || "").trim();
  if (!raw.startsWith("room-")) return "";
  return formatInviteCode(raw.slice(5));
}
