// models/RawMaterial.js
const mongoose = require('mongoose');

const rawMaterialSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, trim: true },
  category: { type: String, trim: true },
  packageSize: { type: String, trim: true },
  uom: { type: String, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  currentQuantity: { type: Number, required: true, min: 0 },
  thresholdQuantity: { type: Number, required: true, min: 0 },
  expiryDate: { type: Date, required: true },
  barcode: { type: String, trim: true },
  productImage: { type: String, trim: true }, // or Buffer if storing file data
  costPerUnit: { type: Number, required: true, min: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RawMaterial', rawMaterialSchema);
