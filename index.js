const express = require("express");
const helmet = require("helmet");
const fs = require("fs");
const path = require("path");
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
const dbConnection = require("./configs/dbConnection");
const otpRoute = require("./routes/otpRoutes");
const patientRoute = require("./routes/patientRoutes");
const doctorRoute = require("./routes/doctorRoutes");
const validateToken = require("./middlewares/validateTokenHandler");
const assignTasks = require("./routes/AssignTasksRoute");
const chatRoutes = require("./routes/chatRoutes");
const callLog = require("./routes/CallLogRoutes");
const formRoutes = require("./routes/formRoute");
const postRoute = require("./routes/postRoutes.js");
const leaveRoutes = require("./routes/leaveRoutes");
const { initSocket } = require("./controllers/socketController");
const employeeRoutes = require("./routes/employeeRoutes");
const workHoursRoutes = require("./routes/workHoursRoute.js");
const salaryRoutes = require("./routes/payrollRoutes.js");
const salaryStructure = require("./routes/SalaryStructureRoutes.js");
const shiftRoutes = require("./routes/shiftRoutes.js");
const attendance = require("./routes/attendanceRoute.js");
const videoCallRoutes = require("./routes/VideoCallRoutes"); // Import the new router
const workshopRoutes = require("./routes/workshopRoutes.js");
const prescriptionRoute = require("./routes/prescription.js");
const medicineRoute = require("./routes/medicineRoute.js");
const rawMaterialRoute = require("./routes/rawMaterialRoute.js");
const vendorRoutes = require("./routes/VendorRoutes.js");
const orderRoutes = require("./routes/OrderRoute.js")
const medPrepSummary = require("./routes/medPrepSummary.js")
const prescriptionControl = require("./routes/PrescriptionControl.js");
const labelRoutes = require("./routes/labelRoutes.js");
const consumptionRoutes = require("./routes/consumptionRoutes");
const scheduleRoutes = require('./routes/generateMedicationScheduleRoutes.js');
const medicationRoutes = require('./routes/generateMedicationScheduleRoutes');

const doctorFeedbackRoutes = require("./routes/doctorFeedback.js");





const Doctor = require('./models/doctorModel.js'); // adjust path as needed
const bcrypt = require('bcryptjs');

dbConnection();

dotenv.config();

const app = express();
app.set("trust proxy", 1);
const server = createServer(app);

initSocket(server);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors());


// Routes
app.use("/api/otp", otpRoute);
app.use("/api/patient", patientRoute);
app.use("/api/doctor", doctorRoute);
app.use("/api/post", postRoute);
app.use("/api/log", callLog);
app.use("/api/forms", formRoutes);
app.use("/api/assign", assignTasks);
app.use("/api", chatRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/work-hours", workHoursRoutes);
app.use("/api/payslip", salaryRoutes);
app.use("/api/salary", salaryStructure);
app.use("/api/shift", shiftRoutes);
app.use("/api/attendance", attendance);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/video-call", videoCallRoutes);
app.use("/api/workshop", workshopRoutes);
app.use("/api/prescription", prescriptionRoute);
app.use("/api/medicines", medicineRoute);
app.use("/api/inventory", rawMaterialRoute);
app.use("/api/vendor", vendorRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/medicine-summary", medPrepSummary);
app.use("/api", labelRoutes);
app.use("/api/consumptions", consumptionRoutes);
app.use("/api/prescriptionControl", prescriptionControl);
app.use("/api/posts", require("./routes/postRoutes"));
app.use('/api', scheduleRoutes);
app.use('/api/medication', medicationRoutes);

// messaging module 
app.use("/api/doctorFeedback",doctorFeedbackRoutes);

const options = {
  key: fs.readFileSync("server.key"),
  cert: fs.readFileSync("server.crt"),
};

// Middleware: Set Content Security Policy for security
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "https://apis.google.com",
        "https://www.gstatic.com",
        "'unsafe-inline'",
      ],
      frameSrc: [
        "'self'",
        "https://accounts.google.com",
        "https://calendar.google.com",
      ],
      connectSrc: ["'self'", "https://www.googleapis.com"],
    },
  })
);
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  next();
});
app.use((req, res, next) => {
  res.removeHeader("Cross-Origin-Embedder-Policy");
  res.removeHeader("Cross-Origin-Opener-Policy");
  next();
});

let currentId = 0; // To simulate incremental IDs
// Generate a custom Employee ID
app.get("/api/generate-employee-id", (req, res) => {
  currentId += 1;
  const customId = `EMP-${String(currentId).padStart(5, "0")}`;
  res.json({ success: true, employeeID: customId });
});

// Example API route
app.get("/api/example", (req, res) => {
  res.json({ message: "Hello jijijihui the API!" });
});

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

const twilio = require("twilio");
const accountSid = process.env.TWILIO_ACCOUNT_SID; // Your Twilio Account SID
const authToken = process.env.TWILIO_AUTH_TOKEN; // Your Twilio Auth Token
const client = twilio(accountSid, authToken);

// Endpoint to handle the TwiML response
app.post("/twiml", (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.record({
    action: "/recording-status",
    recordingStatusCallback: "/recording-status",
  });
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

app.get("/api/recordings/:phone", async (req, res) => {
  try {
    const { phone } = req.params;

    // Get all calls made to this phone number
    const calls = await client.calls.list({
      to: phone,
      limit: 20,
    });

    // Get recordings for each call
    const recordingsPromises = calls.map((call) =>
      client.recordings.list({ callSid: call.sid })
    );

    const recordingsArrays = await Promise.all(recordingsPromises);

    // Flatten and format the recordings
    const recordings = recordingsArrays.flat().map((recording) => ({
      sid: recording.sid,
      duration: recording.duration,
      dateCreated: recording.dateCreated,
      url: `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Recordings/${recording.sid}`,
      callSid: recording.callSid,
    }));

    res.json(recordings);
  } catch (error) {
    console.error("Error fetching recordings:", error);
    res.status(500).json({ error: "Failed to fetch recordings" });
  }
});

// Update your existing make-call endpoint to include the patient's phone
app.post("/make-call", (req, res) => {
  const { to } = req.body;
  const twimlUrl = `${process.env.NGROK_URL}/twiml?to=${encodeURIComponent(
    to
  )}`;

  client.calls
    .create({
      url: twimlUrl,
      to: "+916382786758", // current assistant doc number
      from: process.env.TWILIO_PHONE_NUMBER,
      record: true,
      recordingStatusCallback: "/recording-status",
    })
    .then((call) => res.status(200).send(call.sid))
    .catch((error) => res.status(500).send(error));
});
//https.createServer(options, app).listen(5000, () => {
// console.log('Server is running on https://localhost:5000');
//});

// For getting the user straight to Home page from the splash screen if the response is true else to the login page
app.post("/api/validate-token", validateToken, (req, res) => {
  console.log("Token is valid");
  res.status(200).json({
    success: true,
    message: "Token is valid",
    user: req.user, // The user information is attached by the middleware
  });
});

const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
app.use(helmet());
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use("/api/", limiter);

const paymentRoutes = require("./routes/paymentRoutes");
app.use("/api/payments", paymentRoutes);

const cron = require("node-cron");
const Appointment = require("./models/appointmentModel");

// Runs every 1 minute to check for expired drafts
cron.schedule("* * * * *", async () => {
  console.log("Checking for drafts");
  const expiredDrafts = await Appointment.find({
    status: "draft",
    expiresAt: { $lt: new Date() },
  });

  if (expiredDrafts.length > 0) {
    console.log(
      `Deleting ${expiredDrafts.length} expired draft appointments...`
    );
    await Appointment.deleteMany({
      _id: { $in: expiredDrafts.map((appt) => appt._id) },
    });
  }
});

app.post("/generateToken", (req, res) => {
  const { sdkKey, sdkSecret, meetingNumber, role } = req.body;
  const payload = {
    sdkKey,
    mn: meetingNumber,
    role,
    exp: Math.floor(Date.now() / 1000) + 60 * 60, // Token expires in 1 hour
  };

  const token = jwt.sign(payload, sdkSecret, { algorithm: "HS256" });
  console.log(token);
  res.json({ token: token });
});

app.get("/Tarun", (req, res) => {
  return res.status(200).json({ message: "Endpoint reached" });
});
app.get("/", (req, res) => {
  res.send("✅ Backend is up and running!");
});


const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
