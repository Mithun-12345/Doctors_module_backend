const asyncHandler = require("express-async-handler");
const twilio = require("twilio");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
//const Chronic = require("../models/chronicModel");
require("dotenv").config({ path: "./config/.env" });

const OTP = require("../models/otpModel");
const regForm = require("../models/patientModel");
const Doctor = require("../models/doctorModel");
const Patient = require("../models/patientModel");
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
  const { phone, role } = req.body;
  console.log(req.body);

  try {
    let user;
    if (role === "Doctor") {
      user = await Doctor.findOne({ phone });
    } else if (role === "Patient") {
      user = await regForm.findOne({ phone });
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid role specified" });
    }

    if (user) {
      // User exists, proceed with sending OTP
      const otp = generateOTP();

      await OTP.findOneAndUpdate(
        { phone },
        { otp, expiresAt: Date.now() + 2 * 60 * 1000 }, // 2 minutes
        { upsert: true } // Create a new document if one doesn't exist
      );

      console.log(`Sending OTP to ${role} with phone:`, phone);
      console.log("Generated OTP:", otp);

      // Uncomment to use Twilio for sending OTP
      // await client.messages.create({
      //   body: `Your OTP is ${otp}`,
      //   from: "+12512728851", // Replace with your Twilio phone number
      //   to: phone,
      // });

      return res
        .status(200)
        .json({ success: true, message: "OTP sent successfully", otp });
    } else {
      return res.status(400).json({
        success: false,
        message: `Phone number not registered as ${role}`,
      });
    }
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

exports.verifyOTP = asyncHandler(async (req, res) => {
  const { phone, userOTP, userType } = req.body;
  console.log("Received request body:", req.body);

  try {
    const otpDocument = await OTP.findOne({
      phone,
      otp: userOTP,
      expiresAt: { $gt: Date.now() },
    });

    console.log("OTP Document found:", otpDocument);

    if (otpDocument) {
      await OTP.updateOne(
        { phone, otp: userOTP },
        { $set: { otp: "", expiresAt: Date.now() } }
      );

      let user;
      console.log("Searching for user with userType:", userType);

      if (userType === "Doctor") {
        user = await Doctor.findOne({ phone });
      } else if (userType === "Patient") {
        user = await regForm.findOne({ phone });
      } else {
        console.log("Invalid userType specified:", userType);
        return res
          .status(400)
          .json({ success: false, message: "Invalid userType specified" });
      }

      if (!user) {
        console.log("User not found for phone:", phone);
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      const accessToken = jwt.sign(
        { user: { 
          phone: otpDocument.phone, 
          userType,
          userId: user._id
        } },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1d" }
      );

      const refreshToken = jwt.sign(
        { user: { phone: otpDocument.phone, userType } }, 
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: "7d" }
      );

      // const refreshToken = jwt.sign(
      //   { user: { id: user._id, phone: otpDocument.phone, userType } },
      //   process.env.REFRESH_TOKEN_SECRET,
      //   { expiresIn: "7d" }
      // );
      await OTP.updateOne({ phone }, { $set: { refreshToken } });

      console.log("accessToken:", accessToken);
      console.log("Sending successful response");
      console.log("refreshToken:", refreshToken);
      console.log("User role:", user.role);
      console.log("User type:", userType);
      if (userType === "Doctor") {
        res.status(200).json({
          success: true,
          accessToken,
          refreshToken,
          userId: user._id,
          userType: userType,
          role: user.role,
        });
      }
      res.status(200).json({
        success: true,
        accessToken,
        refreshToken,
        userId: user._id,
        userType: userType,
      });
    } else {
      console.log("Invalid or expired OTP for phone:", phone);
      res.status(401).json({ success: false, error: "Invalid or expired OTP" });
    }
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

exports.refreshToken = asyncHandler(async (req, res) => {
  const phone = req.user.phone;

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

//for the first time when the patient saves his password
exports.updatePassword = asyncHandler(async (req, res) => {
  const { phone, password, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10); // Hash the new password

  let user;
  if (role === "Doctor") {
    user = await Doctor.findOneAndUpdate(
      { phone },
      { password: hashedPassword },
      { new: true }
    );
  } else if (role === "Patient") {
    user = await regForm.findOneAndUpdate(
      { phone },
      { password: hashedPassword },
      { new: true }
    );
  } else {
    return res
      .status(400)
      .json({ success: false, message: "Invalid role specified" });
  }

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  res.status(200).json({
    success: true,
    message: "Password updated successfully",
    user,
  });
});

exports.loginWithPassword = asyncHandler(async (req, res) => {
  const { phone, password, role } = req.body;

  let user;

  // Fetch user based on role
  if (role === "Doctor") {
    user = await Doctor.findOne({ phone });
  } else if (role === "Patient") {
    user = await regForm.findOne({ phone });
  } else {
    return res
      .status(400)
      .json({ success: false, message: "Invalid role specified" });
  }

  // User not found or password field missing
  if (!user || !user.password) {
    console.log("User not found");
    return res
      .status(404)
      .json({ success: false, message: "User not found or password not set" });
  }

  // Compare password
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid password" });
  }

  // Extract user fields
  const name = user.name || "";
  const email = user.email || "";
  const roleFromDB = user.role || ""; // for Doctor

  // Create JWT tokens
  const accessToken = jwt.sign(
    {
      user: {
        userId: user._id,
        name,
        email,
        phone,
        userType: role,
        role: roleFromDB,
      },
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "1d" }
  );

  const refreshToken = jwt.sign(
    {
      user: {
        userId: user._id,
        name,
        email,
        phone,
        userType: role,
        role: roleFromDB,
      },
    },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }
  );

  console.log("Sending response:");
  console.log("accessToken:", accessToken);
  console.log("refreshToken:", refreshToken);
  console.log("userId:", user._id);
  console.log("userType:", role);
  console.log("role:", roleFromDB);

  // Send user data to frontend
  return res.status(200).json({
    success: true,
    accessToken,
    refreshToken,
    userId: user._id,
    name,
    email,
    phone,
    userType: role,
    role: roleFromDB,
  });
});

//works along with resetPassword
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { phone, role } = req.body;

  let user;
  if (role === "Doctor") {
    user = await Doctor.findOne({ phone });
  } else if (role === "Patient") {
    user = await regForm.findOne({ phone });
  } else {
    return res
      .status(400)
      .json({ success: false, message: "Invalid role specified" });
  }

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const otp = generateOTP();
  await OTP.findOneAndUpdate(
    { phone },
    { otp, expiresAt: Date.now() + 2 * 60 * 1000 }, // 2 minutes
    { upsert: true }
  );

  // Send OTP via Twilio (Uncomment in production)
  // await client.messages.create({
  //   body: `Your OTP for password reset is ${otp}`,
  //   from: "+12512728851",
  //   to: phone,
  // });

  res
    .status(200)
    .json({ success: true, message: "OTP sent for password reset", otp });
});

//works along with forgotPassword
exports.resetPassword = asyncHandler(async (req, res) => {
  const { phone, userOTP, newPassword, role } = req.body;

  const otpDocument = await OTP.findOne({
    phone,
    otp: userOTP,
    expiresAt: { $gt: Date.now() },
  });

  if (!otpDocument) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired OTP" });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10); // Hash the new password

  if (role === "Doctor") {
    await Doctor.updateOne({ phone }, { $set: { password: hashedPassword } });
  } else if (role === "Patient") {
    await regForm.updateOne({ phone }, { $set: { password: hashedPassword } });
  }

  // Invalidate OTP
  await OTP.updateOne({ phone }, { $set: { otp: "", expiresAt: Date.now() } });

  res.status(200).json({ success: true, message: "Password reset successful" });
});

exports.login = asyncHandler(async (req, res) => {
  const { phone, password, role, loginMethod } = req.body;

  if (loginMethod === "password") {
    return this.loginWithPassword(req, res);
  } else if (loginMethod === "otp") {
    return this.sendOTP(req, res);
  } else {
    res.status(400).json({ success: false, message: "Invalid login method" });
  }
});

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id; // Adjust this based on your authentication method
    console.log(userId);
    let user;
    user = await Doctor.findById(userId); // Exclude sensitive data
    if (!user) {
      user = await regForm.findById(userId);
    }
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const { newPassword, retypedNewPassword } = req.body;
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};
