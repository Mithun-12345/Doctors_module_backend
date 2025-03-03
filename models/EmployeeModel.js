const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  // Personal Details
  name: { type: String, required: true },
  dateOfBirth: { type: Date, required: true },
  gender: { type: String, enum: ['Male', 'Female'], required: true },
  maritalStatus: { type: String, enum: ['Single', 'Married'], required: true },
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
  workShift: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", required: true },


  // Compensation Details
  basicSalary: { type: Number, required: true },
  allowances: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 },
  bankAccountNumber: { type: String, required: true },
  bankName: { type: String, required: false },
  ifscCode: { type: String, required: true },
  paymentFrequency: { type: String,required: true },
  pfNumber: { type: String },
  esiNumber: { type: String },
  taxDeductionPreferences: { type: String },

  // System Access
  usernameSystemAccess: { type: String, required: true, unique: true },
  temporaryPassword: { type: String, required: true },
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
  //documents: { type: [String] }, // Array of document file paths or names

  // Timestamps
}, { timestamps: true });

module.exports = mongoose.model('Employee', employeeSchema);
