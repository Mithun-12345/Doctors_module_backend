const mongoose = require("mongoose");

const postSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true,
  },
  content: { type: String, required: true }, 
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Patient" }],
  comments: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "OTP" },
      comment: { type: String, required: true },
      date: { type: Date, default: Date.now },
    },
  ],
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model("DoctorPost", postSchema);
