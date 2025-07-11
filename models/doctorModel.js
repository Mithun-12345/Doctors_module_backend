const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
  {
    // Personal Details
    name: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, required: true },
    age: { type: Number, required: true },
    maritalStatus: {
      type: String,
      enum: ["Single", "Married"],
      required: true,
    },
    nationality: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    secondaryContact: { type: String },
    personalEmail: { type: String, required: true, unique: true },
    currentAddress: { type: String, required: true },
    permanentAddress: { type: String },
    emergencyContactName: { type: String, required: true },
    emergencyContactRelationship: { type: String, required: true },
    emergencyContactNumber: { type: String, required: true },

    // Job Details
    employeeID: { type: String, required: true, unique: true },
    role: {
      type: String,
      enum: ["admin-doctor", "assistant-doctor", "Executive"],
      default: "assistant-doctor",
      required: true,
    },
    department: { type: String, required: true },
    dateOfJoining: { type: Date, required: true },
    employmentType: { type: String, required: true },
    workLocation: { type: String, required: true },
    reportingManager: { type: String, required: true },
    // workShift: { type: String, required: true },
    workShift: { type: String, required: true },

    // Compensation Details
    basicSalary: { type: Number, required: true },
    allowances: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    bankAccountNumber: { type: String, required: true },
    bankName: { type: String, required: true },
    ifscCode: { type: String, required: true },
    paymentFrequency: { type: String, required: true },
    pfNumber: { type: String },
    esiNumber: { type: String },
    taxDeductionPreferences: { type: String },

    // System Access
    usernameSystemAccess: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    accessLevel: { type: String, required: true },
    // digitalSignature: { type: String },

    // Educational Background
    highestQualification: { type: String, required: true },
    specialization: { type: String },
    yearOfGraduation: { type: Number },

    // Work Experience
    previousEmployer: { type: String },
    previousDuration: { type: String },
    previousJobRole: { type: String },
    totalExperience: { type: String },

    // Additional Details
    certifications: { type: [String] },
    medicalRegistrationNumber: { type: String },
    documents: [
      {
        originalname: String,
        path: String,
        size: Number,
      },
    ],
    digitalSignature: {
      originalname: String,
      path: String,
      size: Number,
    },
    follow: {
      type: String,
      default: "",
    },
    videoPlatform: {
      type: String,
      enum: ["googleMeet", "zoom"],
      default: "googleMeet",
    },
    profilePhoto: {
      type: String,
      default: "", // will be set either to Cloudinary URL or avatar URL
    },
    googleAccessToken: { type: String }, // Field for Google access token
    googleRefreshToken: { type: String }, // Field for Google refresh token
    zoomAccessToken: { type: String }, // Field for Zoom access token
    zoomRefreshToken: { type: String }, // Field for Zoom refresh token
    zoomTokenExpiration: { type: Date },
    // Timestamps
  },
  { timestamps: true }
);

const Doctor = mongoose.model("Doctor", doctorSchema);

module.exports = Doctor;
