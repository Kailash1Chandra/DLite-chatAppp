const express = require("express");

const tokenRoutes = require("./tokenRoutes");
const roomRoutes = require("./roomRoutes");

const router = express.Router();

router.use("/", tokenRoutes);
router.use("/rooms", roomRoutes);

module.exports = router;

