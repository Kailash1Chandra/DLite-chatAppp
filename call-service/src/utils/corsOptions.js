function parseAllowedOrigins() {
  const raw = String(process.env.ALLOWED_ORIGINS || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const allowedOrigins = parseAllowedOrigins();
const isProd = String(process.env.NODE_ENV || "").trim() === "production"

if (isProd && allowedOrigins.length === 0) {
  console.error('[cors] NODE_ENV=production but ALLOWED_ORIGINS is empty. Blocking browser origins (allowing only no-origin requests).')
}

const corsOptions = {
  origin(origin, cb) {
    // Allow non-browser clients (curl, server-to-server)
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0) {
      if (isProd) return cb(new Error("CORS not configured"), false)
      return cb(null, true)
    }
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"), false);
  },
  credentials: true,
};

module.exports = { corsOptions };

