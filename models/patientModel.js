const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: false,
    },
    age: {
      type: Number,
      required: false,
    },
    phone: {
      type: String,
      required: false,
    },
    email: {
      type: String,
      required: false,
    },
    gender: {
      type: String,
      required: false,
    },
    diseaseName: {
      type: String,
      required: false,
    },
    diseaseType: {
      type: String,
      required: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Patients", patientSchema);

//add field for result of model - acute / chronic
