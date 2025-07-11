const axios = require("axios");
const { google } = require("googleapis");
const Doctor = require("../models/doctorModel");
const clientId = process.env.ZOOM_CLIENT_ID;
const clientSecret = process.env.ZOOM_CLIENT_SECRET;
const zoomTokenUrl = "https://zoom.us/oauth/token";
const redirectUri = "http://localhost:5000/zoom/callback";

// Redirect to Zoom OAuth Authorization URL
exports.zoomAuth = (req, res) => {
  const authUrl = `https://zoom.us/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;
  res.redirect(authUrl);
};

// Zoom Callback Handler
exports.zoomCallback = async (req, res) => {
  const code = req.query.code;

  try {
    const response = await axios.post(zoomTokenUrl, null, {
      params: {
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      },
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
    });

    const { access_token, refresh_token, expires_in } = response.data;
    const doctorId = req.user.id;

    // Save access token, refresh token, and expiration time to doctor model
    await Doctor.findByIdAndUpdate(doctorId,{
        zoomAccessToken: access_token,
        zoomRefreshToken: refresh_token,
        zoomTokenExpiration: Date.now() + expires_in * 1000,
      },
      { new: true }
    );

    res.redirect("/success");
  } catch (error) {
    console.error("Zoom callback error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to authenticate with Zoom" });
  }
};
// Helper to Verify and Refresh Zoom Token if Needed

// exports.verifyAndRefreshZoomToken = async (doctorId) => {
//   const doctor = await Doctor.findById(doctorId);
//   if (!doctor || !doctor.zoomAccessToken || !doctor.zoomRefreshToken) {
//     throw new Error("Doctor does not have Zoom tokens");
//   }

//   if (Date.now() > doctor.zoomTokenExpiration) {
//     try {
//       const response = await axios.post(zoomTokenUrl, null, {
//         params: {
//           grant_type: "refresh_token",
//           refresh_token: doctor.zoomRefreshToken,
//         },
//         headers: {
//           Authorization: Basic ${Buffer.from(${clientId}:${clientSecret}).toString("base64")},
//         },
//       });

//       const { access_token, refresh_token, expires_in } = response.data;

//       doctor.zoomAccessToken = access_token;
//       doctor.zoomRefreshToken = refresh_token;
//       doctor.zoomTokenExpiration = Date.now() + expires_in * 1000;
//       await doctor.save();
//     } catch (error) {
//       console.error("Failed to refresh Zoom token:", error.response?.data || error.message);
//       throw new Error("Could not refresh Zoom token");
//     }
//   }
//   return doctor.zoomAccessToken;
// };


//Function to Create Zoom Meeting and Add to Google Calendar
// const createZoomMeetingAndAddToGoogleCalendar = async (doctorId, appointment) => {
//   try {
//     const zoomAccessToken = await this.verifyAndRefreshZoomToken(doctorId); // Ensure you get a fresh token

//     const zoomAPIUrl = "https://api.zoom.us/v2/users/me/meetings";
//     const meetingData = {
//       topic: Appointment with ${appointment.patient},
//       type: 2,
//       start_time: ${appointment.appointmentDate}T${appointment.timeSlot}:00,
//       duration: 60,
//       timezone: "Asia/Kolkata",
//       agenda: Consultation for ${appointment.reason || "General Consultation"},
//       settings: {
//         host_video: true,
//         participant_video: true,
//         join_before_host: false,
//         mute_upon_entry: true,
//         waiting_room: true,
//       },
//     };

//     const zoomResponse = await axios.post(zoomAPIUrl, meetingData, {
//       headers: {
//         Authorization: Bearer ${zoomAccessToken},
//         "Content-Type": "application/json",
//       },
//     });

//     const zoomMeetingLink = zoomResponse.data.join_url;
//     return zoomMeetingLink; // Return or pass the meeting link to the next step (e.g., Google Calendar)
//   } catch (error) {
//     console.error("Zoom API request error:", error.response?.data || error.message);
//     if (error.response?.status === 401) {
//       // Token might be expired, trigger the refresh logic
//       await this.verifyAndRefreshZoomToken(doctorId); // Refresh token and retry
//       return this.createZoomMeetingAndAddToGoogleCalendar(doctorId, appointment); // Retry after refreshing token
//     }
//     throw new Error("Could not create Zoom meeting and add it to Google Calendar.");
//   }
// };