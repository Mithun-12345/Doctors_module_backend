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
exports.updateVendorDetails = catchAsync(async (req, res, next) => {
  // --- START: THE FIX ---

  const { vendor, products } = req.body;
  const updateData = {};

  // If the 'vendor' object exists, spread its properties (name, email, etc.)
  // into the main update object.
  if (vendor) {
    Object.assign(updateData, vendor);
  }

  // If the 'products' array exists, add it to the update object.
  // This will overwrite the entire products array as intended.
  if (products) {
    updateData.products = products;
  }

  // --- END: THE FIX ---

  // 1. Find the vendor by its ID and update it with the CORRECTLY structured data
  const updatedVendor = await Vendor.findByIdAndUpdate(req.params.id, updateData, {
    new: true, // This option returns the document after the update has been applied
    runValidators: true, // This ensures that updates are validated against your schema
  });

  // 2. If no vendor was found with that ID, return an error
  if (!updatedVendor) {
    return next(new AppError('No vendor found with that ID', 404));
  }

  // 3. If successful, send the updated vendor data back
  res.status(200).json({
    status: 'success',
    data: {
      vendor: updatedVendor,
    },
  });
});
/**
 * @desc    Update a specific raw material for a vendor
 * @route   PATCH /api/v1/vendors/:vendorId/products/:productId
 * @access  Private
 */
exports.updateVendorProduct = catchAsync(async (req, res, next) => {
  const { vendorId, productId } = req.params;
  const { rawMaterialName, rawMaterialPrice } = req.body;

  // 1. Create the update object dynamically based on request body
  // This allows updating just the name, just the price, or both.
  const updateFields = {};
  if (rawMaterialName) {
    updateFields['products.$.rawMaterialName'] = rawMaterialName;
  }
  if (rawMaterialPrice !== undefined) {
    // Check for undefined to allow setting a price of 0
    updateFields['products.$.rawMaterialPrice'] = rawMaterialPrice;
  }

  // Ensure there's something to update
  if (Object.keys(updateFields).length === 0) {
    return next(new AppError('No fields to update provided', 400));
  }

  // 2. Find the vendor and the specific product, then update it
  const updatedVendor = await Vendor.findOneAndUpdate(
    { _id: vendorId, 'products._id': productId }, // Query to find the right vendor and product
    { $set: updateFields }, // Use the $set operator with our dynamic fields
    {
      new: true, // Return the modified document
      runValidators: true, // Run schema validators on the update
    }
  );

  // 3. If no document was found and updated, send an error
  if (!updatedVendor) {
    return next(
      new AppError('No vendor or product found with the provided IDs', 404)
    );
  }

  // 4. Send the successful response
  res.status(200).json({
    status: 'success',
    data: {
      vendor: updatedVendor,
    },
  });
});
/**
 * @desc    Find vendors for a specific raw material and compare prices
 * @route   GET /api/v1/vendors/compare-prices?rawMaterialName=...
 * @access  Public/Private
 */
/**
 * @desc    Find vendors for a specific raw material (case-insensitive)
 * @route   GET /api/v1/vendors/compare-prices/:rawMaterialName
 * @access  Public/Private
 */
exports.compareMaterialPrices = catchAsync(async (req, res, next) => {
  const { rawMaterialName } = req.params;

  // Use a regular expression for case-insensitive, exact matching
  const searchRegex = new RegExp(`^${rawMaterialName}$`, 'i');

  const vendors = await Vendor.aggregate([
    // Stage 1: Match vendors using the case-insensitive regex
    {
      $match: { 'products.rawMaterialName': { $regex: searchRegex } },
    },
    // Stage 2: Unwind the products array
    {
      $unwind: '$products',
    },
    // Stage 3: Match again to isolate the specific product (also case-insensitive)
    {
      $match: { 'products.rawMaterialName': { $regex: searchRegex } },
    },
    // ... rest of the pipeline is the same
    {
      $sort: { 'products.rawMaterialPrice': 1 },
    },
    {
      $project: {
        _id: 0,
        vendorId: '$_id',
        vendorName: '$name',
        material: '$products.rawMaterialName', // This will show the casing from the DB
        price: '$products.rawMaterialPrice',
      },
    },
  ]);

  if (!vendors || vendors.length === 0) {
    return next(
      new AppError(`No vendors found for '${rawMaterialName}'`, 404)
    );
  }

  res.status(200).json({
    status: 'success',
    results: vendors.length,
    data: {
      vendors,
    },
  });
});
/**
 * @desc    Get a unique, case-insensitive list of all raw materials
 * @route   GET /api/v1/materials
 * @access  Public/Private
 */
exports.getUniqueRawMaterials = catchAsync(async (req, res, next) => {
  const materials = await Vendor.aggregate([
    // Stage 1: Deconstruct the products array
    {
      $unwind: '$products',
    },
    // Stage 2: Group by the lowercase name to handle case-insensitivity
    {
      $group: {
        _id: { $toLower: '$products.rawMaterialName' }, // Group by lowercase name
        originalName: { $first: '$products.rawMaterialName' }, // Keep the first original casing
      },
    },
    // Stage 3: Sort the results alphabetically
    {
      $sort: { originalName: 1 },
    },
  ]);

  // Stage 4: Map the results to a simple array of strings in our code
  const materialNames = materials.map((item) => item.originalName);

  res.status(200).json({
    status: 'success',
    results: materialNames.length,
    data: {
      materials: materialNames,
    },
  });
});
