const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const Patient = require("../models/patientModel");
const Doctor = require("../models/doctorModel");
const Admin = require("../models/Admin");

const validateToken = asyncHandler(async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (authHeader && authHeader.startsWith("Bearer")) {
    token = authHeader.split(" ")[1];

    try {
      // 1. Verify the token with the correct secret
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

      // 2. Check for the correct payload structure
      if (!decoded.user || !decoded.user.phone) {
        return res.status(401).json({ success: false, error: "Invalid token structure" });
      }

      const { phone } = decoded.user;

      // 3. Sequentially search for the user in all collections
      // This logic is the same as your original, just more concise.
      const user =
        (await Patient.findOne({ phone })) ||
        (await Doctor.findOne({ phone })) ||
        (await Admin.findOne({ phone }));

      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      // 4. Attach user to the request and continue
      req.user = user;
      next();

    } catch (error) {
      console.error("Token verification error:", error);
      return res.status(401).json({ success: false, error: "User is not authorized" });
    }
  }

  if (!token) {
    res.status(401).json({ success: false, error: "Authorization token is missing" });
  }
});

module.exports = validateToken;