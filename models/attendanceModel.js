const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    employeeID: {
      type: String,
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    lastCheckIn: {
      type: Date,
      default: null,
    },
    lastCheckOut: {
      type: Date,
      default: null,
    },
    totalElapsedTime: {
      type: Number, // Store in hours instead of seconds
      default: 0,
    },                
    breakTime: {
      type: Number, // Store in hours
      default: 0,
    },
  },
  { timestamps: true }
);
  

module.exports = mongoose.model("Attendance", attendanceSchema);
