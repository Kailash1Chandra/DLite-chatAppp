const { generateToken04 } = require("./zegoServerAssistant");

const ONE_HOUR_SECONDS = 60 * 60;

function getZegoConfig() {
  const appID = Number(process.env.ZEGO_APP_ID);
  const serverSecret = String(process.env.ZEGO_SERVER_SECRET || "").trim();
  if (!appID || Number.isNaN(appID)) throw new Error("ZEGO_APP_ID is missing or invalid");
  if (!serverSecret) throw new Error("ZEGO_SERVER_SECRET is missing");
  return { appID, serverSecret };
}

async function createZegoToken({ userID, username }) {
  const { appID, serverSecret } = getZegoConfig();

  // Beginner-friendly default: basic token (empty payload).
  // For strict room permissions, pass a payload JSON as per ZEGO docs.
  const payload = "";
  const token = generateToken04(appID, userID, serverSecret, ONE_HOUR_SECONDS, payload);

  return { token, appID, expiresIn: ONE_HOUR_SECONDS, username };
}

module.exports = { createZegoToken, ONE_HOUR_SECONDS };

