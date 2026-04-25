const { supabaseAdmin } = require("./supabaseClient");

/**
 * Optional DB room management.
 *
 * Expected tables:
 * - rooms: { id (text pk), created_by (uuid), created_at (timestamptz default now()) }
 * - room_members: { id (bigint/uuid), room_id (text), user_id (uuid) }
 *
 * If tables do not exist or policy blocks, we silently no-op.
 */

async function tryInsertRoom({ roomID, createdBy }) {
  if (!roomID || !createdBy) return;
  const res = await supabaseAdmin.from("rooms").insert({ id: roomID, created_by: createdBy });
  if (res?.error) return;
}

async function tryInsertMembership({ roomID, userID }) {
  if (!roomID || !userID) return;
  const res = await supabaseAdmin.from("room_members").insert({ room_id: roomID, user_id: userID });
  if (res?.error) return;
}

async function tryDeleteMembership({ roomID, userID }) {
  if (!roomID || !userID) return;
  const res = await supabaseAdmin.from("room_members").delete().eq("room_id", roomID).eq("user_id", userID);
  if (res?.error) return;
}

module.exports = { tryInsertRoom, tryInsertMembership, tryDeleteMembership };

