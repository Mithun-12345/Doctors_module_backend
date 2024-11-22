const express = require("express");
const fs = require("fs");
const https = require("https");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io");
require("dotenv").config();
const Message = require("./models/messageModel");
const patientModel = require("./models/patientModel");
const dbConnection = require("./config/dbConnection");
const otpRoute = require("./routes/otpRoutes");
const patientRoute = require("./routes/patientRoutes");
const doctorRoute = require("./routes/doctorRoutes");
const validateToken = require("./middlewares/validateTokenHandler");
const assignTasks = require("./routes/AssignTasksRoute");
const callLog = require("./routes/CallLogRoutes");
const formRoutes = require("./routes/formRoute");
const postRoute = require("./routes/postRoutes");
const leaveRoutes = require('./routes/leaveRoutes');
const { initSocket } = require("./controllers/socketController");
const employeeRoutes = require('./routes/employeeRoutes');
const workHoursRoutes = require('./routes/workHoursRoute.js');
const salaryRoutes = require("./routes/payrollRoutes.js");
const salaryStructure = require("./routes/SalaryStructureRoutes.js")

dbConnection();

dotenv.config();

const app = express();
const server = createServer(app);

initSocket(server);

app.use(express.json());
app.use(cors());

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID;
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;
const ZOOM_REDIRECT_URI = process.env.ZOOM_REDIRECT_URI;

// Routes
app.use("/api/otp", otpRoute);
app.use("/api/patient", patientRoute);
app.use("/api/doctor", doctorRoute);
app.use("/api/post", postRoute);
app.use("/api/log", callLog);
app.use("/api/forms", formRoutes);
app.use("/api/assign", assignTasks);
const chatRoutes = require("./routes/chatRoutes");
app.use("/api", chatRoutes);
app.use("/api/leaves", leaveRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/work-hours', workHoursRoutes);
app.use("/api/payslip", salaryRoutes);
app.use("/api", salaryStructure);


const options = {
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt')
};

app.get("/google/authorize", (req, res) => {
  const url = `https://accounts.google.com/o/oauth2/v2/auth?scope=https://www.googleapis.com/auth/calendar&access_type=offline&response_type=code&redirect_uri=${GOOGLE_REDIRECT_URI}&client_id=${GOOGLE_CLIENT_ID}`;
  res.redirect(url);
});

app.get("/google/callback", async (req, res) => {
  const code = req.query.code;

  try {
    const response = await axios.post("https://oauth2.googleapis.com/token", {
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    });

    const { access_token, refresh_token } = response.data;

    // Save tokens securely in your DB (for simplicity, just logging here)
    console.log("Google Access Token:", access_token);
    console.log("Google Refresh Token:", refresh_token);

    // Return success or continue with the flow
    res.send("Google OAuth Flow Completed Successfully!");
  } catch (error) {
    console.error("Google OAuth Error:", error);
    res.status(500).send("Error in Google OAuth flow");
  }
});

app.get("/zoom/authorize", (req, res) => {
  const url = `https://zoom.us/oauth/authorize?response_type=code&client_id=${ZOOM_CLIENT_ID}&redirect_uri=${ZOOM_REDIRECT_URI}`;
  res.redirect(url);
});

// Step 2: Exchange Zoom Authorization Code for Tokens
app.get("/zoom/callback", async (req, res) => {
  const code = req.query.code;

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

    // Save tokens securely in your DB (for simplicity, just logging here)
    console.log("Zoom Access Token:", access_token);
    console.log("Zoom Refresh Token:", refresh_token);

    // Return success or continue with the flow
    res.send("Zoom OAuth Flow Completed Successfully!");
  } catch (error) {
    console.error("Zoom OAuth Error:", error);
    res.status(500).send("Error in Zoom OAuth flow");
  }
});

mongoose
  .connect(process.env.MONGODB_LOCAL_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

app.get("/api/chat/:senderId/:receiverId", async (req, res) => {
  try {
    const { senderId, receiverId } = req.params;

    const messages = await Message.find({
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId },
      ],
    }).sort("timestamp");

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Server error", err });
  }
});

app.get("/test", async (req, res) => {
  try {
    const patients = await patientModel.find();
    res.json(patients);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

const twilio = require("twilio");
const accountSid = process.env.TWILIO_ACCOUNT_SID; // Your Twilio Account SID
const authToken = process.env.TWILIO_AUTH_TOKEN; // Your Twilio Auth Token
const client = twilio(accountSid, authToken);

// Endpoint to handle the TwiML response
app.post("/twiml", (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.record({ action: '/recording-status', recordingStatusCallback: '/recording-status' });
  twiml.dial().number(req.query.to);
  res.type("text/xml");
  res.send(twiml.toString());
});

app.post("/recording-status", (req, res) => {
  const recordingUrl = req.body.RecordingUrl;
  const recordingSid = req.body.RecordingSid;
  
  // Here you would typically save the recordingUrl and recordingSid to your database
  console.log(`New recording available: ${recordingUrl}`);
  
  res.sendStatus(200);
});

app.get("/recordings", (req, res) => {
  client.recordings.list({ limit: 20 })
    .then(recordings => {
      const formattedRecordings = recordings.map(recording => ({
        sid: recording.sid,
        duration: recording.duration,
        dateCreated: recording.dateCreated,
        url: recording.mediaUrl
      }));
      res.json(formattedRecordings);
    })
    .catch(error => {
      console.error('Error fetching recordings:', error);
      res.status(500).json({ error: 'Failed to fetch recordings' });
    });
});

// Endpoint to make the call
app.post("/make-call", (req, res) => {
  const { to } = req.body; // The number to call from the request body
  // const formattedPhone = `+91${to}`;
  console.log(to);
  const twimlUrl = `https://f9ea-122-15-77-226.ngrok-free.app/twiml?to=${encodeURIComponent(
    to
  )}`;

  client.calls
    .create({
      url: twimlUrl, // Point to the TwiML endpoint
      to: "+916382786758", // current assistant doc number
      from: process.env.TWILIO_PHONE_NUMBER, // Your Twilio number
      // record: true
    })
    .then((call) => res.status(200).send(call.sid))
    .catch((error) => res.status(500).send(error));
});
// https.createServer(options, app).listen(5000, () => {
//   console.log('Server is running on https://localhost:5000');
// });

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
