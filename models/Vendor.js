const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProductSchema = new Schema({
  rawMaterialName: {
    type: String,
    required: [true, 'Raw material name is required'],
    trim: true,
    maxlength: [200, 'Raw material name cannot exceed 200 characters']
  },
  rawMaterialPrice: {
    type: Number,
    required: [true, 'Raw material price is required'],
    min: [0, 'Price cannot be negative']
  }
});

const VendorSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Vendor name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true,
    match: [/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/, 'Please enter a valid phone number']
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true
  },
  zipCode: {
    type: String,
    required: [true, 'Zip code is required'],
    trim: true,
    match: [/^\d{5}(-\d{4})?$/, 'Please enter a valid zip code']
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    trim: true
  },
  products: [ProductSchema],
  vendorState: {
    type: Boolean,
    default: false,
    enum: [true, false]
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field on save
VendorSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Vendor = mongoose.model('Vendor', VendorSchema);

module.exports = Vendor;