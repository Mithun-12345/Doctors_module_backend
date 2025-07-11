const Vendor = require("../models/Vendor");
const { sanitizeInput } = require("../utils/sanitize");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

// Get all vendors
exports.getAllVendors = catchAsync(async (req, res, next) => {
  console.log("Reached getAllVendors");
  const vendors = await Vendor.find().sort({ name: 1 });

  res.status(200).json(vendors);
});

// Get a single vendor
exports.getVendor = catchAsync(async (req, res, next) => {
  const vendor = await Vendor.findById(req.params.id);

  if (!vendor) {
    return next(new AppError("No vendor found with that ID", 404));
  }

  res.status(200).json(vendor);
});

// Create a new vendor
exports.createVendor = catchAsync(async (req, res, next) => {
  const { vendor, products } = req.body;

  // Sanitize vendor data
  const sanitizedVendor = {
    name: sanitizeInput(vendor.name),
    phoneNumber: sanitizeInput(vendor.phoneNumber),
    email: vendor.email ? sanitizeInput(vendor.email) : undefined,
    address: sanitizeInput(vendor.address),
    city: sanitizeInput(vendor.city),
    state: sanitizeInput(vendor.state),
    zipCode: sanitizeInput(vendor.zipCode),
    country: sanitizeInput(vendor.country),
    products: products.map((product) => ({
      rawMaterialName: sanitizeInput(product.rawMaterialName),
      rawMaterialPrice: parseFloat(product.rawMaterialPrice),
    })),
  };

  const newVendor = await Vendor.create(sanitizedVendor);

  res.status(201).json({
    status: "success",
    data: newVendor,
  });
});

// Update a vendor
exports.updateVendor = catchAsync(async (req, res, next) => {
  const { vendor, products } = req.body;

  // Sanitize vendor data
  const sanitizedVendor = {};

  if (vendor) {
    if (vendor.name) sanitizedVendor.name = sanitizeInput(vendor.name);
    if (vendor.phoneNumber)
      sanitizedVendor.phoneNumber = sanitizeInput(vendor.phoneNumber);
    if (vendor.email) sanitizedVendor.email = sanitizeInput(vendor.email);
    if (vendor.address) sanitizedVendor.address = sanitizeInput(vendor.address);
    if (vendor.city) sanitizedVendor.city = sanitizeInput(vendor.city);
    if (vendor.state) sanitizedVendor.state = sanitizeInput(vendor.state);
    if (vendor.zipCode) sanitizedVendor.zipCode = sanitizeInput(vendor.zipCode);
    if (vendor.country) sanitizedVendor.country = sanitizeInput(vendor.country);
  }

  if (products) {
    sanitizedVendor.products = products.map((product) => ({
      rawMaterialName: sanitizeInput(product.rawMaterialName),
      rawMaterialPrice: parseFloat(product.rawMaterialPrice),
    }));
  }

  const updatedVendor = await Vendor.findByIdAndUpdate(
    req.params.id,
    sanitizedVendor,
    {
      new: true,
      runValidators: true,
    }
  );

  if (!updatedVendor) {
    return next(new AppError("No vendor found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: updatedVendor,
  });
});

// Delete a vendor
exports.deleteVendor = catchAsync(async (req, res, next) => {
  const vendor = await Vendor.findByIdAndDelete(req.params.id);

  if (!vendor) {
    return next(new AppError("No vendor found with that ID", 404));
  }

  res.status(204).json({
    status: "success",
    data: null,
  });
});
