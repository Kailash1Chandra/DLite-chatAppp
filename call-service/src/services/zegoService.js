const { generateToken04 } = require("./zegoServerAssistant");
const { requireEnv } = require("../config/supabase");

const ONE_HOUR_SECONDS = 60 * 60;

function generateZegoToken(userID, username) {
  const appID = Number(requireEnv("ZEGO_APP_ID"));
  const serverSecret = String(requireEnv("ZEGO_SERVER_SECRET"));

  // Basic token: payload empty.
  // For strict permissions, generate payload JSON per ZEGO docs.
  const payload = "";
  const token = generateToken04(appID, userID, serverSecret, ONE_HOUR_SECONDS, payload);
  return { token, appID, userID, username, expiresIn: ONE_HOUR_SECONDS };
}

module.exports = { generateZegoToken, ONE_HOUR_SECONDS };

