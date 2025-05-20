const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Vendor = require('../models/Vendor');
const RawMaterial = require('../models/RawMaterial');

// @route   GET /api/orders
// @desc    Get all orders
// @access  Private
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ orderDate: -1 });
    res.json(orders);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/orders/:id
// @desc    Get order by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('vendorId', 'name email phoneNumber')
      .populate('items.materialId', 'name type category');

    if (!order) {
      return res.status(404).json({ msg: 'Order not found' });
    }

    res.json(order);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Order not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/orders
// @desc    Create a new order
// @access  Private
router.post('/', async (req, res) => {
  try {
    const { vendorId, items, totalAmount, status, notes } = req.body;

    // Verify that vendor exists
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(400).json({ msg: 'Vendor not found' });
    }

    // Create new order
    const newOrder = new Order({
      vendorId,
      items,
      totalAmount,
      status,
      notes
    });

    const order = await newOrder.save();
    res.json(order);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/orders/:id
// @desc    Update order status
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    const { status, expectedDeliveryDate, deliveryDate, notes } = req.body;

    const orderFields = {};
    if (status) orderFields.status = status;
    if (expectedDeliveryDate) orderFields.expectedDeliveryDate = expectedDeliveryDate;
    if (deliveryDate) orderFields.deliveryDate = deliveryDate;
    if (notes) orderFields.notes = notes;
    orderFields.updatedAt = Date.now();

    let order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ msg: 'Order not found' });
    }

    order = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: orderFields },
      { new: true }
    );

    res.json(order);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Order not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/orders/:id
// @desc    Delete an order
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ msg: 'Order not found' });
    }

    await Order.findByIdAndRemove(req.params.id);

    res.json({ msg: 'Order removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Order not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/orders/:id/receive
// @desc    Process order receipt and update inventory
// @access  Private
router.post('/:id/receive', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ msg: 'Order not found' });
    }

    if (order.status === 'delivered') {
      return res.status(400).json({ msg: 'Order already marked as delivered' });
    }

    // Update raw material inventory
    const updatePromises = order.items.map(async (item) => {
      const rawMaterial = await RawMaterial.findById(item.materialId);
      
      if (rawMaterial) {
        // Update current quantity
        const newQuantity = (rawMaterial.currentQuantity || 0) + item.quantity;
        rawMaterial.currentQuantity = newQuantity;
        
        // If this is the first order or a new quantity is higher, update the max quantity too
        if (!rawMaterial.quantity || newQuantity > rawMaterial.quantity) {
          rawMaterial.quantity = newQuantity;
        }
        
        return rawMaterial.save();
      }
    });
    
    await Promise.all(updatePromises);
    
    // Update order status
    order.status = 'delivered';
    order.deliveryDate = Date.now();
    order.updatedAt = Date.now();
    await order.save();
    
    res.json(order);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/orders/vendor/:vendorId
// @desc    Get orders for a specific vendor
// @access  Private
router.get('/vendor/:vendorId', async (req, res) => {
  try {
    const orders = await Order.find({ vendorId: req.params.vendorId }).sort({ orderDate: -1 });
    res.json(orders);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Vendor not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/orders/material/:materialId
// @desc    Get orders containing a specific raw material
// @access  Private
router.get('/material/:materialId', async (req, res) => {
  try {
    const orders = await Order.find({
      'items.materialId': req.params.materialId
    }).sort({ orderDate: -1 });
    
    res.json(orders);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Material not found' });
    }
    res.status(500).send('Server Error');
  }
});

module.exports = router;