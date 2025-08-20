const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    // The user who receives the notification
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    // The message content
    message: {
      type: String,
      required: true,
    },
    // A category for the notification
    type: {
      type: String,
      enum: [
        "APPOINTMENT_RESERVED",
        "APPOINTMENT_REMINDER",
        "PRESCRIPTION_STARTED",
        "PRESCRIPTION_READY",
        "PRESCRIPTION_PAYMENT_DUE",
        "MEDICINE_PREPARATION_STARTED",
        "MEDICINE_SHIPMENT_DONE"
      ],
      required: true,
    },
    // The read/unread status
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    // A URL for the user to navigate to when clicking the notification
    link: {
      type: String,
    },
  },
  { timestamps: true } // Adds `createdAt` and `updatedAt` fields
);

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;