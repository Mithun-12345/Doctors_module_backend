// socket.js
const { Server } = require("socket.io");
const Message = require("../models/messageModel");
let io;

function initSocket(server) {

  io = new Server(server);

  io.on("connection", (socket) => {
    console.log("A user connected", socket.id);

    // Existing chat functionality
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
        io.to(msg.senderId).to(msg.receiverId).emit("chat message", message);
        socket.emit("message saved", { success: true, messageId: message._id });
      } catch (err) {
        console.log("Error saving message:", err);
        socket.emit("message saved", { success: false, error: err.message });
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected", socket.id);
    });
  });

  return io;
}

function getIo() {
  if (!io) {
    throw new Error("Socket.io not initialized! Call initSocket first.");
  }
  return io;
}

module.exports = { initSocket, getIo };
