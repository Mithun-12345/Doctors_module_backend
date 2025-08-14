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
  rawMaterialsUsed: [rawMaterialUsedSchema],
  preparationPhoto:{type:String,trim:true},
  attempt:{type:String,default:0},
  instructions: {
    type: Map,
    of: Boolean,
    default: {}
  },
  medicineExpiryDate:{type:String,trim:true},
}, { _id: false });
const packagingDetailSchema = new mongoose.Schema({
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RawMaterial', // Links to the packaging item in your RawMaterial inventory
    required: false
  },
  materialName: { type: String, required: false},
  packageSize: { type: String, trim: true },
  presentQuantity: { type: Number }, // Optional: Quantity on hand before use
  quantityUsed: { type: Number, required: false, default: 1 },
  label: { type: String, trim: true }, // e.g., 'Main Label', 'Cautionary Label'
  packedImageUrl: { type: String, trim: true }, // Optional URL to a photo of the final packed item
  deliveryPartner:{type:String,trim:true},
  shippedDate:{type:String},
  arrivalDate:{type:String},
  shipmentId:{type:String,trim:true},
  shipmentStatus:{type:Boolean,default:false},
}, { _id: false });

const medicinePreparationSummarySchema = new mongoose.Schema({
  prescriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription',
    required: true
  },
  medicinePreparations: [medicinePreparationDetailSchema],
  createdAt: { type: Date, default: Date.now },
  packagingUsed: [packagingDetailSchema],
});
// New schema for tracking a single packaging item used


module.exports = mongoose.model('MedicinePreparationSummary', medicinePreparationSummarySchema);

