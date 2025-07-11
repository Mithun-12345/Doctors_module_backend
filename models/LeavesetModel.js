const mongoose = require('mongoose');

// Define the schema for Leaveset
const leavesetSchema = new mongoose.Schema({
    // selectionType: {
    //     type: String, // Custom or Random
    //     required: true,
    //   },
    //   days: {
    //     type: [String], // Array of working days, e.g., ["Monday", "Tuesday"]
    //     required: true,
    //   },
    //   numOfDays: {
    //     type: Number, // Number of selected days
    //     required: true,
    //   },
  name: {
    type: String,
    required: true,
  },
  fromDate: {
    type: Date,
    required: true,
  },
  toDate: {
    type: Date,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
}, { timestamps: true }); // Automatically adds createdAt and updatedAt fields

// Create the model for Leaveset
const Leaveset = mongoose.model('Leaveset', leavesetSchema);

module.exports = Leaveset;
