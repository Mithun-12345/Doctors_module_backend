const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const Patient = require("../models/patientModel");
const Doctor = require("../models/doctorModel");
const Admin = require("../models/Admin");

const validateToken = asyncHandler(async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization || req.headers.Authorization;
  console.log(authHeader);
  if (authHeader && authHeader.startsWith("Bearer")) {
    token = authHeader.split(" ")[1];
    console.log("Token:", token);
    if (!token) {
      return res
        .status(401)
        .json({
          success: false,
          error: "User is not authorized or token is missing",
        });
    }

    try {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      console.log("Decoded token:", decoded);

      // Check if decoded has a phone property directly
      let user;
      // console.log("Decoded phone:", decoded.user.phone);
      if (decoded.phone) {
        user = await Patient.findOne({ phone: decoded.phone });
        // console.log("Patient found:", user);
      } else if (decoded.user && decoded.user.phone) {
        user = await Patient.findOne({ phone: decoded.user.phone });
        // console.log("Patient found:", user);
      } else {
        return res
          .status(401)
          .json({ success: false, error: "Invalid token structure" });
      }

      // If not a patient, check for doctor
      if (!user && decoded.user && decoded.user.phone) {
        user = await Doctor.findOne({ phone: decoded.user.phone }); //Initially it was : user = await Doctor.findOne({ phone: decoded.phone });
        // console.log("Doctor found:", user);
      }
      if (!user) {
        user = await Doctor.findOne({ phone: decoded.phone }); //Initially it was : user = await Doctor.findOne({ phone: decoded.phone });
        // console.log("Doctor found:", user);
      }

      // If still not found, check for admin
      if (!user) {
        user = await Admin.findOne({ phone: decoded.user.phone });
        // console.log("Admin found:", user);
      }

      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      // Attach the found user object to the request
      req.user = user;
      next();
    } catch (error) {
      console.error("Token verification error:", error);
      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({ success: false, error: "Invalid token" });
      }
      return res.status(500).json({ success: false, error: "Server error" });
    }
  } else {
    return res
      .status(401)
      .json({
        success: false,
        error: "Authorization header is missing or invalid",
      });
  }
});

module.exports = validateToken;
