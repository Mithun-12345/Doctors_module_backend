// models/Medicine.js
const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  category: { type: String, required: true },
  stock: { type: Number, required: true, min: 0 },
  batchNumber: { type: String, required: true },
  expiryDate: { type: Date, required: true },
  manufacturer: { type: String, required: true },
  pricePerUnit: { type: Number, required: true, min: 0 },
  dosage: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Medicine', medicineSchema);
