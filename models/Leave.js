const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true,
  },
  name: {
    type: String, // Store the doctor's name here
    required: true,
  },
  leaveType: {
    type: String,
    enum: ['Sick Leave', 'Casual Leave', 'Paid Leave', 'Maternity'], // Example leave types
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  totalDays: {
    type: Number,
    required: true, 
  },
  reason: {
    type: String,
    required: false,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
});


module.exports = mongoose.model('Leave', leaveSchema);
