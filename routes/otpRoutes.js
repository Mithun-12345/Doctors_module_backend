const express = require("express");
const otpController = require("../controllers/otpController");
const apiLimiter = require("../middlewares/rateLimiter");
//const validateRefreshToken = require("../middlewares/validateRefreshToken");
const validateToken = require("../middlewares/validateTokenHandler");

const router = express.Router();

router.post("/verifyOTP", otpController.verifyOTP);
router.post("/refreshToken", validateToken, otpController.refreshToken);
router.post("/logout", validateToken, otpController.logout);
router.post("/send-otp", otpController.sendOTP);
router.post("/updatePassword", validateToken, otpController.updatePassword);
router.post(
  "/loginWithPassword",
  otpController.loginWithPassword
);
router.post("/forgotPassword", validateToken, otpController.forgotPassword);
router.post("/resetPassword", validateToken, otpController.resetPassword);
router.post("/login", validateToken, otpController.login);

module.exports = router;
