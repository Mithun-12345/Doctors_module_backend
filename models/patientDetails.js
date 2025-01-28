const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const patientDetailsSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    consultingFor: {
      type: String,
      required: false,
    },
    diseaseName: {
      //consultingReason
      type: String,
      required: false,
    },
    diseaseType: {
      name: {
        type: String,
        required: false, // Allows this field to be optional
      },
      edit: {
        type: Boolean, // Indicates if the field has been edited
        default: false, // Set to false by default
      },
      editedby: {
        type: String,
        default: null,
        required: false,
      },
    },
    messageSent: {
      // no need in frontend set default as No
      status: {
        type: Boolean,
        default: false,
      },
      timeStamp: {
        type: Date,
        default: null,
      },
    },
    enquiryStatus: {
      //no need in frontend
      type: String,
      enum: ["Interested", "Not Interested", "Not Enquired"],
      default: "Not Enquired",
    },
    follow: {
      // no need in frontend set default as PCall
      type: String,
      default: "Follow up-PCall",
    },
    followComment: {
      //no need in frontend
      type: String,
      default: "No comments",
    },
    followUpTimestamp: {
      type: Date,
      default: null, // Set this when the follow-up status transitions to 'Follow up-Mship'
    },
    medicalPayment: {
      //no need in frontend
      type: String,
      enum: ["Yes", "No"],
      default: "No",
    },
    callCount: {
      //no need in frontend
      type: Number,
      default: 0,
    },
    comments: [commentSchema],
    symptomNotKnown: {
      //no need in frontend
      type: String,
    },
});

module.exports = mongoose.model("PatientDetails", patientDetailsSchema);