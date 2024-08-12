const express = require("express");
const { sendOTP, verifyOTP } = require("../controllers/otpController");
const apiLimiter = require("../middlewares/rateLimiter");

const router = express.Router();

router.post("/sendOTP", apiLimiter, sendOTP);
router.post("/verifyOTP", verifyOTP);

module.exports = router;
