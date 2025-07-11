const mongoose = require('mongoose');

const shiftSettingsSchema = new mongoose.Schema({
  name: { type: String, required: true },
  employeeID: { type: String, required: true },
  shift: { type: String, required: true },
});

module.exports = mongoose.model('ShiftSettings', shiftSettingsSchema);
