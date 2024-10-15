const mongoose = require('mongoose');

const allocationSchema = new mongoose.Schema({
  role: {
    type: String,
    required: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: false
  },
  followUpType: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Allocation', allocationSchema);