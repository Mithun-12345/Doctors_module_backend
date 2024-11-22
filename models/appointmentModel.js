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
    patientName: { type: String, required: true },
    patientEmail: { type: String, required: true }, 
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
      enum: ["pending", "finished", "cancelled", "redirected"],
      default: "pending",
    },
    payment: {
      required: false,
      type: Number,
    },
    isChronic: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
