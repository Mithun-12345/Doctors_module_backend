const rateLimit = require("express-rate-limit");

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: "Too many OTP requests from this IP, please try again later.",
});

module.exports = apiLimiter;

//for a period of 15 minutes user can make maximum of 5 requests
