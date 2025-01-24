const mongoose = require("mongoose");

const shiftSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // Morning, Evening, or Night
    startTime: { type: String, required: true }, // Start time in HH:MM format
    endTime: { type: String, required: true },   // End time in HH:MM format
  },
  { timestamps: true } // Automatically add createdAt and updatedAt fields
);

module.exports = mongoose.model("Shift", shiftSchema);
