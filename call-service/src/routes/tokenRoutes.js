const express = require("express");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { tokenRateLimiter } = require("../middlewares/rateLimit")
const { getToken } = require("../controllers/tokenController");

const router = express.Router();

// POST /api/token
router.post("/token", authMiddleware, tokenRateLimiter, getToken);

module.exports = router;

