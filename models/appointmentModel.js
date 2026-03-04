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
const followUpCallSchema = new mongoose.Schema({
  callDate: {
    type: Date,
    required: true, // Stores the date and time of the call
  },
  status: {
    type: String, 
    default: "Pending", // e.g., "Done", "Ringing", "Patient Busy", "Network Issue"
    // User requested explicitly NO ENUM here to allow flexibility
  },
  remarks: { 
    type: String, // Optional: Useful if you need to type "Patient asked to call back in 10 mins"
    default: "",
  },
  rescheduleCount: {
    type: Number,
    default: 0
  }
});
const appointmentSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Types.ObjectId,
      ref: "Doctor",
      required: false,
    },
    
    patient: {
      type: mongoose.Types.ObjectId,
      ref: "Patient",
      required: false,
    },
    isEmergency: {
    type: Boolean,
    default: false,
  },
    // --- NEW FIELD ADDED HERE ---
    appointmentUniqueId: {
  type: String,
  required: true,
  unique: true,

},
    price: { type: String, required: false },
    appointmentDate: {
      type: Date,
      required: true,
    },
    timeSlot: {
      type: String,
      required: true,
    },
    payment: {
      required: false,
      type: Number,
    },
    paymentSettled: {
      required: false,
      type: Boolean,
    },
    isChronic: {
      type: Boolean,
      default: false,
    },
    expiresAt: { type: Date, index: { expires: "1m" } },
    // including from patient model !!!!
    // consultingFor: {
    //   type: mongoose.Types.ObjectId,
    //   ref: "Patient",
    //   required: true, // We should enforce that we always store id
    // },
    consultingFor: {
      type: String, // Changed from mongoose.Schema.Types.ObjectId
      required: false
    },
    followUpCalls: [followUpCallSchema],
    diseaseName: {
      //consultingReason
      type: String,
      required: false,
    },
    diseaseType: {
      name: {
        type: String,
        default: "Acute",
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
    follow: {
      // no need in frontend set default as PCall
      type: String,
      default: "Consultation",
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
    prescriptionCreated: {
      type: Boolean,
      default: false,
    },
    noShow:{
      type:Boolean,
      default:null
    },
    reschedule:{
      type:Boolean,
      default:false
    },    
    medicinePrepared:{
      type:Boolean,
      default: false,
    },
    appointmentSlotType:{
      type:String
    },
    rescheduleCharges:{
      type: Number,
    },
// In appointmentModel.js
    prescriptionID: [{  // <--- Changed to Array of Objects
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prescription",
    }],
    callCount: {
      //no need in frontend
      type: Number,
      default: 0,
    },
    lastCallMade: {
      type: Date,
      default: null
    },
    comments: [commentSchema],
    symptomNotKnown: {
      //no need in frontend
      type: String,
    },
    classification: {
      //no need in frontend
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "reserved", "confirmed", "cancelled", "completed"],
      default: "reserved",
    },
    reservedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    meetLink: {
      type: String,
      required: false,
      default: "https://meet.google.com/jrz-wxor-gph"
    },
    notes: {
      type: String,
      default: "",
    },
    isPaid: { type: Boolean, default: false },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
    expiresAt: { type: Date, index: { expires: "1m" } }, // MongoDB TTL to auto-delete unpaid appointments
  },
  { timestamps: true }
);


appointmentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model("Appointment", appointmentSchema);
