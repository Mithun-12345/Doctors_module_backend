const Vendor = require("../models/Vendor");
const { sanitizeInput } = require("../utils/sanitize");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const OrderHistory = require('../models/vendorOrderSchema'); // Adjust path
const EditLog = require('../models/vendorAmmendmentLog');
const mongoose = require('mongoose');



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
  // 1. Fetch the original document to compare against
  const originalVendor = await Vendor.findById(req.params.id);
  if (!originalVendor) {
    return next(new AppError('No vendor found with that ID to update', 404));
  }

  // 2. Prepare the update data from the request body
  const { vendor, products } = req.body;
  const updateData = {};
  if (vendor) Object.assign(updateData, vendor);
  if (products) updateData.products = products;

  // 3. Perform the update in the database
  const updatedVendor = await Vendor.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  );

  // 4. Compare the original data with the submitted data to find actual changes
  const actualChanges = [];
  const oldProductsMap = new Map(
    originalVendor.products.map(p => [p._id.toString(), p.toObject()])
  );

  for (const key in updateData) {
    if (key === 'products') {
      // Detailed comparison for the products array
      for (const newProduct of updateData.products) {
        const oldProduct = oldProductsMap.get(newProduct._id.toString());
        if (oldProduct) {
          // Check for change in raw material name
          if (oldProduct.rawMaterialName !== newProduct.rawMaterialName) {
            actualChanges.push({
              field: `Raw Material ${oldProduct.rawMaterialName} name updated`,
              oldValue: oldProduct.rawMaterialName,
              newValue: newProduct.rawMaterialName,
            });
          }
          // Check for change in raw material price
          if (oldProduct.rawMaterialPrice !== newProduct.rawMaterialPrice) {
            actualChanges.push({
              field: `Raw Material ${newProduct.rawMaterialName} price updated`,
              oldValue: oldProduct.rawMaterialPrice,
              newValue: newProduct.rawMaterialPrice,
            });
          }
        }
      }
    } else {
      // Simple comparison for top-level fields (e.g., name, city)
      if (originalVendor[key] !== updateData[key]) {
        actualChanges.push({
          field: key,
          oldValue: originalVendor[key],
          newValue: updateData[key],
        });
      }
    }
  }

  // 5. If any changes were detected, create a log entry
  if (actualChanges.length > 0) {
    await EditLog.create({
      resourceId: req.params.id,
      vendorName: updatedVendor.name, // Always store the vendor's name for context
      changes: actualChanges,
    });
  }

  // 6. Send the final, updated vendor document back in the response
  res.status(200).json({
    status: 'success',
    data: {
      vendor: updatedVendor,
    },
  });
});
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
exports.createOrder = catchAsync(async (req, res, next) => {
  // 1. Get the required data. Note: vendorId is no longer here.
  const { items, totalOrderValue } = req.body;

  // 2. Generate a unique order number.
  const orderNumber = `ORD-${Date.now()}`;

  // 3. Create the new order. Note: the top-level 'vendor' field is gone.
  const newOrder = await OrderHistory.create({
    orderNumber,
    items, // The items array now contains the vendorId for each item
    totalOrderValue,
    // placedBy: req.user.id,
  });

  // 4. Send a '201 Created' response.
  res.status(201).json({
    status: 'success',
    data: {
      order: newOrder,
    },
  });
});
/**
 * @desc    Get all orders
 * @route   GET /api/v1/orders
 * @access  Private (should be protected)
 */
exports.getAllOrders = catchAsync(async (req, res, next) => {
  // 1. Find all documents in the OrderHistory collection.
  const orders = await OrderHistory.find()
    .sort({ createdAt: -1 }) // Sort by creation date, newest first.
    .populate({
      path: 'placedBy',
      select: 'name email', // Select which user fields to return.
    })
    .populate({
      path: 'items.vendorId',
      select: 'name email phoneNumber', // Populate the vendor for each item in the order.
    });

  // 2. Send the response.
  res.status(200).json({
    status: 'success',
    results: orders.length,
    data: {
      orders,
    },
  });
});
exports.getAllLogs = catchAsync(async (req, res, next) => {
  const logs = await EditLog.find()
    .sort({ modifiedAt: -1 }) // Sort by modified date, newest first
    .populate({
      path: 'resourceId',
      select: 'name', // From the Vendor model, get the vendor's name
    });

  res.status(200).json({
    status: 'success',
    results: logs.length,
    data: {
      logs,
    },
  });
});
exports.updateOrderReceivedStatus = catchAsync(async (req, res, next) => {
  const { orderId } = req.params;
  const { orderRecieved } = req.body; // Using the field name you mentioned

  // --- Validation ---
  if (typeof orderRecieved !== 'boolean') {
    return next(new AppError('The "orderRecieved" field must be a boolean (true or false).', 400));
  }

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return next(new AppError('Invalid Order ID format.', 400));
  }
  
  // --- Database Update ---
  const updatedOrder = await OrderHistory.findByIdAndUpdate(
    orderId,
    { orderRecieved: orderRecieved }, // Update the existing field
    { new: true, runValidators: true }
  );

  if (!updatedOrder) {
    return next(new AppError('No order found with that ID', 404));
  }

  // --- Success Response ---
  res.status(200).json({
    status: 'success',
    data: {
      order: updatedOrder,
    },
  });
});