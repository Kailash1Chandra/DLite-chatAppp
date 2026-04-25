const express = require("express");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { createRoomHandler, joinRoomHandler, leaveRoomHandler, inviteToRoomHandler } = require("../controllers/roomsController");

const router = express.Router();

// POST /api/rooms
router.post("/", authMiddleware, createRoomHandler);

// POST /api/rooms/join
router.post("/join", authMiddleware, joinRoomHandler);

// POST /api/rooms/leave
router.post("/leave", authMiddleware, leaveRoomHandler);

// POST /api/rooms/invite
router.post("/invite", authMiddleware, inviteToRoomHandler);

module.exports = router;

