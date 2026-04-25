const { supabasePublic } = require("../config/supabase");
const { HttpError } = require("../utils/httpError");

function extractBearerToken(req) {
  const header = String(req.headers.authorization || "");
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

async function authMiddleware(req, _res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) throw new HttpError(401, "Missing Authorization Bearer token");

    const { data, error } = await supabasePublic.auth.getUser(token);
    if (error || !data?.user) throw new HttpError(401, "Invalid or expired Supabase JWT");

    req.user = data.user;
    return next();
  } catch (e) {
    return next(e);
  }
}

module.exports = { authMiddleware, extractBearerToken };

