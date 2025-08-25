// ✅ CORE & UTILITY MODULES
const express = require("express");
const http = require("http");
const dotenv = require("dotenv");
const path = require("path");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const cron = require("node-cron");
const twilio = require("twilio");

// ✅ MIDDLEWARE MODULES
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");

// Load environment variables first
dotenv.config();

// ✅ CLOUDINARY CONFIGURATION (For File Uploads)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ MULTER CONFIGURATION FOR FILE UPLOADS
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [ "image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain" ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb( new Error( "Invalid file type. Only images, PDFs, and documents are allowed."), false );
    }
  },
});

// ✅ DATABASE CONNECTION
const dbConnection = require("./configs/dbConnection");
dbConnection();

// ✅ MODELS
const Message = require("./models/messageModel");
const Appointment = require("./models/appointmentModel");

// ✅ ROUTE IMPORTS (ALL YOUR ROUTES ARE HERE)
const otpRoute = require("./routes/otpRoutes");
const patientRoute = require("./routes/patientRoutes");
const doctorRoute = require("./routes/doctorRoutes");
const assignTasks = require("./routes/AssignTasksRoute");
const chatRoutes = require("./routes/chatRoutes");
const callLog = require("./routes/CallLogRoutes");
const formRoutes = require("./routes/formRoute");
const postRoute = require("./routes/postRoutes.js");
const leaveRoutes = require("./routes/leaveRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const workHoursRoutes = require("./routes/workHoursRoute.js");
const salaryRoutes = require("./routes/payrollRoutes.js");
const salaryStructure = require("./routes/SalaryStructureRoutes.js");
const shiftRoutes = require("./routes/shiftRoutes.js");
const attendance = require("./routes/attendanceRoute.js");
const videoCallRoutes = require("./routes/VideoCallRoutes");
const workshopRoutes = require("./routes/workshopRoutes.js");
const prescriptionRoute = require("./routes/prescription.js");
const medicineRoute = require("./routes/medicineRoute.js");
const rawMaterialRoute = require("./routes/rawMaterialRoute.js");
const vendorRoutes = require("./routes/VendorRoutes.js");
const orderRoutes = require("./routes/OrderRoute.js");
const medPrepSummary = require("./routes/medPrepSummary.js");
const prescriptionControl = require("./routes/PrescriptionControl.js");
const labelRoutes = require("./routes/labelRoutes.js");
const consumptionRoutes = require("./routes/consumptionRoutes");
const scheduleRoutes = require('./routes/generateMedicationScheduleRoutes.js');
const paymentRoutes = require("./routes/paymentRoutes");
const notificationRoutes = require("./routes/notificationRoutes.js");
const doctorAppointmentSettingsRoutes = require("./routes/consultationMessengerSettingsRoutes.js");
const pushNotificationRouter = require("./routes/pushNotificationRouter.js");

// ✅ CUSTOM MIDDLEWARE
const validateToken = require("./middlewares/validateTokenHandler");

// ✅ SERVICES
const { startReminderCronJob } = require('./utils/notificationScheduler.js');
const { analyzePatientMessage, triggerActionFromIntent, conversationalFallback } = require("./services/groqservice");

// =================================================================================
//                                 SERVER SETUP
// =================================================================================

const app = express();
app.set("trust proxy", 1);

// Create HTTP server from Express app - THIS IS THE CORRECT WAY
const server = http.createServer(app);

// ✅ SOCKET.IO SERVER INITIALIZATION
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "*", // More permissive for development
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

// =================================================================================
//                             CORE MIDDLEWARE SETUP
// =================================================================================

app.use(helmet({ contentSecurityPolicy: false })); // Simplified Helmet config for compatibility with WebSockets
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(morgan("combined"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
});
app.use("/api/", limiter);


// =================================================================================
//                                API ROUTES SETUP
// =================================================================================
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
app.use('/api', scheduleRoutes);
app.use('/api/medication', scheduleRoutes); // Assuming medicationRoutes is the same as scheduleRoutes from your original file
app.use("/api/notifications", notificationRoutes);
app.use("/api/doctorAppointmentSettings", doctorAppointmentSettingsRoutes);
app.use("/api/notification", pushNotificationRouter);
app.use("/api/payments", paymentRoutes);


// =================================================================================
//                              SOCKET.IO LOGIC
// =================================================================================

const connectedUsers = new Map(); // Stores info about connected users

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Example of a new, robust join event
  socket.on("join", ({ userId, role, name }) => {
    console.log(`${role || 'User'} ${userId} (${name || "Unknown"}) joined`);
    socket.join(`user_${userId}`);
    socket.userId = userId;
    connectedUsers.set(userId, { socketId: socket.id, role, name });
    io.emit("onlineUsers", Array.from(connectedUsers.keys()));
  });
  
  // MERGE THE MESSENGER TEAM'S SOCKET.ON(...) EVENTS HERE for features like:
  // - 'sendMessage'
  // - 'typing'
  // - 'mark-messages-read'
  // - etc.
  // This keeps your index.js clean. Or, paste their full `io.on("connection", ...)` block here.


  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
      io.emit("onlineUsers", Array.from(connectedUsers.keys()));
    }
  });
});


// =================================================================================
//                             CUSTOM ENDPOINTS
// =================================================================================

// For validating token from splash screen
app.post("/api/validate-token", validateToken, (req, res) => {
  console.log("Token is valid");
  res.status(200).json({ success: true, message: "Token is valid", user: req.user });
});

// For generating a Zoom token
app.post("/generateToken", (req, res) => {
  const { sdkKey, sdkSecret, meetingNumber, role } = req.body;
  const payload = { sdkKey, mn: meetingNumber, role, exp: Math.floor(Date.now() / 1000) + 60 * 60 };
  const token = jwt.sign(payload, sdkSecret, { algorithm: "HS256" });
  res.json({ token: token });
});

// For generating a custom Employee ID
let currentId = 0;
app.get("/api/generate-employee-id", (req, res) => {
  currentId += 1;
  const customId = `EMP-${String(currentId).padStart(5, "0")}`;
  res.json({ success: true, employeeID: customId });
});

app.get("/", (req, res) => {
  res.send("✅ Backend is up and running!");
});


// =================================================================================
//                                 TWILIO LOGIC
// =================================================================================

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

app.post("/make-call", (req, res) => {
    const { to } = req.body;
    const twimlUrl = `${process.env.NGROK_URL}/twiml?to=${encodeURIComponent(to)}`;

    twilioClient.calls.create({
        url: twimlUrl,
        to: "+916382786758", // Example number
        from: process.env.TWILIO_PHONE_NUMBER,
        record: true,
        recordingStatusCallback: "/recording-status",
    })
    .then(call => res.status(200).send(call.sid))
    .catch(error => res.status(500).send(error));
});

app.post("/twiml", (req, res) => {
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.record({ action: "/recording-status", recordingStatusCallback: "/recording-status" });
    twiml.dial().number(req.query.to);
    res.type("text/xml").send(twiml.toString());
});

app.post("/recording-status", (req, res) => {
    console.log(`New recording available: ${req.body.RecordingUrl}`);
    res.sendStatus(200);
});

app.get("/api/recordings/:phone", async (req, res) => {
    try {
        const { phone } = req.params;
        const calls = await twilioClient.calls.list({ to: phone, limit: 20 });
        const recordingsPromises = calls.map(call => twilioClient.recordings.list({ callSid: call.sid }));
        const recordingsArrays = await Promise.all(recordingsPromises);
        const recordings = recordingsArrays.flat().map(rec => ({
            sid: rec.sid,
            duration: rec.duration,
            dateCreated: rec.dateCreated,
            url: `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Recordings/${rec.sid}`,
            callSid: rec.callSid,
        }));
        res.json(recordings);
    } catch (error) {
        console.error("Error fetching recordings:", error);
        res.status(500).json({ error: "Failed to fetch recordings" });
    }
});


// =================================================================================
//                                 CRON JOBS
// =================================================================================

// Your cron job for deleting draft appointments
cron.schedule("* * * * *", async () => {
  console.log("Checking for expired draft appointments...");
  const expiredDrafts = await Appointment.find({
    status: "draft",
    expiresAt: { $lt: new Date() },
  });

  if (expiredDrafts.length > 0) {
    console.log(`Deleting ${expiredDrafts.length} expired draft appointments...`);
    await Appointment.deleteMany({ _id: { $in: expiredDrafts.map(appt => appt._id) } });
  }
});


// =================================================================================
//                          ERROR HANDLING & SERVER START
// =================================================================================

// Generic 404 handler for routes not found
app.use("*", (req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: "Something went wrong on the server!",
        error: process.env.NODE_ENV === "production" ? {} : err.message,
    });
});


const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 Socket.io server ready for connections`);
  startReminderCronJob(); // Start your notification scheduler
});