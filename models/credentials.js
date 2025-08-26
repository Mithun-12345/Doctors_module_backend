// models/Credential.js
const mongoose = require('mongoose');

const credentialSchema = new mongoose.Schema({
  serviceName: {
    type: String,
    required: true,
    unique: true, // e.g., 'instagram'
  },
  accessToken: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
  },
});

module.exports = mongoose.model('Credential', credentialSchema);