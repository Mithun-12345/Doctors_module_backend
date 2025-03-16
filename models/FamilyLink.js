const mongoose = require("mongoose");

const familyLinkSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  name: { type: String, required: true },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true,
  },
  relationship: {
    type: String,
    enum: [
      "Father",
      "Mother",
      "Son",
      "Daughter",
      "Father in law",
      "Mother in law",
      "Husband",
      "Wife",
    ],
    required: true,
  },
});

module.exports = mongoose.model("FamilyLink", familyLinkSchema);