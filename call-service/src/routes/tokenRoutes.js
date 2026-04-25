const express = require("express");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { getToken } = require("../controllers/tokenController");

const router = express.Router();

// POST /api/token
router.post("/token", authMiddleware, getToken);

module.exports = router;

