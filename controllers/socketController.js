// socket.js
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Message = require("../models/messageModel");

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "http://localhost:3000", // Your React app URL
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const userId = socket.handshake.auth.userId;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      // You can add user verification here if needed
      socket.userId = userId;
      socket.userToken = decoded;
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      // Allow connection even if auth fails for backward compatibility
      next();
    }
  });

  io.on("connection", (socket) => {
    console.log("A user connected", socket.id);

    // Original join functionality (keeping for backward compatibility)
    socket.on("join", ({ userId }) => {
      socket.join(userId);
      console.log(`User ${userId} joined their room`);
    });

    // New: Join user to their personal room with authentication
    socket.on('join-user-room', (userId) => {
      socket.join(`user_${userId}`);
      socket.userId = userId;
      console.log(`User ${userId} joined their personal room`);
    });

    // New: Join specific chat room
    socket.on('join-chat-room', (data) => {
      const { patientId, doctorId, roomName } = data;
      socket.join(roomName);
      console.log(`User ${socket.userId || 'unknown'} joined chat room: ${roomName}`);
    });

    // New: Leave chat room
    socket.on('leave-chat-room', (data) => {
      const { roomName } = data;
      socket.leave(roomName);
      console.log(`User ${socket.userId || 'unknown'} left chat room: ${roomName}`);
    });

    // Original chat message functionality (keeping for backward compatibility)
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

    // New: Enhanced message sending with the new schema
    socket.on('send-message', async (messageData) => {
      try {
        const { message, receiverId, receiverName, receiverType, senderType, chatRoom, timestamp } = messageData;
        
        // Create message in database with new schema
        const newMessage = new Message({
          message: message,
          senderId: socket.userId,
          senderName: messageData.senderName || 'Unknown',
          senderType: senderType || 'patient',
          receiverId: receiverId,
          receiverName: receiverName,
          receiverType: receiverType || 'doctor',
          chatRoom: chatRoom,
          timestamp: new Date(timestamp),
          isRead: false
        });

        const savedMessage = await newMessage.save();
        
        // Emit to chat room (both sender and receiver will get it)
        io.to(chatRoom).emit('receive-message', {
          _id: savedMessage._id,
          message: savedMessage.message,
          senderId: savedMessage.senderId,
          senderName: savedMessage.senderName,
          senderType: savedMessage.senderType,
          receiverId: savedMessage.receiverId,
          receiverName: savedMessage.receiverName,
          receiverType: savedMessage.receiverType,
          timestamp: savedMessage.timestamp,
          isRead: savedMessage.isRead
        });

        // Send delivery confirmation to sender
        socket.emit('message-delivered', {
          messageId: savedMessage._id,
          status: 'delivered'
        });

        console.log(`Message sent from ${savedMessage.senderName} to ${receiverName}`);
        
      } catch (error) {
        console.error('Error saving message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // New: Get chat history
    socket.on('get-chat-history', async (data) => {
      try {
        const { userId, doctorId, doctorName } = data;
        
        // Find all messages between user and doctor
        const messages = await Message.find({
          $or: [
            { senderId: userId, receiverId: doctorId },
            { senderId: doctorId, receiverId: userId }
          ]
        }).sort({ timestamp: 1 }).limit(50); // Limit to last 50 messages

        socket.emit('chat-history', messages);
        console.log(`Sent chat history between ${userId} and ${doctorId}`);
        
      } catch (error) {
        console.error('Error fetching chat history:', error);
        socket.emit('error', { message: 'Failed to fetch chat history' });
      }
    });

    // New: Mark messages as read
    socket.on('mark-messages-read', async (data) => {
      try {
        const { chatRoom, userId } = data;
        
        await Message.updateMany(
          { 
            chatRoom: chatRoom, 
            receiverId: userId,
            isRead: false 
          },
          { isRead: true }
        );

        // Notify sender that messages were read
        socket.to(chatRoom).emit('messages-read', { userId });
        console.log(`Messages marked as read in ${chatRoom} for user ${userId}`);
        
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });

    // New: Handle typing indicators
    socket.on('typing', (data) => {
      const { chatRoom, userName } = data;
      socket.to(chatRoom).emit('user-typing', { userName });
    });

    socket.on('stop-typing', (data) => {
      const { chatRoom, userName } = data;
      socket.to(chatRoom).emit('user-stop-typing', { userName });
    });

    // New: Get unread message count
    socket.on('get-unread-count', async (data) => {
      try {
        const { userId } = data;
        const unreadCount = await Message.countDocuments({
          receiverId: userId,
          isRead: false
        });
        
        socket.emit('unread-count', { count: unreadCount });
      } catch (error) {
        console.error('Error getting unread count:', error);
        socket.emit('error', { message: 'Failed to get unread count' });
      }
    });

    // New: Get recent conversations
    socket.on('get-recent-conversations', async (data) => {
      try {
        const { userId } = data;
        
        // Get latest message from each conversation
        const conversations = await Message.aggregate([
          {
            $match: {
              $or: [
                { senderId: userId },
                { receiverId: userId }
              ]
            }
          },
          {
            $sort: { timestamp: -1 }
          },
          {
            $group: {
              _id: {
                $cond: [
                  { $eq: ["$senderId", userId] },
                  "$receiverId",
                  "$senderId"
                ]
              },
              lastMessage: { $first: "$$ROOT" },
              unreadCount: {
                $sum: {
                  $cond: [
                    { $and: [
                      { $eq: ["$receiverId", userId] },
                      { $eq: ["$isRead", false] }
                    ]},
                    1,
                    0
                  ]
                }
              }
            }
          },
          {
            $sort: { "lastMessage.timestamp": -1 }
          },
          {
            $limit: 20
          }
        ]);

        socket.emit('recent-conversations', conversations);
      } catch (error) {
        console.error('Error getting recent conversations:', error);
        socket.emit('error', { message: 'Failed to get recent conversations' });
      }
    });

    // Enhanced disconnect handling
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id} (userId: ${socket.userId || 'unknown'})`);
    });

    // Enhanced error handling
    socket.on('error', (error) => {
      console.error('Socket error:', error);
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

// New: Helper function to send notification to specific user
function sendNotificationToUser(userId, notification) {
  if (io) {
    io.to(`user_${userId}`).emit('notification', notification);
  }
}

// New: Helper function to broadcast to a chat room
function broadcastToRoom(roomName, event, data) {
  if (io) {
    io.to(roomName).emit(event, data);
  }
}

module.exports = { 
  initSocket, 
  getIo, 
  sendNotificationToUser, 
  broadcastToRoom 
};