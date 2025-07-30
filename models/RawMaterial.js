const mongoose = require('mongoose');

const rawMaterialSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, trim: true },
  category: { type: String, trim: true },
  packageSize: { type: String, trim: true },
  uom: { type: String, trim: true }, // e.g., 'g', 'ml', 'sheets'
  quantity: { type: Number, required: true, min: 0 },
  currentQuantity: { type: Number, required: true, min: 0 },
  thresholdQuantity: { type: Number, required: true, min: 0 },
  expiryDate: { type: Date, required: true },

  // Unique barcode text like "RM<OBJECTID>"
  barcode: { type: String, required: true, unique: true },

  // Store barcode image (either base64 string or URL to cloud-hosted PNG)
  barcodeImageUrl: { type: String, trim: true }, // Cloudinary URL

  productImage: { type: String, trim: true },
  costPerUnit: { type: Number, required: true, min: 0 },

  // New field
  IsAmendment: { type: Boolean, required: false,default: false },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RawMaterial', rawMaterialSchema);


