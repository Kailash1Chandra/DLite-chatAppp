const { HttpError } = require("../utils/httpError");
const { createZegoToken } = require("../services/zegoTokenService");
const { tokenRateLimiter } = require("../middlewares/rateLimit");

// Apply stricter limiter only to this handler
// (Express allows middleware arrays, but we keep it explicit here)
async function generateZegoToken(req, res, next) {
  tokenRateLimiter(req, res, async (rateErr) => {
    if (rateErr) return next(rateErr);
    try {
      // CRITICAL: never trust frontend userID. Always derive from Supabase auth user.
      const userID = String(req.user?.id || "").trim();
      const username = String(
        req.user?.email ||
          req.user?.user_metadata?.username ||
          req.user?.user_metadata?.full_name ||
          req.user?.user_metadata?.name ||
          "User"
      ).trim();

      if (!userID) throw new HttpError(401, "Unauthorized");

      const out = await createZegoToken({ userID, username });
      res.json({ ok: true, token: out.token, appID: out.appID, userID });
    } catch (e) {
      next(e);
    }
  });
}

module.exports = { generateZegoToken };

