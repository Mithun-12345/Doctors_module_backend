const axios = require("axios");
const { ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_REDIRECT_URI, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
const DoctorModel = require("../models/doctorModel");
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

// Zoom OAuth Authorization
const zoomAuthorize = (req, res) => {
  const url = `https://zoom.us/oauth/authorize?response_type=code&client_id=${ZOOM_CLIENT_ID}&redirect_uri=${ZOOM_REDIRECT_URI}`;
  console.log(url);
  res.redirect(url);
};

// Zoom OAuth Callback
const zoomCallback = async (req, res) => {
  console.log("Call back called");
  const code = req.query.code;
  const doctorId = "67bc3391654d85340a8ce713";
  try {
    const response = await axios.post("https://zoom.us/oauth/token", null, {
      params: {
        code,
        client_id: ZOOM_CLIENT_ID,
        client_secret: ZOOM_CLIENT_SECRET,
        redirect_uri: ZOOM_REDIRECT_URI,
        grant_type: "authorization_code",
      },
      headers: {
        Authorization: `Basic ${Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString("base64")}`,
      },
    });

    const { access_token, refresh_token } = response.data;
    console.log("Zoom Access Token:", access_token);
    console.log("Zoom Refresh Token:", refresh_token);

    const doctor = await DoctorModel.findById(doctorId);
    if (!doctor) {
      throw new Error("Doctor not found");
    }

    doctor.zoomAccessToken = access_token;
    doctor.zoomRefreshToken = refresh_token;
    await doctor.save();

    res.send("Zoom OAuth Flow Completed Successfully!");
  } catch (error) {
    console.error("Zoom OAuth Error:", error);
    res.status(500).send("Error in Zoom OAuth flow");
  }
};

// Google OAuth Authorization
const googleAuthorize = (req, res) => {
  const url = `https://accounts.google.com/o/oauth2/v2/auth?scope=https://www.googleapis.com/auth/calendar&access_type=offline&response_type=code&redirect_uri=${GOOGLE_REDIRECT_URI}&client_id=${GOOGLE_CLIENT_ID}`;
  console.log(url);
  res.redirect(url);
};

// Google OAuth Callback
const googleCallback = async (req, res) => {
  const code = req.query.code;
  const doctorId = "67bc3391654d85340a8ce713";
  try {
    const response = await axios.post("https://oauth2.googleapis.com/token", {
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    });

    const { access_token, refresh_token } = response.data;
    console.log("Google Access Token:", access_token);
    console.log("Google Refresh Token:", refresh_token);

    const doctor = await DoctorModel.findById(doctorId);
    if (!doctor) {
      throw new Error("Doctor not found");
    }

    doctor.googleAccessToken = access_token;
    // doctor.googleRefreshToken = refresh_token;
    await doctor.save();

    res.send("Google OAuth Flow Completed Successfully!");
  } catch (error) {
    console.error("Google OAuth Error:", error);
    res.status(500).send("Error in Google OAuth flow");
  }
};

const generateSignature = async (req, res) => {
  try {
    console.log("Generate Signature Endpoint reached");
    const { meetingNumber, role } = req.body;
    
    // Verify required parameters
    if (!meetingNumber || role === undefined) {
      return res.status(400).json({ success: false, message: 'Meeting number and role are required' });
    }
    
    // Get API Key and API Secret from environment variables
    const apiKey = process.env.ZOOM_SDK_KEY;
    const apiSecret = process.env.ZOOM_SDK_SECRET;
    
    if (!apiKey || !apiSecret) {
      return res.status(500).json({ 
        success: false, 
        message: 'Zoom API credentials not configured'
      });
    }
    
    // Get user info from authenticated request
    const userEmail = req.user.email || 'email';
    const userName = req.user.firstName + ' ' + req.user.lastName || 'Doctor';
    
    // Timestamp for signature generation (expiration)
    const timestamp = new Date().getTime() - 30000;
    
    // Prepare the message for signature
    const msg = Buffer.from(apiKey + meetingNumber + timestamp + role).toString('base64');
    const hash = crypto.createHmac('sha256', apiSecret).update(msg).digest('base64');
    const signature = Buffer.from(`${apiKey}.${meetingNumber}.${timestamp}.${role}.${hash}`).toString('base64');
    
    // Return the signature and connection info
    return res.status(200).json({
      success: true,
      signature: signature,
      apiKey: apiKey,
      meetingNumber: meetingNumber,
      userName: userName,
      userEmail: userEmail,
      // Include password if the meeting has one
      password: '' // Add logic to retrieve meeting password if needed
    });
  } catch (error) {
    console.error('Error generating Zoom signature:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate Zoom signature',
      error: error.message
    });
  }
};

module.exports = {
  zoomAuthorize,
  zoomCallback,
  googleAuthorize,
  googleCallback,
  generateSignature
};
