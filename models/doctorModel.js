const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String, required: false },
  age: { type: Number, required: false },
  gender: { type: String, required: false },
  photo: { type: String },
  specialization: { type: String, required: false },
  bio: { type: String },
  role: {
    type: String,
    enum: ["admin-doctor", "assistant-doctor", "Executive"], // Enum for the role field
    default: "assistant-doctor", // Default value if no role is provided
    required: true,
  },
  follow: {
    type: String,
    default: "No follows",
  },
  reAllocationPerm: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model("Doctor", doctorSchema);
