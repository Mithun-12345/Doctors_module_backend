const mongoose = require("mongoose");

const callLogSchema = new mongoose.Schema(
  {
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


    unique_id: {
      type: String
    },

    direction: {
      type: String,
      enum: ["agent_to_patient"],
      default: "agent_to_patient"
    },

    call_status: {
      type: String,
      enum: [
        "initiated",
        "ringing",
        "connected",
        "completed",
        "missed",
        "failed"
      ],
      default: "initiated"
    },

    duration: {
      type: Number,
      default: 0
    },


    recording_url: {
      type: String
    },

    providerResponse: {
      type: Object
    },


    errorMessage: {
      type: String
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("CallLog", callLogSchema);