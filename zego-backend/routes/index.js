const express = require("express");

const zegoRoutes = require("./zegoRoutes");
const roomRoutes = require("./roomRoutes");

const router = express.Router();

router.use("/zego", zegoRoutes);
router.use("/room", roomRoutes);

module.exports = router;

