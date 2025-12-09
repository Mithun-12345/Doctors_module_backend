const mongoose = require("mongoose");

const followUpSettingsSchema = new mongoose.Schema(
  {
    // Determines how many minutes AFTER the scheduled time the "Call" button stays green
    // The "Start Time" is now implicitly the Scheduled Time itself.
    allowCallAfterMinutes: {
      type: Number,
      required: true,
      default: 60, // Default: You have 1 hour from the scheduled time to make the call.
      min: 1,      // Minimum 1 minute window
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", 
      required: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FollowUpSetting", followUpSettingsSchema);