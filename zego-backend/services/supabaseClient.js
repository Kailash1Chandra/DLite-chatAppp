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

// Public client (anon key) - used to validate Supabase JWT via auth.getUser(token)
const supabase = (() => {
  const anonKey = requireEnv("SUPABASE_ANON_KEY");
  return buildSupabaseClient(anonKey);
})();

// Admin client (service role) - used for server-side inserts/updates
const supabaseAdmin = (() => {
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return buildSupabaseClient(serviceKey);
})();

module.exports = { supabase, supabaseAdmin };

