const mongoose = require("mongoose");
const crypto = require("crypto"); // --- NEW ADDITION ---
const bcrypt = require("bcryptjs"); // --- NEW ADDITION ---
// --- NEW: Define the schema for a single follow-up call entry ---
const followUpCallSchema = new mongoose.Schema({
    date: {
        type: Date,
        default: Date.now
    },
    callMade: {
        type: Boolean,
        default: false
    }
}, { _id: false });

const patientSchema = new mongoose.Schema(
  {
    password: { type: String, required: false },
    name: {
      type: String,
      required: false,
    },
patientUniqueId: {
      type: String,
      required: true,
      unique: true, // <--- Ensures no duplicates in the database
      trim: true    // <--- Removes accidental whitespace
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
    phoneAllowed:{
      type: Boolean,
      default:false 
    },
// ============================================================
    //  NEW PATIENT WELCOME CALL TRACKER
    // ============================================================
    newPatientFollowUp: {
      scheduledTime: { type: Date },
      status: {
        type: String,
        enum: ['Pending', 'Overdue', 'Rescheduled', 'Lost', 'Completed'],
        default: 'Pending'
      },
      callsMade: { type: Number, default: 0 }, // The counter
      remarks: { type: String, default: "" },
      
      // NEW: The Audit Log
      history: [
        {
          action: { type: String }, // e.g., "Call Attempt", "Rescheduled"
          timestamp: { type: Date, default: Date.now },
          note: String,
          _id: false // No need for separate IDs here
        }
      ]
    },
    // ============================================================
    followUpCallsMade: [followUpCallSchema],
    firstLoginTime:{
      type:Date
    },
    firstLoginDone:{
      type:Boolean,
      default:false
    },
    phoneReceived:{
        type:Number,
        default: 0
    },
    userStatus: {
      type: String,
      enum: ['Active', 'Inactive', 'Dormant', 'Exit'],
      default: 'Active'
    },
    isBotActive : {
      type : Boolean,
      default : true
    },
    loginAttempts: {
        type: Number,
        required: true,
        default: 0
    },
    lockUntil: {
        type: Number // Stores a timestamp (e.g., from Date.now())
    },
    address: {
      type: String,
      required: false,
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
      type: String
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
    reminderOffset: {
      type: Number,
      enum: [5, 10, 15],
      default: 10, // or choose your default
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    requiresPasswordReset:{
      type: Boolean,
      default:false
    },
    patientStage: {
      type: String
    },
    firstCycleCompleted: {
      type: Boolean,
      default: false, // This will be set to true when the patient reaches the final stage
    },

    // --- NEW FIELDS ADDED FOR PASSWORD SETTING ---
    passwordSetToken: String,
    passwordSetExpires: Date,
    // ------------------------------------------

  },
  { timestamps: true }
);


// --- NEW ADDITION: HASH PASSWORD BEFORE SAVING ---
// This function will automatically run when you save a patient with a new password
patientSchema.pre("save", async function(next) {
  // Only run this function if the password was actually modified and exists
  if (!this.isModified("password") || !this.password) {
    return next();
  }

  // Hash the password with a cost of 12
  this.password = await bcrypt.hash(this.password, 12);

  // Once the password is set, we don't need the token anymore
  this.passwordSetToken = undefined;
  this.passwordSetExpires = undefined;

  next();
});

// --- NEW ADDITION: METHOD TO GENERATE THE SECURE TOKEN ---
patientSchema.methods.createPasswordSetToken = function() {
  // 1. Generate a random token
  const setToken = crypto.randomBytes(32).toString("hex");

  // 2. Hash the token and store it in the database (for security)
  this.passwordSetToken = crypto
    .createHash("sha256")
    .update(setToken)
    .digest("hex");

  // 3. Set an expiration time (e.g., 10 minutes)
  this.passwordSetExpires = Date.now() + 10 * 60 * 1000;

  // 4. Return the UN-HASHED token to be sent in the email
  return setToken;
};


module.exports = mongoose.model("Patient", patientSchema);