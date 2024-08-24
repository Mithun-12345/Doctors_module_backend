const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Types.ObjectId,
      ref: "Doctor",
      required: false,
    },
    patient: {
      type: mongoose.Types.ObjectId,
      ref: "Patient",
      required: false,
    },
    price: { type: String, required: false },
    appointmentDate: {
      type: Date,
      required: true,
    },
    timeSlot: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "cancelled"],
      default: "pending",
    },
    payment: {
      required: false,
      type: Number,
    },
  },
  { timestamps: true }
);

module.exports = new mongoose.model("Appointment", appointmentSchema);
