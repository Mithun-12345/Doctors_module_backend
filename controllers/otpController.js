require("dotenv").config({ path: "./config/.env" });
const asyncHandler = require("express-async-handler");
const twilio = require("twilio");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
//const Chronic = require("../models/chronicModel");
const MedPrep = require("../models/medPrepUserDetails");
const crypto = require("crypto");
const OTP = require("../models/otpModel");
const regForm = require("../models/patientModel");
const Doctor = require("../models/doctorModel");
const Patient = require("../models/patientModel");
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);
const { sendPasswordResetEmail } = require('../services/emailService');


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
  console.log("sendOTP: ", req.body);

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
  } else if (role === "Med-Prep") {
    user = await MedPrep.findOne({ phone });
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
  const email =
    role === "Med-Prep" ? user.personalEmail || "" : user.email || "";
  const roleFromDB = user.role || "";

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
/*exports.forgotPassword = asyncHandler(async (req, res) => {
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
});*/

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
    const userId = req.user.id;
    const { oldPassword, newPassword, retypedNewPassword } = req.body;

    // 1. Find the logged-in user
    let user = await Doctor.findById(userId).select('+password');
    if (!user) {
      // Assuming 'regForm' is your Patient model
      user = await regForm.findById(userId).select('+password');
    }
    if (!user || !user.password) {
      return res.status(404).json({ message: "User not found or password not set." });
    }

    // 2. Verify the old password is correct
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect old password." });
    }

    // 3. Check if the new passwords match and are valid
    if (newPassword !== retypedNewPassword) {
      return res.status(400).json({ message: "Confirmation Password does not match the new password." });
    }
    if (oldPassword === newPassword) {
      return res.status(400).json({ message: "New password cannot be the same as the old password." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }

    // 4. Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // --- NEW LOGIC ADDED HERE ---
    // 5. Prepare the data for the update
    let updateData = {
      password: hashedPassword,
    };

    // If the user needs a password reset, add that to the update operation
    if (user.requiresPasswordReset === true) {
      updateData.requiresPasswordReset = false;
    }
    // ----------------------------

    // 6. Save the new password and potentially the reset flag
    await user.constructor.findByIdAndUpdate(userId, updateData);

    res.status(200).json({ success: true, message: "Password changed successfully." });

  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
// In otpController.js
exports.setPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;

  // Validation logic remains the same...
  if (!password || !confirmPassword || password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match or are not provided." });
  }

  const hashedToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  
  const query = {
    passwordSetToken: hashedToken,
    passwordSetExpires: { $gt: Date.now() },
  };

  // --- MODIFIED LOGIC ---
  // 1. Look for the user in the Patient collection first
  let user = await Patient.findOne(query);
  let userType = 'Patient';

  // 2. If not found, look in the Doctor collection
  if (!user) {
    user = await Doctor.findOne(query);
    userType = 'Doctor';
  }
  // --- END OF MODIFIED LOGIC ---

  if (!user) {
    return res.status(400).json({ message: "Token is invalid or has expired." });
  }

  // The rest of the logic remains the same!
  user.password = password;
  user.requiresPasswordReset = false;
  await user.save();

  // Create JWT payload with the correct role
  const payload = {
    user: {
      id: user._id,
      phone: user.phone,
      userType: userType
    }
  };

  const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
  const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

  res.status(200).json({
    success: true,
    message: "Password has been set successfully.",
    accessToken: accessToken,
    refreshToken: refreshToken,
    userId: user._id,
    name: user.name,
  });
});
// --- Configuration for login attempts ---
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MINUTES = 15;

exports.loginUser = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: "Please provide an identifier and password." });
    }

    const query = { $or: [{ email: identifier }, { phone: identifier }] };
    
    let user = await Patient.findOne(query);
    let role = 'Patient';

    if (!user) {
      user = await Doctor.findOne(query);
      role = 'Doctor';
    }

    if (!user || !user.password) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // --- 1. CHECK IF ACCOUNT IS CURRENTLY LOCKED ---
    if (user.lockUntil && user.lockUntil > Date.now()) {
        const remainingTime = Math.ceil((user.lockUntil - Date.now()) / 60000);
        return res.status(429).json({ // 429: Too Many Requests
            message: `Too many failed attempts. Your account is locked. Please try again in ${remainingTime} minutes.`
        });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      // --- 2. HANDLE FAILED LOGIN ATTEMPT ---
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      
      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
          user.lockUntil = Date.now() + LOCK_TIME_MINUTES * 60 * 1000;
          await user.save();
          return res.status(429).json({
              message: `Invalid credentials. Your account is now locked for ${LOCK_TIME_MINUTES} minutes.`
          });
      } else {
          await user.save();
          const attemptsLeft = MAX_LOGIN_ATTEMPTS - user.loginAttempts;
          return res.status(401).json({ message: `Invalid credentials. You have ${attemptsLeft} attempts left.` });
      }
    }

    // --- 3. HANDLE SUCCESSFUL LOGIN: RESET ATTEMPTS AND LOCK ---
    user.loginAttempts = 0;
    user.lockUntil = null; // Or undefined
    user.lastLoginAt = new Date();

    // --- Check and set the first login timestamp for patients ---
    if (role === 'Patient' && !user.firstLoginDone) {
      user.firstLoginTime = new Date();
      user.firstLoginDone = true;
    }
    
    // --- Save all changes for the successful login at once ---
    await user.save();
    
    // --- LOGIC RESTRUCTURED FROM HERE (Your existing logic) ---

    // 1. Always create tokens and save the refresh token after a successful password match.
    const payload = {
      user: {
        id: user._id,
        phone: user.phone,
        userType: role
      }
    };

    const accessToken = jwt.sign(
      payload,
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1d' }
    );

    const refreshToken = jwt.sign(
      payload,
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    );
    
    await OTP.findOneAndUpdate(
      { phone: user.phone },
      { refreshToken: refreshToken },
      { upsert: true, new: true }
    );

    // 2. Build the base response object with all user data.
    const finalResponse = {
      success: true,
      accessToken:  accessToken,
      refreshToken: refreshToken,
      userId: user._id,
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      userType: role,
      role: user.role || ''
    };

    // 3. Conditionally add the password reset flag and update the message.
    if (role === 'Patient' && user.requiresPasswordReset) {
      finalResponse.requiresPasswordReset = true;
      finalResponse.message = "Login successful, but you must reset your password.";
    } else {
      finalResponse.message = "Logged in successfully!";
    }

    // 4. Send the single, complete response.
    res.status(200).json(finalResponse);

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login." });
  }
};

// --- NEW: Helper function to convert milliseconds to "Xh Ym" format ---
const msToHoursMinutes = (ms) => {
    if (!ms || ms <= 0) {
        return "0h 0m";
    }
    const totalMinutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
};

/**
 * @desc    Get a final, overall summary of key clinic analytics.
 * @route   GET /api/analytics/overall-summary
 * @access  Private (Admin)
 */
exports.getOverallClinicAnalytics = async (req, res) => {
    try {
        const [
            loginStats,
            prescriptionStats,
            callStats,
            feedbackStats
        ] = await Promise.all([
            // 1. Calculate average time from registration to first login
            Patient.aggregate([
                { $match: { firstLoginDone: true, firstLoginTime: { $ne: null } } },
                { $project: { timeToLogin: { $subtract: ["$firstLoginTime", "$createdAt"] } } },
                { $group: { _id: null, avgTimeToLogin: { $avg: "$timeToLogin" } } }
            ]),
            // The other 3 aggregations remain exactly the same
            Prescription.aggregate([
                { $group: {
                    _id: null,
                    totalPrescriptions: { $sum: 1 },
                    prescriptionsWithRevisions: {
                        $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ["$subPrescriptionID", []] } }, 0] }, 1, 0] }
                    }
                }},
                { $project: {
                    _id: 0,
                    revisionRate: {
                        $cond: {
                            if: { $gt: ["$totalPrescriptions", 0] },
                            then: { $multiply: [{ $divide: ["$prescriptionsWithRevisions", "$totalPrescriptions"] }, 100] },
                            else: 0
                        }
                    }
                }}
            ]),
            Patient.aggregate([
                { $group: { _id: null, avgCallsReceived: { $avg: "$phoneReceived" } } }
            ]),
            Feedback.aggregate([
                { $group: { _id: null, avgCommunicationScore: { $avg: "$ratings.communication" } } }
            ])
        ]);

        const avgTimeToLoginMs = loginStats[0]?.avgTimeToLogin || 0;
        const prescriptionRevisionRate = prescriptionStats[0]?.revisionRate || 0;
        const avgCallsPerPatient = callStats[0]?.avgCallsReceived || 0;
        const avgCommunicationScore = feedbackStats[0]?.avgCommunicationScore || 0;

        // --- MODIFIED: Assemble the final summary object with the new format ---
        const summary = {
            averageTimeToFirstLogin: msToHoursMinutes(avgTimeToLoginMs), // Using the new helper
            prescriptionRevisionRatePercentage: parseFloat(prescriptionRevisionRate.toFixed(2)),
            averageCallsPerPatient: parseFloat(avgCallsPerPatient.toFixed(2)),
            averageCommunicationScore: parseFloat(avgCommunicationScore.toFixed(1))
        };

        res.status(200).json({
            success: true,
            summary
        });

    } catch (error) {
        console.error("Error fetching overall clinic analytics:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
// In otpController.js
exports.forgotPassword = asyncHandler(async (req, res) => {
  // 1. Get only the identifier from the request body
  const { identifier } = req.body;

  if (!identifier) {
    return res.status(400).json({ message: "Please provide an email or phone number." });
  }

  let user;

  // 2. First, try to find a Patient with the identifier
  const patientQuery = { $or: [{ email: identifier }, { phone: identifier }] };
  user = await Patient.findOne(patientQuery);

  // 3. If no Patient is found, try to find a Doctor
  if (!user) {
    // Note: The Doctor model uses 'personalEmail'
    const doctorQuery = { $or: [{ personalEmail: identifier }, { phone: identifier }] };
    user = await Doctor.findOne(doctorQuery);
  }
  
  // The rest of the logic remains the same
  if (user) {
    try {
      const resetToken = user.createPasswordSetToken();
      await user.save({ validateBeforeSave: false });

      const resetUrl = `https://consult-homeopathy.vercel.app/set-password/${resetToken}`;
      
      // 4. Use the correct email field from the found user object
      const emailToSend = user.email || user.personalEmail;
      await sendPasswordResetEmail(emailToSend, resetUrl);
      
    } catch (error) {
        console.error("Forgot password error:", error);
    }
  }

  res.status(200).json({
    success: true,
    message: "If an account with that identifier exists, a password reset link has been sent.",
  });
});