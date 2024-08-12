const mongoose = require("mongoose");

// Define the OTP schema
const otpSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true, // Ensure phone numbers are unique
  },
  otp: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true // Ensure expiry time is required
  },
});

// Create the OTP model
const OTP = mongoose.model("OTP", otpSchema);

module.exports = OTP;
