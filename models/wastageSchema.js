const mongoose = require('mongoose');

const rawMaterialUsedSchema = new mongoose.Schema({
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RawMaterial',
    required: true
  },
  materialName: { type: String, required: true },
  isAlcohol: { type: Boolean, default: false },
  quantityUsed: { type: Number},
  type: { type: String, trim: true },
  category: { type: String, trim: true },
  packageSize: { type: String, trim: true },
  netitemUsed:{type:Number},
  leakageDetected:{type:Boolean,default:false},
  quantityLeaked:{type:Number},
  uom: { type: String, trim: true },
  costPerUnit: { type: Number, required: true, min: 0 },
  totalCost: { type: Number, required: true, min: 0 },
  expiryDate: { type: Date, required: true },
  barcode: { type: String, required: true },
  preWeight: { type: Number, default: null, min: 0 },
  postWeight: { type: Number, default: null, min: 0 },
  totalWeight: { type: Number, default: null, min: 0 }  // optional if needed
}, { _id: false });

const medicinePreparationDetailSchema = new mongoose.Schema({
  medicineName: { type: String, required: true },
  preparationVideoUrl: { type: String, trim: true }, // Optional video link
  medPrepStartTime:{type:Date,default:Date.now},
  preparationPhoto:{type:String,trim:true},
  imageUrl:{type:String,trim:true},
  rawMaterialsUsed: [rawMaterialUsedSchema],
  attempt:{type:String,default:0},
}, { _id: false });

const WastageLog = new mongoose.Schema({
  prescriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription',
    required: true
  },
  medicinePreparations: [medicinePreparationDetailSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WastageLog', WastageLog);
