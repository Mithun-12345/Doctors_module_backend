  const mongoose = require('mongoose');

  const messageSchema = new mongoose.Schema({
    sender: {
      type: String,
      required: true
    },
    receiver: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: false // ✅ Changed to false to allow file-only messages
    },
    senderName: {
      type: String,
      required: true
    },
    receiverName: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    isRead: {
      type: Boolean,
      default: false
    },
    
    // ✅ NEW: File attachment support for Cloudinary
    fileAttachment: {
      url: {
        type: String,
        required: false
      },
      publicId: {
        type: String,
        required: false
      },
      fileName: {
        type: String,
        required: false
      },
      fileType: {
        type: String,
        required: false
      },
      fileSize: {
        type: Number,
        required: false
      }
    },
    
    // ✅ NEW: Message type to differentiate between text and file messages
    messageType: {
      type: String,
      enum: ['text', 'file'],
      default: 'text'
    }
  });

  // ✅ NEW: Index for better query performance
  messageSchema.index({ sender: 1, receiver: 1, timestamp: 1 });
  messageSchema.index({ timestamp: -1 });

  module.exports = mongoose.model('Message', messageSchema);