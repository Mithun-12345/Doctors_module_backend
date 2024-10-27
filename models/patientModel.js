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

const patientSchema = new mongoose.Schema(
  {
    consultingFor: {
      type: String,
      required: false,
    },
    password: { type: String, required: false },
    name: {
      type: String,
      required: false,
    },
    age: {
      type: Number,
      required: false,
    },
    newExisting: {
      type: String,
      enum: ["New", "Existing"],
      default: "New",
      required: false,
    },
    phone: {
      type: String,
      required: false,
    },
    whatsappNumber: {
      type: Number,
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
    medicalRecords: {
      // no need in frontend set default as No
      type: String,
      default: "pending",
    },
    callFromApp: {
      //no need in frontend set default as No
      type: String,
      default: "pending",
    },
    patientEntry: {
      //add in frontend with drop down as insta, fb, google
      type: String,
    },
    currentLocation: {
      //add in frontend
      type: String,
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
    enquiryStatus: {
      //no need in frontend
      type: String,
      enum: ["Interested", "Not Interested", "Not Enquired"],
      default: "Not Enquired",
    },
    appointmentFixed: {
      //no need in frontend
      type: String,
      enum: ["Yes", "No"],
      default: "No",
    },
    medicalPayment: {
      //no need in frontend
      type: String,
      enum: ["Yes", "No"],
      default: "No",
    },
    appDownload: {
      //no need in frontend
      type: Number,
      default: 0,
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
    coupon: {
      type: String,
      required: false,
    },
    familyMembers: [
      {
        memberId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Patient",
          required: true,
        },
        IndividulAccess: {
          type: Boolean,
          default: false,
        },
        relationship: {
          type: String,
          enum: [
            "Father",
            "Mother",
            "Son",
            "Daughter",
            "Father in law",
            "Mother in law",
          ],
          required: true,
        },
        name: {
          type: String,
          required: true, // Add name field to identify the family member
        },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Patient", patientSchema);
