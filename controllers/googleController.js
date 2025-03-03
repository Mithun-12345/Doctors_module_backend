// controllers/googleController.js
const { google } = require("googleapis");
const jwt = require("jsonwebtoken");
const Doctor=require("../models/doctorModel");

// Configure the Google OAuth client
const googleClient = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "http://localhost:5000/google/callback"
);

exports.googleAuth = (req, res) => {
  const authUrl = googleClient.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar"],
  });
  res.redirect(authUrl);
};

exports.googleCallback = async (req, res) => {
  const code = req.query.code;
  try {
    const { tokens } = await googleClient.getToken(code);
    googleClient.setCredentials(tokens);

    const doctorId = req.user.id;

    // Update the doctor’s profile in the database with the tokens
    await Doctor.findByIdAndUpdate(doctorId, {
      googleAccessToken: tokens.access_token,
      googleRefreshToken: tokens.refresh_token,
    });
    // Save the tokens to the doctor's settings (e.g., in MongoDB)
    // Example: save tokens to req.user's document

    res.redirect("/success"); // Redirect to a success page or dashboard
  } catch (error) {
    console.error("Google callback error:", error);
    res.status(500).json({ error: "Failed to authenticate with Google" });
  }
};
