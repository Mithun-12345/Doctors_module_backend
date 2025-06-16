// models/Medicine.js
const mongoose = require("mongoose");

const medicineSchema = new mongoose.Schema({
  name: { type: String, required: false, trim: false },
  description: { type: String, trim: false },
  category: { type: String, required: false },
  stock: { type: Number, required: false, min: 0 },
  batchNumber: { type: String, required: false },
  expiryDate: { type: Date, required: false },
  manufacturer: { type: String, required: false },
  pricePerUnit: { type: Number, required: false, min: 0 },
  dosage: { type: String, required: false },
  composition: [
    {
      rawMaterial: { type: mongoose.Schema.Types.ObjectId, ref: "RawMaterial" },
      quantity: Number,
    },
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Medicine", medicineSchema);
