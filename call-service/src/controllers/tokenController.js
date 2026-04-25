const { tokenRateLimiter } = require("../middlewares/rateLimit");
const { generateZegoToken } = require("../services/zegoService");

async function getToken(req, res, next) {
  tokenRateLimiter(req, res, async (rateErr) => {
    if (rateErr) return next(rateErr);
    try {
      // Security: never accept userID from frontend.
      const userID = String(req.user?.id || "").trim();
      const username = String(req.user?.email || req.user?.user_metadata?.username || "User").trim();

      const out = generateZegoToken(userID, username);
      res.json({ ok: true, token: out.token, appID: out.appID, userID: out.userID });
    } catch (e) {
      next(e);
    }
  });
}

module.exports = { getToken };

