const { generateZegoToken } = require("../services/zegoService");
const { getDisplayName } = require("../utils/displayName")

async function getToken(req, res, next) {
  try {
    // Security: never accept userID from frontend.
    const userID = String(req.user?.id || "").trim()
    const username = getDisplayName(req.user)

    const out = generateZegoToken(userID, username)
    res.json({ ok: true, token: out.token, appID: out.appID, userID: out.userID })
  } catch (e) {
    next(e)
  }
}

module.exports = { getToken };

