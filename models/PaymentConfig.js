const mongoose = require('mongoose');

const paymentConfigSchema = new mongoose.Schema({
  weekdayAcute: {
    type: Number,
    required: true,
    min: 0
  },
  weekdayChronic: {
    type: Number,
    required: true,
    min: 0
  },
  weekendAcute: {
    type: Number,
    required: true,
    min: 0
  },
  weekendChronic: {
    type: Number,
    required: true,
    min: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  }
}, {
  timestamps: true
});

// Add indexes for query optimization
paymentConfigSchema.index({ lastUpdated: -1 });

module.exports = mongoose.model('PaymentConfig', paymentConfigSchema);