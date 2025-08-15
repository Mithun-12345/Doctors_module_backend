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
  totalWeight:{type: Number},
  isAlcohol:{type:Boolean,default:false},
  totalLeakedQuantity:{type:Number,default:0},
  storageLeakedQuantity:{type:Number,default:0},
  vendorName:{type:String},
  vendorLocation:{type:String},
  vendorPhone:{type:Number},
  // Unique barcode
  barcode: { type: String, required: true, unique: true },
  barcodeImageUrl: { type: String, trim: true }, // Cloudinary URL
  productImage: { type: String, trim: true },
  bottleWeight:{type:Number},
  costPerUnit: { type: Number, required: true, min: 0 },

  // Amendment status
  IsAmendment: { type: Boolean, default: false },

  // ✅ New fields for status tracking
  isPresent: { type: Boolean, default: true },
  isDamaged: { type: Boolean, default: false },
  isSealed: { type: Boolean, default: true },

  usageStatus: {
  type: String,
  enum: ['used', 'unused'],
  default: 'unused'
},
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RawMaterial', rawMaterialSchema);



