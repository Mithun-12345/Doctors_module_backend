const mongoose = require("mongoose");

const callLogSchema = new mongoose.Schema({
 
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true
  },
  patientPhone: {
    type: String,
    required: true
  },
  referenceId: {
    type: String,
    required: true
  },
  providerCallId: {
    type: String
  },
  direction: {
    type: String,
    enum: ["agent_to_patient"],
    default: ""
  },
  status: {
    type: String,
    enum: [
      "initiated",
      "ringing",
      "connected",
      "completed",
      "missed",
      "failed"
    ],
    default: ""
  },
  duration: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model("CallLog", callLogSchema);
