const asyncHandler = require("express-async-handler");
const twilio = require("twilio");
const jwt = require("jsonwebtoken");
const Chronic = require('../models/chronicModel');
require("dotenv").config();

const OTP = require("../models/otpModel");
const regForm = require("../models/patientModel");
const Doctor = require("../models/doctorModel");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const checkPatient = async (phone) => {
  try {
    const patient = await regForm.findOne({ phone });
    return patient !== null; // Returns true if patient exists, false otherwise
  } catch (err) {
    console.error("Error checking patient:", err);
    throw new Error("Error checking patient");
  }
};


exports.sendOTP = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  try {
    const findDoctor = await Doctor.findOne({ phone });

    if (findDoctor) {
      // Doctor exists, proceed with sending OTP
      const otp = generateOTP();

      await OTP.findOneAndUpdate(
        { phone },
        { otp, expiresAt: Date.now() + 30 * 1000 }, // 30 seconds
        { upsert: true } // Create a new document if one doesn't exist
      );

      // Uncomment to use Twilio for sending OTP
      // client.messages.create({
      //   body: `Your OTP is ${otp}`,
      //   from: "+14159692428", // Replace with your Twilio phone number
      //   to: phone,
      // }).then(() => {
      //   res.status(200).json({ success: true, message: "OTP sent successfully" });
      // }).catch((err) => {
      //   console.error("Twilio error:", err);
      //   res.status(500).json({ success: false, error: "Failed to send OTP" });
      // });

      return res.status(200).json({ success: true, message: "OTP sent successfully", otp });
    } else {
      // Check if the phone number is in the patients collection
      const isPatient = await checkPatient(phone);

      if (isPatient) {
        const otp = generateOTP();

        console.log('Sending OTP to phone:', phone);
        console.log('Generated OTP:', otp);

        await OTP.findOneAndUpdate(
          { phone },
          { otp, expiresAt: Date.now() + 2 * 60 * 1000 },
          { upsert: true }
        );

        console.log('OTP sent and saved in the database');

        // Uncomment to use Twilio for sending OTP
        // await client.messages.create({
        //   body: `Your OTP is ${otp}`,
        //   from: "+17472332995", // Replace with your Twilio phone number
        //   to: phone,
        // });

        return res.status(200).json({ success: true, message: "OTP sent successfully", otp });
      } else {
        return res.status(400).json({ success: false, message: "Phone number not registered" });
      }
    }
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
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
      // Clear the OTP after successful verification
      await OTP.updateOne(
        { phone, otp: userOTP },
        { $set: { otp: "", expiresAt: Date.now() } }
      );
      // const patient = await Chronic.findOne({ phone });
      // if(patient){
      //   res.status(200).json({ success: true, message: "chronicExists" });
      // }else{
      //   res.status(200).json({ success: false, message: "chronic does not Exists" });
      // }
      // Generate access token
      const accessToken = jwt.sign(
        { user: { phone: otpDocument.phone } },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "15m" }
      );

      // Generate refresh token
      const refreshToken = jwt.sign(
        { user: { phone: otpDocument.phone } },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: "7d" } // Refresh token expires in 7 days
      );

      // Save refresh token in the database
      await OTP.updateOne({ phone }, { $set: { refreshToken } });

      res.status(200).json({ success: true, accessToken, refreshToken });
    } else {
      res.status(401).json({ success: false, error: "Invalid or expired OTP" });
    }
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

exports.refreshToken = asyncHandler(async (req, res) => {
  const phone = req.user.phone;

  // Generate a new access token
  const accessToken = jwt.sign(
    { user: { phone } },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "15m" }
  );

  res.status(200).json({ success: true, accessToken });
});

exports.logout = asyncHandler(async (req, res) => {
  const phone = req.user.phone;

  try {
    // Remove the refresh token from the database
    await OTP.updateOne({ phone }, { $unset: { refreshToken: "" } });

    res
      .status(200)
      .json({ success: true, message: "User logged out successfully" });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});
