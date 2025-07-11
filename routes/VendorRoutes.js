const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
// const { validateVendorInput } = require('../middleware/validate');
const validateToken = require('../middlewares/validateTokenHandler');

// Vendor routes
// router.route('/vendors')
//   .get(vendorController.getAllVendors)
//   .post(validateVendorInput, vendorController.createVendor);

// router.route('/vendors/:id')
//   .get(vendorController.getVendor)
//   .patch(validateVendorInput, vendorController.updateVendor)
//   .delete(vendorController.deleteVendor);

// router.get("/zoom/authorize", validateToken, zoomAuthorize);
router.get("/vendors", validateToken, vendorController.getAllVendors);
router.post("/vendors", validateToken, vendorController.createVendor);
router.patch("/vendors", validateToken, vendorController.updateVendor);
// router.get("/vendors/:id", validateToken, vendorController.updateVendor);
router.delete("/vendors", validateToken, vendorController.deleteVendor);

const Vendor = require('../models/Vendor')
router.get('/', async (req, res) => {
  try {
    const vendors = await Vendor.find().sort({ name: 1 });
    res.json(vendors);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/vendors/:id
// @desc    Get vendor by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      return res.status(404).json({ msg: 'Vendor not found' });
    }

    res.json(vendor);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Vendor not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/vendors
// @desc    Create a new vendor
// @access  Private
router.post('/', async (req, res) => {
  try {
    const {
      name,
      phoneNumber,
      email,
      address,
      city,
      state,
      zipCode,
      country,
      products,
      vendorState
    } = req.body;

    // Check if vendor with same phone number already exists
    const existingVendor = await Vendor.findOne({ phoneNumber });
    if (existingVendor) {
      return res.status(400).json({ msg: 'Vendor with this phone number already exists' });
    }

    // Create new vendor
    const newVendor = new Vendor({
      name,
      phoneNumber,
      email,
      address,
      city,
      state,
      zipCode,
      country,
      products: products || [],
      vendorState: vendorState !== undefined ? vendorState : false
    });

    const vendor = await newVendor.save();
    res.json(vendor);
  } catch (err) {
    console.error(err.message);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({ msg: messages.join(', ') });
    }
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/vendors/:id
// @desc    Update a vendor
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    const {
      name,
      phoneNumber,
      email,
      address,
      city,
      state,
      zipCode,
      country,
      products,
      vendorState
    } = req.body;

    // Check if vendor exists
    let vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ msg: 'Vendor not found' });
    }

    // Check if updating to a phone number that already exists with a different vendor
    if (phoneNumber && phoneNumber !== vendor.phoneNumber) {
      const existingVendor = await Vendor.findOne({ phoneNumber });
      if (existingVendor && existingVendor._id.toString() !== req.params.id) {
        return res.status(400).json({ msg: 'Vendor with this phone number already exists' });
      }
    }

    // Build vendor update object
    const vendorFields = {};
    if (name) vendorFields.name = name;
    if (phoneNumber) vendorFields.phoneNumber = phoneNumber;
    if (email) vendorFields.email = email;
    if (address) vendorFields.address = address;
    if (city) vendorFields.city = city;
    if (state) vendorFields.state = state;
    if (zipCode) vendorFields.zipCode = zipCode;
    if (country) vendorFields.country = country;
    if (products) vendorFields.products = products;
    if (vendorState !== undefined) vendorFields.vendorState = vendorState;
    vendorFields.updatedAt = Date.now();

    // Update vendor
    vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { $set: vendorFields },
      { new: true, runValidators: true }
    );

    res.json(vendor);
  } catch (err) {
    console.error(err.message);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({ msg: messages.join(', ') });
    }
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Vendor not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/vendors/:id
// @desc    Delete a vendor
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      return res.status(404).json({ msg: 'Vendor not found' });
    }

    await Vendor.findByIdAndRemove(req.params.id);

    res.json({ msg: 'Vendor removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Vendor not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/vendors/:id/products
// @desc    Add product to vendor
// @access  Private
router.post('/:id/products', async (req, res) => {
  try {
    const { rawMaterialName, rawMaterialPrice } = req.body;

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ msg: 'Vendor not found' });
    }

    // Check if product already exists for this vendor
    const existingProductIndex = vendor.products.findIndex(
      product => product.rawMaterialName === rawMaterialName
    );

    if (existingProductIndex !== -1) {
      // Update existing product
      vendor.products[existingProductIndex].rawMaterialPrice = rawMaterialPrice;
    } else {
      // Add new product
      vendor.products.push({
        rawMaterialName,
        rawMaterialPrice
      });
    }

    vendor.updatedAt = Date.now();
    await vendor.save();

    res.json(vendor);
  } catch (err) {
    console.error(err.message);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({ msg: messages.join(', ') });
    }
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/vendors/:id/products/:productId
// @desc    Remove product from vendor
// @access  Private
router.delete('/:id/products/:productId', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ msg: 'Vendor not found' });
    }

    // Remove product
    vendor.products = vendor.products.filter(
      product => product._id.toString() !== req.params.productId
    );

    vendor.updatedAt = Date.now();
    await vendor.save();

    res.json(vendor);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Vendor or product not found' });
    }
    res.status(500).send('Server Error');
  }
});


module.exports = router;