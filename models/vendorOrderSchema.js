const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// This sub-schema defines the structure for each line item within an order.
const OrderItemSchema = new Schema({
  vendorId: {
    type: Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true,
  },
  // --- NEW FIELD ---
  vendorName: {
    type: String,
    required: [true, 'Vendor name is required at time of order.'],
    trim: true,
  },
  productId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  rawMaterialName: {
    type: String,
    required: [true, 'Material name is required.'],
    trim: true,
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required.'],
    min: [1, 'Quantity must be at least 1.'],
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price at the time of order is required.'],
  },
});

const OrderHistorySchema = new Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    // --- REMOVED ---
    // The single vendor field is no longer needed here.
    // vendor: {
    //   type: Schema.Types.ObjectId,
    //   ref: 'Vendor',
    //   required: true,
    // },
    orderRecieved:{
        type:Boolean,
        default:false
    },
    placedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    items: [OrderItemSchema], // The items array now contains vendor info for each item.
    totalOrderValue: {
      type: Number,
      required: true,
    },
    orderStatus: {
      type: String,
      required: false,
      enum: [
        'Pending',
        'Processing',
        'Shipped',
        'Delivered',
        'Received',
        'Cancelled',
      ],
      default: 'Pending',
    },
    // ... other fields remain the same
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('OrderHistory', OrderHistorySchema);