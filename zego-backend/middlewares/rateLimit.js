const rateLimit = require("express-rate-limit");

const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for token endpoint specifically.
const tokenRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { apiRateLimiter, tokenRateLimiter };

