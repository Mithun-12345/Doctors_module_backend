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
  // unit: {
  //   type: String,
  //   required: true
  // },
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

const prescriptionItemSchema = new mongoose.Schema({
  medicineName: {
    type: String,
    required: true,
  },
  rawMaterialDetails: [rawMaterialDetailSchema],

  form: {
    type: String,
    enum: ["Tablets", "Pills", "Liquid form"],
    required: true,
  },
  uom: {
    type: String,
    enum: ["Graam", "Dram", "ML"],
    required: true,
  },
  // quantity: {
  //   type: Number,
  //   required: true,
  //   min: 0
  // },
  frequency: {
    type: String,
    required: true,
  },
  Duration: {
    type: String,
    required: true,
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
    required: false,
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
  medicineCourse:String,
  action: {
    enum: ["In Progress", "Close"],
    text: {
      default: null,
      type: String,
    },
  },
  subPrescriptionID: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prescription",
    },
  ],
  prescriptionType: {
    enum: [
      "Only Prescription",
      "Prescription + Medicine",
      "Medicine + Kit",
      "Only Medicine",
      "Prescription + Medicine kit",
      "SOS Medicine",
    ],
  },
  consumptionType: {
    enum: ["Sequential", "Sequential + Gap", "Parallel"],
  },
  medicineConsumption: {
    type: String,
  },
  label: {
    enum: ["A", "B", "C", "1", "2", "3", "4"],
  },
  additionalComments: {
    type: String,
    required: false,
  },
});

module.exports = mongoose.model("Prescription", prescriptionSchema);
