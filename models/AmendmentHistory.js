// models/AmendmentHistory.js
const mongoose = require('mongoose');

const amendmentHistorySchema = new mongoose.Schema({
  rawMaterialId: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
  updatedBy: { type: String }, // Or userId if you track that
  changes: { type: Object, required: true },
  amendedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AmendmentHistory', amendmentHistorySchema);

