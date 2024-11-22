const mongoose = require('mongoose');

const workHoursSchema = new mongoose.Schema({
  doctor: { type: mongoose.Types.ObjectId, ref: 'Doctor', required: true },
  date: { type: Date, required: true }, // Use only the date part
  checkIn: { type: Date, required: true }, // Login time
  checkOut: { type: Date }, // Logout time
  totalHours: { type: Number, default: 0 }, // Total hours worked
});

module.exports = mongoose.model('WorkHours', workHoursSchema);
