const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io");
require("dotenv").config();
const Message = require("./models/messageModel");

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:8081", // Update with your frontend origin if necessary
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(express.json());
app.use(cors());

mongoose
  .connect(process.env.MONGODB_LOCAL_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  socket.on("join", ({ userId }) => {
    socket.join(userId);
    console.log(`User ${userId} joined their room`);
  });

  socket.on("chat message", async (msg) => {
    try {
      const message = new Message({
        sender: msg.senderId,
        receiver: msg.receiverId,
        content: msg.content,
        timestamp: new Date(),
      });

      await message.save();

      // Emit message to both sender and receiver
      io.to(msg.senderId).to(msg.receiverId).emit("chat message", message);

      // Acknowledge successful save
      socket.emit("message saved", { success: true, messageId: message._id });
    } catch (err) {
      console.log("Error saving message:", err);
      // Notify client of error
      socket.emit("message saved", { success: false, error: err.message });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected", socket.id);
  });
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

const PORT = process.env.PORT || 8000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});