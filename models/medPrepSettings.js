const mongoose = require('mongoose');

const masterInstructionsSchema = new mongoose.Schema({
  // A unique name to ensure we always update the same document
  name: {
    type: String,
    default: 'default_instructions',
    unique: true
  },
  // The main field to hold all the steps
  steps: {
    type: Map,
    of: [String] // The value for each key in the map is an ARRAY of strings
  }
});

module.exports = mongoose.model('MasterInstructions', masterInstructionsSchema);