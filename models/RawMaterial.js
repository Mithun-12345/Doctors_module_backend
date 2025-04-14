// models/RawMaterial.js
const mongoose = require('mongoose');

const rawMaterialSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true },
  supplier: { type: String, required: true },
  batchNumber: { type: String, required: true },
  purchaseDate: { type: Date, required: true },
  expiryDate: { type: Date, required: true },
  costPerUnit: { type: Number, required: true, min: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RawMaterial', rawMaterialSchema);
