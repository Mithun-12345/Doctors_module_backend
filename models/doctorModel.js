const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String, required: false },
  password: { type: String, required: true },
  age: { type: Number, required: false },
  gender: { type: String, required: false },
  photo: { type: String },
  specialization: { type: String, required: false },
  bio: { type: String },
  role: {
    type: String,
    enum: ["admin-doctor", "assistant-doctor", "Executive"],
    default: "assistant-doctor",
    required: true,
  },
  follow: {
    type: String,
    default: ""
  },
  videoPlatform: {
    type: String, 
    enum: ['googleMeet', 'zoom'],
    default: 'googleMeet',
  },
  googleAccessToken: { type: String },  // Field for Google access token
  googleRefreshToken: { type: String }, // Field for Google refresh token
  zoomAccessToken: { type: String },    // Field for Zoom access token
  zoomRefreshToken: { type: String },   // Field for Zoom refresh token
  zoomTokenExpiration: { type: Date },
});

module.exports = mongoose.model("Doctor", doctorSchema);
