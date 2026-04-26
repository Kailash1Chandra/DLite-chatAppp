const { createClient } = require("@supabase/supabase-js");

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is missing`);
  return value;
}

function buildSupabaseClient(key) {
  const url = requireEnv("SUPABASE_URL");
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

const supabasePublic = (() => {
  const anonKey = requireEnv("SUPABASE_ANON_KEY");
  return buildSupabaseClient(anonKey);
})();

const supabaseAdmin = (() => {
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return buildSupabaseClient(serviceKey);
})();

async function getUserByID(userID) {
  const id = String(userID || "").trim()
  if (!id) return null
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(id)
    if (error || !data?.user) return null
    return data.user
  } catch {
    return null
  }
}

module.exports = { supabasePublic, supabaseAdmin, requireEnv, getUserByID };

