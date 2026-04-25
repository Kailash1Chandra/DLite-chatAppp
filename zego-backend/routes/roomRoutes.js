const express = require("express");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { createRoom, joinRoom, leaveRoom, getRoom } = require("../controllers/roomController");

const router = express.Router();

router.post("/create", authMiddleware, createRoom);
router.post("/join", authMiddleware, joinRoom);
router.post("/leave", authMiddleware, leaveRoom);
router.get("/:roomID", authMiddleware, getRoom);

module.exports = router;

