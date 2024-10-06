const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    consultingFor: {
      type: String,
      required: true
    },
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
    whatsappNumber: {
      type: Number,
      required: true
    },
    email: {
      type: String,
      required: false,
    },
    gender: {
      type: String,
      required: false,
    },
    diseaseName: {//consultingReason
      type: String,
      required: false,
    },
    diseaseType: {//no need in frontend set default as Acute
      type: String,
      required: false,
    },
    medicalRecords: {// no need in frontend set default as No
      type: String,
      default: "pending"
    },
    callFromApp: {//no need in frontend set default as No
        type: String,
        default: 'pending'
    },
    patientEntry: {//add in frontend with drop down as insta, fb, google
        type: String,
    },
    currentLocation: {//add in frontend
        type: String,
    },
    messageSent: {// no need in frontend set default as No 
        status: {
            type: Boolean,
            default: false
        },
        timeStamp: {
            type: Date,
            default: null
        }
    },
    follow: {// no need in frontend set default as PCall
        type: String,
        default: "Follow up-PCall"
    },
    followComment: {//no need in frontend
        type: String,
        default: "No comments"
    },
    enquiryStatus: {//no need in frontend
        type: String,
        enum: ["Interested", "Not Interested", "Not Enquired"],
        default: "Not Enquired"
    },
    appointmentFixed: {//no need in frontend
        type: String,
        enum: ["Yes", "No"],
        default: "No"
    },
    medicalPayment: {//no need in frontend
        type: String,
        enum: ["Yes", "No"],
        default: "No"
    },
    appDownload: {//no need in frontend
        type: Number,
        default: 0
    },
    callCount: {//no need in frontend
        type: Number,
        default: 0
    },
    comments: {//no need in frontend
        type: String,
        default: "No comments"
    },
    symptomNotKnown: {//no need in frontend
        type: String,
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Patient", patientSchema);
