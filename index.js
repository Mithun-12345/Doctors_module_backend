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
const geminiTextServiceRoutes=require("./routes/geminiTextServiceRoutes.js")
const creditDebitRoutes = require('./routes/debitCreditRoutes.js');
const dashboardAnalyticsRoutes= require('./routes/dashboardAnalyticsRoutes.js')


// ✅ CUSTOM MIDDLEWARE
const validateToken = require("./middlewares/validateTokenHandler");

// ✅ SERVICES
const { startReminderCronJob,startMedicineReminderCronJob,startExactTimeReminderCronJob,startUserStatusCronJob,startTatAnalyticsCronJob} = require('./utils/notificationScheduler.js');
const { analyzePatientMessage, triggerActionFromIntent, conversationalFallback } = require("./services/groqservice");

// =================================================================================
//                                 SERVER SETUP
// =================================================================================

const app = express();
app.set("trust proxy", 1);

const server = http.createServer(app);

// ✅ SOCKET.IO SERVER INITIALIZATION
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// =================================================================================
//                             CORE MIDDLEWARE SETUP
// =================================================================================

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(morgan("combined"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
});
app.use("/api/", limiter);


// =================================================================================
//                                API ROUTES SETUP
// =================================================================================
app.use("/api/otp", otpRoute);
app.use("/api/analytics",dashboardAnalyticsRoutes);
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
app.use('/api/medication', scheduleRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/doctorAppointmentSettings", doctorAppointmentSettingsRoutes);
app.use("/api/notification", pushNotificationRouter);
app.use("/api/payments", paymentRoutes);
app.use("/api/gemini",geminiTextServiceRoutes);
app.use('/api/notes', creditDebitRoutes);

// =================================================================================
//                              SOCKET.IO LOGIC
// =================================================================================

// Enhanced user presence tracking
const connectedUsers = new Map(); // userId -> { socketId, role, name, lastSeen }
const typingUsers = new Map(); // userId -> { receiverId, timeout }
const activeSessions = new Map();


// Helper functions for user presence
const broadcastOnlineUsers = () => {
  const onlineUserIds = Array.from(connectedUsers.keys());
  io.emit("onlineUsers", onlineUserIds);
};

const notifyUserOnline = (userId, userData) => {
  io.emit("userOnline", { userId, ...userData });
};

const notifyUserOffline = (userId, lastSeen) => {
  io.emit("userOffline", { userId, lastSeen });
};

const clearUserTyping = (userId) => {
  if (typingUsers.has(userId)) {
    const typingData = typingUsers.get(userId);
    clearTimeout(typingData.timeout);
    typingUsers.delete(userId);
    const receiverSocket = connectedUsers.get(typingData.receiverId);
    if (receiverSocket) {
      io.to(`user_${typingData.receiverId}`).emit("userTyping", { userId, isTyping: false });
    }
  }
};

const sendBotReply = (io, patientId, text) => {
  const receiverSocket = connectedUsers.get(patientId);
  if (receiverSocket) {
    io.to(`user_${patientId}`).emit("receiveMessage", {
      sender: "ai_bot",
      senderName: "AI Assistant",
      receiver: patientId,
      message: text,
      timestamp: new Date(),
      messageType: "text",
    });
    console.log(`🤖 Bot reply sent to patient ${patientId}`);
  } else {
    console.warn(`⚠️ Patient ${patientId} is offline. Bot reply not delivered.`);
  }
};

// Enhanced Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", ({ userId, role, name }) => {
    console.log(`${role} ${userId} (${name || "Unknown"}) joined`);
    const userData = { socketId: socket.id, role, name: name || "Unknown", lastSeen: new Date(), connectedAt: new Date() };
    connectedUsers.set(userId, userData);
    socket.join(`user_${userId}`);
    socket.userId = userId;
    notifyUserOnline(userId, userData);
    broadcastOnlineUsers();
    console.log(`Total connected users: ${connectedUsers.size}`);
  });

  socket.on("sendMessage", async (messageData) => {
    try {
      clearUserTyping(messageData.sender);
      const messageDoc = {
        sender: messageData.sender,
        receiver: messageData.receiver,
        message: messageData.message || (messageData.fileAttachment ? `Sent ${messageData.fileAttachment.fileName}` : ""),
        senderName: messageData.senderName,
        receiverName: messageData.receiverName,
        timestamp: new Date(),
      };
      if (messageData.fileAttachment) {
        messageDoc.fileAttachment = messageData.fileAttachment;
        messageDoc.messageType = "file";
      }
      const newMessage = new Message(messageDoc);
      await newMessage.save();
      const messageToSend = {
        _id: newMessage._id,
        sender: messageData.sender,
        receiver: messageData.receiver,
        message: newMessage.message,
        senderName: messageData.senderName,
        receiverName: messageData.receiverName,
        timestamp: newMessage.timestamp,
        messageType: newMessage.messageType || "text",
      };
      if (newMessage.fileAttachment) {
        messageToSend.fileAttachment = newMessage.fileAttachment;
      }
      const receiverSocket = connectedUsers.get(messageData.receiver);
      if (receiverSocket) {
        io.to(`user_${messageData.receiver}`).emit("receiveMessage", messageToSend);
      }
      io.to(`user_${messageData.sender}`).emit("receiveMessage", messageToSend);
      socket.emit("messageSent", { success: true, messageId: newMessage._id, timestamp: newMessage.timestamp });

      if (messageData) {
        try {
          const analysis = await analyzePatientMessage(messageData.message);
          const actionDone = await triggerActionFromIntent(analysis, messageData, io);
          if (!actionDone) {
            const fallbackReply = await conversationalFallback(messageData.message);
            sendBotReply(io, messageData.sender, fallbackReply);
          }
        } catch (intentErr) {
          console.error("❌ Groq intent analysis error:", intentErr);
          sendBotReply(io, messageData.sender, "I'm here to help! Could you tell me more about your concern?");
        }
      }
    } catch (error) {
      console.error("Error saving message:", error);
      socket.emit("messageError", { error: "Failed to send message", details: error.message });
    }
  });

  socket.on("typing", ({ userId, receiverId, isTyping }) => {
    if (isTyping) {
      clearUserTyping(userId);
      const timeout = setTimeout(() => clearUserTyping(userId), 3000);
      typingUsers.set(userId, { receiverId, timeout });
      const receiverSocket = connectedUsers.get(receiverId);
      if (receiverSocket) {
        io.to(`user_${receiverId}`).emit("userTyping", { userId, isTyping: true });
      }
    } else {
      clearUserTyping(userId);
    }
  });

  socket.on("sessionToggle", ({ patientId, doctorId, sessionActive }) => {
    console.log("SessionToggle event:", {
      patientId,
      doctorId,
      sessionActive,
    });

    activeSessions.set(patientId, sessionActive);

    // This block was moved inside the listener to have access to the variables
    io.to(`user_${patientId}`).emit("sessionToggle", {
      patientId,
      doctorId,
      sessionActive,
    });
    io.to(`user_${doctorId}`).emit("sessionToggle", {
      patientId,
      doctorId,
      sessionActive,
    });
  });

  socket.on("botStatusChanged", ({ doctorId, patientId, status }) => {
    console.log("🤖 Bot status changed:", { doctorId, patientId, status });

    io.to(`user_${doctorId}`).emit("botStatusChanged", {
      doctorId,
      patientId,
      status,
    });

    io.to(`user_${patientId}`).emit("botStatusChanged", {
      doctorId,
      patientId,
      status,
    });
  });

  socket.on("disconnect", (reason) => {
    console.log("User disconnected:", socket.id, "Reason:", reason);
    handleUserDisconnect(socket);
  });

  function handleUserDisconnect(socket) {
    if (socket.userId) {
      const userData = connectedUsers.get(socket.userId);
      if (userData) {
        const lastSeen = new Date();
        clearUserTyping(socket.userId);
        connectedUsers.delete(socket.userId);
        notifyUserOffline(socket.userId, lastSeen);
        broadcastOnlineUsers();
        console.log(`${userData.role} ${socket.userId} (${userData.name}) disconnected. Total connected: ${connectedUsers.size}`);
      }
    }
  }

  socket.on("error", (error) => console.error("Socket error:", error));
});

// Periodic cleanup for stale connections
setInterval(() => {
  const now = new Date();
  const staleThreshold = 5 * 60 * 1000;
  for (const [userId, userData] of connectedUsers.entries()) {
    if (now - userData.lastSeen > staleThreshold) {
      console.log(`Cleaning up stale connection for user: ${userId}`);
      connectedUsers.delete(userId);
      notifyUserOffline(userId, userData.lastSeen);
      broadcastOnlineUsers();
    }
  }
}, 60000);

// =================================================================================
//                             CUSTOM ENDPOINTS
// =================================================================================

// Your existing custom endpoints
app.post("/api/validate-token", validateToken, (req, res) => {
  console.log("Token is valid");
  res.status(200).json({ success: true, message: "Token is valid", user: req.user });
});

app.post("/generateToken", (req, res) => {
  const { sdkKey, sdkSecret, meetingNumber, role } = req.body;
  const payload = { sdkKey, mn: meetingNumber, role, exp: Math.floor(Date.now() / 1000) + 60 * 60 };
  const token = jwt.sign(payload, sdkSecret, { algorithm: "HS256" });
  res.json({ token: token });
});

let currentId = 0;
app.get("/api/generate-employee-id", (req, res) => {
  currentId += 1;
  const customId = `EMP-${String(currentId).padStart(5, "0")}`;
  res.json({ success: true, employeeID: customId });
});

app.get("/", (req, res) => res.send("✅ Backend is up and running!"));


// Cloudinary File Upload Endpoint
app.post("/api/upload/cloudinary", validateToken, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
      const resourceType = req.file.mimetype.startsWith("image/") ? "image" : "raw";
      const timestamp = Date.now();
      const originalName = req.file.originalname.split(".")[0];
      const publicId = `chat_files/${timestamp}_${originalName}`;

      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({ resource_type: resourceType, public_id: publicId, folder: "chat_attachments" }, (error, result) => {
            if (error) reject(error);
            else resolve(result);
        });
        uploadStream.end(req.file.buffer);
      });

      res.status(200).json({ success: true, message: "File uploaded successfully", secure_url: uploadResult.secure_url, public_id: uploadResult.public_id });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ success: false, message: "File upload failed", error: error.message });
    }
});

// Groq AI Analysis Endpoint
app.post("/api/groq/analyze", validateToken, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: "Message is required" });
    const analysis = await analyzePatientMessage(message);
    res.json({ success: true, data: analysis });
  } catch (error) {
    console.error("❌ Analysis error:", error);
    res.status(500).json({ success: false, message: "Analysis failed", error: error.message });
  }
});

// START: Added Missing Chat API Endpoints
// Fetches message history between two users
app.get("/api/chat/:senderId/:receiverId", async (req, res) => {
  try {
    const { senderId, receiverId } = req.params;
    const messages = await Message.find({
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId },
      ],
    }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Sends a message via API and notifies online users
app.post("/api/chat/send", async (req, res) => {
  try {
    const { sender, receiver, message, senderName, receiverName } = req.body;
    const newMessage = new Message({ sender, receiver, message, senderName, receiverName, timestamp: new Date() });
    const savedMessage = await newMessage.save();
    const receiverSocket = connectedUsers.get(receiver);
    if (receiverSocket) {
      io.to(`user_${receiver}`).emit("receiveMessage", savedMessage);
    }
    res.status(201).json({ success: true, message: "Message sent successfully", data: savedMessage });
  } catch (error) {
    console.error("Error sending message via API:", error);
    res.status(500).json({ success: false, message: "Failed to send message", error: error.message });
  }
});
// =================================================================================
//                                 TWILIO LOGIC
// =================================================================================
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

app.post("/make-call", (req, res) => {
  const { to } = req.body;
  const twimlUrl = `${process.env.NGROK_URL}/twiml?to=${encodeURIComponent(to)}`;
  twilioClient.calls.create({ url: twimlUrl, to: "+916382786758", from: process.env.TWILIO_PHONE_NUMBER, record: true, recordingStatusCallback: "/recording-status" })
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
    const recordings = recordingsArrays.flat().map(rec => ({ sid: rec.sid, duration: rec.duration, dateCreated: rec.dateCreated, url: `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Recordings/${rec.sid}`, callSid: rec.callSid }));
    res.json(recordings);
  } catch (error) {
    console.error("Error fetching recordings:", error);
    res.status(500).json({ error: "Failed to fetch recordings" });
  }
});

// =================================================================================
//                                 CRON JOBS
// =================================================================================

cron.schedule("* * * * *", async () => {
  console.log("Checking for expired draft appointments...");
  const expiredDrafts = await Appointment.find({ status: "draft", expiresAt: { $lt: new Date() } });
  if (expiredDrafts.length > 0) {
    console.log(`Deleting ${expiredDrafts.length} expired draft appointments...`);
    await Appointment.deleteMany({ _id: { $in: expiredDrafts.map(appt => appt._id) } });
  }
});

// =================================================================================
//                          ERROR HANDLING & SERVER START
// =================================================================================

app.use("*", (req, res) => res.status(404).json({ success: false, message: "Route not found" }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Something went wrong on the server!", error: process.env.NODE_ENV === "production" ? {} : err.message });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 Socket.io server ready for connections`);
  startReminderCronJob();
  startMedicineReminderCronJob();
  startExactTimeReminderCronJob();
  startUserStatusCronJob();
  startTatAnalyticsCronJob()
});

// Graceful Shutdown Logic
process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down gracefully...");
  io.emit("serverShutdown", { message: "Server is shutting down" });
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});