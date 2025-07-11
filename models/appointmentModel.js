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
    price: { type: String, required: false },
    appointmentDate: {
      type: Date,
      required: true,
    },
    timeSlot: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "finished", "cancelled"],
      default: "pending",
    },
    payment: {
      required: false,
      type: Number,
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
      default: "Follow up-C",
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
    status: {
      type: String,
      enum: ["reserved", "confirmed", "cancelled", "completed"],
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
