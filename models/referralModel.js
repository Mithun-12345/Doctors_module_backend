const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // Generated referral code
  referrerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true,
  }, // ID of the referrer
  referredFriendPhone: { type: String, required: true }, // Phone number of the friend (receiver)
  referredFriendName: { type: String, required: false }, // Add friend's name field
  isUsed: { type: Boolean, default: false }, // If the code has been used for a benefit
  // New field to track coupon association with a first appointment
  firstAppointmentDone: { type: Boolean, default: false }, // If referred friend has completed first appointment
  createdAt: { type: Date, default: Date.now }, // NEW FIELD
  expiresAt: { type: Date, required: true },
});

const Referral = mongoose.model("Referral", referralSchema);
module.exports = Referral;
