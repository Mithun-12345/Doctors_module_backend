const express = require("express");
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
const assignTasks = require('./routes/AssignTasksRoute');
const callLog = require("./routes/CallLogRoutes");
const formRoutes = require("./routes/formRoute");
const postRoute = require("./routes/postRoutes");
const { initSocket } = require("./controllers/socketController");

dbConnection();

const app = express();
const server = createServer(app);

initSocket(server);

app.use(express.json());
app.use(cors());

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
  twiml.dial().number(req.query.to); // Connects the call to the 'to' number
  res.type("text/xml");
  res.send(twiml.toString());
});

// Endpoint to make the call
app.post("/make-call", (req, res) => {
  const { to } = req.body; // The number to call from the request body
  const formattedPhone = `+91${to}`;
  console.log(formattedPhone);
  const twimlUrl = `https://5eaa-122-15-77-226.ngrok-free.app/twiml?to=${encodeURIComponent(
    formattedPhone
  )}`;

  client.calls
    .create({
      url: twimlUrl, // Point to the TwiML endpoint
      to: "+916382786758", // current assistant doc number
      from: process.env.TWILIO_PHONE_NUMBER, // Your Twilio number
    })
    .then((call) => res.status(200).send(call.sid))
    .catch((error) => res.status(500).send(error));
});


const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});