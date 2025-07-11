const mongoose = require("mongoose");

const labelSchema = new mongoose.Schema({
  value: {
    type: String,
    required: true,
    unique: true,
  },
});

module.exports = mongoose.model("Label", labelSchema);
