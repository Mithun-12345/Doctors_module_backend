const mongoose = require("mongoose");

const chronicSchema = new mongoose.Schema(
  {
    phone: { type: Number, required: false },
    name: { type: String, required: false },
    dob: { type: String, required: false },
    age: { type: Number, required: false },
    weight: { type: Number, required: false },
    height: { type: Number, required: false },
    occupation: { type: String, required: false },
    country: { type: String, required: false },
    state: { type: String, required: false },
    city: { type: String, required: false },
    complaint: { type: String, required: false },
    symptoms: { type: String, required: false },
    associatedDisease: { type: String, required: false },
    allopathy: { type: String, required: false },
    diseaseHistory: { type: String, required: false },
    surgeryHistory: { type: String, required: false },
    allergies: { type: String, required: false },
    bodyType: { type: String, required: false },
    clinicReferral: { type: String, required: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Chronic", chronicSchema);
