const { HttpError } = require("../utils/httpError");
const { supabase } = require("../services/supabaseClient");
const { ensureUserSynced } = require("../services/userSyncService");

function extractBearerToken(req) {
  const header = String(req.headers.authorization || "");
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

async function authMiddleware(req, _res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) throw new HttpError(401, "Missing Authorization Bearer token");

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) throw new HttpError(401, "Invalid or expired Supabase JWT");

    req.user = data.user;

    // Optional sync: create users row if missing (safe no-op if table doesn't exist).
    await ensureUserSynced(data.user).catch(() => undefined);

    return next();
  } catch (e) {
    return next(e);
  }
}

module.exports = { authMiddleware, extractBearerToken };

