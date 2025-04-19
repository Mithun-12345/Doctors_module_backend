const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  paymentId: {
    type: String,
    required: true,
    unique: true
  },
  workshopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workshop',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['created', 'authorized', 'captured', 'refunded', 'failed'],
    default: 'captured'
  },
  paymentMethod: {
    type: String,
    default: 'razorpay'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;