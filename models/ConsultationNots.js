const mongoose = require('mongoose');

const consultationNoteSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  note: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ConsultationNote', consultationNoteSchema);