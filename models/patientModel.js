const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
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
      required: true,
      unique: true,
    },
    whatsappNumber: {
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
    profilePhoto: {
      type: String,
      default: "", // will be set either to Cloudinary URL or avatar URL
    },
    medicalRecords: {
      // no need in frontend set default as No
      type: String,
      default: "pending",
    },
    // callFromApp: {
    //   //no need in frontend set default as No
    //   type: String,
    //   default: "pending",
    // },
    patientEntry: {
      //add in frontend with drop down as insta, fb, google
      type: String,
    },
    currentLocation: {
      //add in frontend
      type: String,
    },

    appointmentFixed: {
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
  },
  { timestamps: true }
);

module.exports = mongoose.model("Patient", patientSchema);
