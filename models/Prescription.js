const mongoose = require("mongoose");

const rawMaterialDetailSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "RawMaterial",
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0.1,
  },
  pricePerUnit: {
    type: Number,
    required: true,
    min: 0,
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0,
  },
});

const standardScheduleSchema = new mongoose.Schema({
  day: { type: Number, required: true },
  timing: {
    morning: {
      food: { type: String, enum: ["E/S", "L/S"], required: false },
      time: { type: String },
    },
    afternoon: {
      food: { type: String, enum: ["E/S", "L/S"], required: false },
      time: { type: String },
    },
    evening: {
      food: { type: String, enum: ["E/S", "L/S"], required: false },
      time: { type: String },
    },
    night: {
      food: { type: String, enum: ["E/S", "L/S"], required: false },
      time: { type: String },
    },
  },
});

const frequentScheduleSchema = new mongoose.Schema({
  day: { type: Number, required: false },
  frequency: { type: String, required: false }, // e.g. "50 mins once", "1hr 20 mins once"
});

const prescriptionItemSchema = new mongoose.Schema({
  medicineName: {
    type: String,
    required: false,
  },
  rawMaterialDetails: [rawMaterialDetailSchema],
  form: {
    type: String,
    enum: ["Tablets", "Pills", "Liquid form", "Individual Medicine"],
    required: false,
  },
  uom: {
    type: String,
    enum: ["Graam", "Dram", "ML", "Pieces"],
    required: false,
  },
  dispenseQuantity: {
    type: String,
    required: false,
    min: 0.1,
  },
  duration: {
    type: String,
    required: false,
  },
  frequencyType: {
    type: String,
    enum: ["Standard", "Frequent", "standard", "frequent"],
    required: false,
  },
  standardSchedule: [standardScheduleSchema],
  frequentSchedule: [frequentScheduleSchema],
  price: {
    type: Number,
    default: 0,
  },
  additionalComments: {
    type: String,
    default: '',
  },
  // ADD THESE FIELDS TO INDIVIDUAL ITEMS
  prescriptionType: {
    type: String,
    enum: [
      "Only Prescription",
      "Prescription + Medicine", 
      "Medicine + Kit",
      "Only Medicine",
      "Prescription + Medicine kit",
      "SOS Medicine",
    ],
    required: true,
  },
  consumptionType: {
    type: String,
    enum: ["Sequential", "Sequential + Gap", "Parallel"],
    required: true,
  },
  label: {
    type: String,
    enum: ["A", "B", "C", "1", "2", "3", "4"],
    required: false,
  },
});

const prescriptionSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true,
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true,
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment",
  },
  prescriptionItems: [prescriptionItemSchema],
  followUpDays: {
    type: Number,
    default: 10,
  },
  medicineCharges: {
    type: Number,
    default: 0,
  },
  isPayementDone: {
    type: Boolean,
    default: false,
  },
  shippingCharges: {
    type: Number,
    default: 0,
  },
  notes: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  medicineCourse: {
    type: Number, // in days
    required: true,
  },
  action: {
    status: {
      type: String,
      enum: ['In Progress', 'Close'],
      default: 'In Progress',
      required: true
    },
    closeComment: {
      type: String,
      default: ''
    }
  },
  closeComment: {
    type: String,
    default: null,
  },
  subPrescriptionID: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prescription",
    },
  ],
  consultingType: {
    type: String,
  },
  consultingFor: {
    type: String,
  },
});

module.exports = mongoose.model("Prescription", prescriptionSchema);