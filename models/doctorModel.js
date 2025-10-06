const mongoose = require("mongoose");
const crypto = require("crypto"); // --- NEW ADDITION ---
const bcrypt = require("bcryptjs"); // --- NEW ADDITION ---

// --- NEW: Define the schema for a single attendance entry ---
const attendanceRecordSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['Present', 'Absent', 'Late'],
        required: true
    },
    notes: {
        type: String,
        trim: true
    }
}, { _id: false });

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
    attendanceRecords: [attendanceRecordSchema],

    // System Access
    usernameSystemAccess: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    accessLevel: { type: String, required: true },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    userStatus: {
      type: String,
      enum: ['Active', 'Inactive', 'Dormant', 'Exit'],
      default: 'Active'
    },
    // --- NEW FIELDS ADDED FOR PASSWORD FUNCTIONALITY ---
    passwordSetToken: String,
    passwordSetExpires: Date,
    // ---------------------------------------------------

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
  },
  { timestamps: true }
);
// --- PASTE THE FOLLOWING CODE BLOCK HERE ---

// HASHES PASSWORD WHEN IT'S MODIFIED
doctorSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordSetToken = undefined;
  this.passwordSetExpires = undefined;
  next();
});

// GENERATES THE PASSWORD RESET TOKEN
doctorSchema.methods.createPasswordSetToken = function () {
  const setToken = crypto.randomBytes(32).toString("hex");
  this.passwordSetToken = crypto
    .createHash("sha256")
    .update(setToken)
    .digest("hex");
  this.passwordSetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return setToken;
};

// -----------------------------------------
const Doctor = mongoose.model("Doctor", doctorSchema);

module.exports = Doctor;