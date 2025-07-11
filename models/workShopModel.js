const mongoose = require("mongoose");

const workshopSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  meetLink: {
    type: String,
    required: false,
  },
  scheduledDateTime: {
    type: Date,
    required: true,
  },
  allowedParticipants: {
    type: String,
    enum: ["Doctors", "Patients", "Everyone"],
    required: true,
  },
  participants: [
    { type: mongoose.Schema.Types.ObjectId, refPath: "allowedParticipants" },
  ], // Array of users who booked
  fee: {
    type: Number,
    required: true,
    min: 0,
  },
  limit: {
    type: Number,
  },
  // createdAt: {
  //   type: Date,
  //   default: Date.now,
  // },
});

module.exports = mongoose.model("Workshop", workshopSchema);
