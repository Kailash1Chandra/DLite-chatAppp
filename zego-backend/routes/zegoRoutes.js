const express = require("express");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { generateZegoToken } = require("../controllers/zegoController");

const router = express.Router();

// Token generation should only happen on backend.
router.post("/token", authMiddleware, generateZegoToken);

module.exports = router;

