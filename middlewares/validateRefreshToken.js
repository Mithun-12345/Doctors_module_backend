const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const OTP = require("../models/otpModel");

const validateRefreshToken = asyncHandler(async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (authHeader && authHeader.startsWith("Bearer")) {
    token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ success: false, error: "Refresh token is missing" });
    }

    jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ success: false, error: "Invalid or expired refresh token" });
      }

      const phone = decoded.user.phone;

      // Check if the refresh token exists in the database
      const otpDocument = await OTP.findOne({ phone, refreshToken: token });

      if (!otpDocument) {
        return res.status(403).json({ success: false, error: "Invalid refresh token" });
      }

      // Attach user info to the request object
      req.user = decoded.user;
      next(); // Pass control to the next middleware
    });
  } else {
    return res.status(401).json({ success: false, error: "Authorization header is missing or invalid" });
  }
});

module.exports = validateRefreshToken;
