const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // Generated referral code
  referrerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true,
  }, // ID of the referrer
  referredFriendPhone: { type: String, required: true }, // Phone number of the friend (receiver)
  isUsed: { type: Boolean, default: false }, // If the code has been used for a benefit
});

const Referral = mongoose.model("Referral", referralSchema);
module.exports = Referral;
