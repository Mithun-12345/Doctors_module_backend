const { google } = require('googleapis');
const moment = require('moment');

// Configure OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Generate authorization URL for Google OAuth
const getGoogleAuthURL = () => {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ]
  });
};

// Get tokens from Google OAuth callback
const getGoogleTokens = async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  } catch (error) {
    console.error('Error getting Google tokens:', error);
    throw new Error('Failed to get Google tokens');
  }
};

// Refresh Google access token
const refreshGoogleToken = async (refreshToken) => {
  try {
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });
    const { credentials } = await oauth2Client.refreshAccessToken();
    return credentials;
  } catch (error) {
    console.error('Error refreshing Google token:', error);
    throw new Error('Failed to refresh Google token');
  }
};

// Create Google Meet link
const createGoogleMeet = async (googleTokens, appointmentDate, timeSlot, patient, doctor) => {
  try {
    // Set credentials using the provided tokens
    oauth2Client.setCredentials(googleTokens);

    // Create calendar instance
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Parse appointment date and time
    const startDateTime = moment(`${appointmentDate} ${timeSlot}`, 'YYYY-MM-DD HH:mm');
    const endDateTime = moment(startDateTime).add(1, 'hours');

    // Create meeting details
    const event = {
      summary: `Medical Appointment: ${patient.name}`,
      description: `
        Patient: ${patient.name}
        Doctor: ${doctor.name}
        
        This is a scheduled medical appointment through our healthcare platform.
        
        Please join the meeting at the scheduled time using the Google Meet link.
      `.trim(),
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      attendees: [
        { email: patient.email },
        { email: doctor.email }
      ],
      conferenceData: {
        createRequest: {
          requestId: `${patient._id}-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 10 }
        ]
      }
    };

    // Create the event with Google Meet
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1,
      sendNotifications: true
    });

    // Extract the Google Meet link
    const meetLink = response.data.conferenceData?.entryPoints?.[0]?.uri;
    
    if (!meetLink) {
      throw new Error('Failed to generate Google Meet link');
    }

    return {
      meetLink,
      eventId: response.data.id,
      htmlLink: response.data.htmlLink
    };

  } catch (error) {
    console.error('Error creating Google Meet event:', error);
    
    // Check if token has expired
    if (error.code === 401) {
      throw new Error('Google token expired');
    }
    
    throw new Error(`Failed to create Google Meet: ${error.message}`);
  }
};

module.exports = {
  getGoogleAuthURL,
  getGoogleTokens,
  refreshGoogleToken,
  createGoogleMeet
};