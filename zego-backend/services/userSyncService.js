const { supabaseAdmin } = require("./supabaseClient");

/**
 * Optional user sync.
 * - If table `users` exists, ensure a row for this Supabase user.
 * - If table doesn't exist / RLS blocks, we silently skip (beginner-friendly).
 *
 * Expected table (suggested):
 *   users: { id (uuid pk), email (text), created_at (timestamptz default now()) }
 */
async function ensureUserSynced(user) {
  if (!user?.id) return;

  const id = user.id;
  const email = user.email || null;

  // Try a cheap select; if it errors (table missing), skip.
  const existing = await supabaseAdmin.from("users").select("id").eq("id", id).maybeSingle();
  if (existing?.error) return;
  if (existing?.data?.id) return;

  // Insert if missing.
  const insertRes = await supabaseAdmin.from("users").insert({ id, email });
  if (insertRes?.error) return;
}

module.exports = { ensureUserSynced };

