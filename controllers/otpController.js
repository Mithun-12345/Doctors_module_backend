const asyncHandler = require("express-async-handler");
const twilio = require("twilio");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const OTP = require("../models/otpModel");
const regForm = require("../models/patientModel");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

exports.sendOTP = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  try {
    const findPhone = await regForm.findOne({ phone });

    if (findPhone) {
      const otp = generateOTP();

      // Update existing OTP if it exists
      await OTP.findOneAndUpdate(
        { phone },
        {
          otp,
          expiresAt: Date.now() + 30 * 1000, // 30 seconds
        },
        { upsert: true } // Create a new document if one doesn't exist
      );

      // Send OTP via Twilio
      // client.messages
      //   .create({
      //     body: `Your OTP is ${otp}`,
      //     from: "+14159692428", // Replace with your Twilio phone number
      //     to: phone,
      //   })
      //   .then(() => {
      //     res.status(200).json({ success: true, message: "OTP sent successfully" });
      //   })
      //   .catch((err) => {
      //     console.error("Twilio error:", err);
      //     res.status(500).json({ success: false, error: "Failed to send OTP" });
      //   });
    } else {
      res
        .status(400)
        .json({ success: false, message: "Phone number not registered" });
    }
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

exports.verifyOTP = asyncHandler(async (req, res) => {
  const { phone, userOTP } = req.body;

  try {
    const otpDocument = await OTP.findOne({
      phone,
      otp: userOTP,
      expiresAt: { $gt: Date.now() }, // Check if OTP is not expired
    });

    if (otpDocument) {
      // Update OTP field to null or an empty string after successful verification
      await OTP.updateOne(
        { phone, otp: userOTP },
        { $set: { otp: '', expiresAt: Date.now() } } // Set OTP to empty and update expiresAt to current time
      );

      const accessToken = jwt.sign(
        {
          user: {
            phone: otpDocument.phone,
          },
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "15m" }
      );

      res.status(200).json({ success: true, accessToken });
    } else {
      res.status(401).json({ success: false, error: "Invalid or expired OTP" });
    }
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});
