const axios = require('axios');
const { google } = require('googleapis');

// Generate Zoom Meeting Link
async function generateZoomMeetingLink(doctor) {
  try {
    const response = await axios.post(
      'https://api.zoom.us/v2/users/me/meetings',
      {
        topic: 'Online Workshop',
        type: 1, // instant meeting
        settings: {
          join_before_host: true,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${doctor.zoomAccessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.join_url;
  } catch (err) {
    console.error("Zoom meeting creation failed:", err.message);
    throw new Error("Failed to create Zoom meeting");
  }
}

// Generate Google Meet Link
async function generateGoogleMeetLink(doctor) {
  try {
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    console.log("GOOGLE_CLIENT_ID",process.env.GOOGLE_CLIENT_ID);
    console.log("GOOGLE_REDIRECT_URI",process.env.GOOGLE_REDIRECT_URI);
    console.log("GOOGLE_CLIENT_SECRET",process.env.GOOGLE_CLIENT_SECRET,);
    oAuth2Client.setCredentials({
      refresh_token: doctor.googleRefreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    const event = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      requestBody: {
        summary: 'Online Workshop',
        start: {
          dateTime: new Date().toISOString(),
          timeZone: 'Asia/Kolkata',
        },
        end: {
          dateTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          timeZone: 'Asia/Kolkata',
        },
        conferenceData: {
          createRequest: {
            requestId: `workshop-${Date.now()}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet',
            },
          },
        },
      },
    });

    return event.data.hangoutLink;
  } catch (err) {
    console.error("Google Meet creation failed:", err.message);
    throw new Error("Failed to create Google Meet link");
  }
}

module.exports = {
  generateZoomMeetingLink,
  generateGoogleMeetLink,
};