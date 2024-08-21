const express = require("express");
const {
  sendOTP,
  verifyOTP,
  refreshToken,
  logout,
} = require("../controllers/otpController");
const apiLimiter = require("../middlewares/rateLimiter");
const validateRefreshToken = require("../middlewares/validateRefreshToken");

const router = express.Router();

router.post("/sendOTP", apiLimiter, sendOTP);
router.post("/verifyOTP", verifyOTP);
router.post("/refreshToken", validateRefreshToken, refreshToken);
router.post("/logout", validateRefreshToken, logout);

module.exports = router;
