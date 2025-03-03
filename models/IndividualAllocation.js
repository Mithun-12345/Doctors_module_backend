const mongoose = require('mongoose');

const individualAllocationSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    createdAt: { type: Date, default: Date.now }
  });

module.exports = mongoose.model('IndividualAllocation', individualAllocationSchema);