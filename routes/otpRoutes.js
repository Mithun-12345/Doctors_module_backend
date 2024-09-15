const express = require("express");
const otpController = require("../controllers/otpController");
const apiLimiter = require("../middlewares/rateLimiter");
const validateRefreshToken = require("../middlewares/validateRefreshToken");

const router = express.Router();

// router.post("/sendOTP", apiLimiter, sendOTP);
router.post("/verifyOTP", otpController.verifyOTP);
router.post("/refreshToken", validateRefreshToken, otpController.refreshToken);
router.post("/logout", validateRefreshToken, otpController.logout);
router.post('/send-otp', apiLimiter, otpController.sendOTP);

module.exports = router;