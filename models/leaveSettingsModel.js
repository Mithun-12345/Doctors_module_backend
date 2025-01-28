const mongoose = require('mongoose');

const LeaveSettingsSchema = new mongoose.Schema({
  sickLeave: { type: Number, required: true, default: 10 },
  casualLeave: { type: Number, required: true, default: 10 },
  paidLeave: { type: Number, required: true, default: 15 },
  maternityLeave: { type: Number, required: true, default: 180 }, // days
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor', // Refers to the admin-doctor setting the values
    required: true,
  },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('LeaveSettings', LeaveSettingsSchema);
