// controllers/rawMaterialController.js
const RawMaterial = require('../models/RawMaterial');
// Get all raw materials
exports.getAllRawMaterials = async (req, res) => {
  console.log("Reaches getAllRawMaterials");
  try {
    const rawMaterials = await RawMaterial.find().sort({ name: 1 });
    res.status(200).json(rawMaterials);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching raw materials', error: error.message });
  }
};

// Get a specific raw material
exports.getRawMaterial = async (req, res) => {
  try {
    const rawMaterial = await RawMaterial.findById(req.params.id);
    if (!rawMaterial) {
      return res.status(404).json({ message: 'Raw material not found' });
    }
    res.status(200).json(rawMaterial);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching raw material', error: error.message });
  }
};

// Create a new raw material
exports.createRawMaterial = async (req, res) => {
  try {
    const {
      name,
      type,
      category,
      packageSize,
      uom,
      quantity,
      currentQuantity,
      thresholdQuantity,
      expiryDate,
      // barcode,
      productImage,
      costPerUnit
    } = req.body;

    const newRawMaterial = new RawMaterial({
      name,
      type,
      category,
      packageSize,
      uom,
      quantity: Number(quantity),
      currentQuantity: Number(currentQuantity),
      thresholdQuantity: Number(thresholdQuantity),
      expiryDate: new Date(expiryDate),
      // barcode,
      productImage,
      costPerUnit: Number(costPerUnit)
    });

    const savedRawMaterial = await newRawMaterial.save();

    const barcode = `RM-${savedRawMaterial._id.toString()}`;
    savedRawMaterial.barcode = barcode;
    await savedRawMaterial.save();

    res.status(201).json(savedRawMaterial);
  } catch (error) {
    console.error("Validation Error:", error);
    res.status(400).json({ message: 'Error creating raw material', error: error.message });
  }
};

// Update a raw material
exports.updateRawMaterial = async (req, res) => {
  try {
    req.body.updatedAt = Date.now();
    const updatedRawMaterial = await RawMaterial.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedRawMaterial) {
      return res.status(404).json({ message: 'Raw material not found' });
    }
    res.status(200).json(updatedRawMaterial);
  } catch (error) {
    res.status(400).json({ message: 'Error updating raw material', error: error.message });
  }
};

// Delete a raw material
exports.deleteRawMaterial = async (req, res) => {
  try {
    const rawMaterial = await RawMaterial.findByIdAndDelete(req.params.id);
    if (!rawMaterial) {
      return res.status(404).json({ message: 'Raw material not found' });
    }
    res.status(200).json({ message: 'Raw material deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting raw material', error: error.message });
  }
};

exports.reduceQuantity = async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;
  
  if (!quantity || quantity <= 0) {
    throw new ApiError(400, 'Valid quantity required');
  }
  
  const rawMaterial = await RawMaterial.findById(id);
  
  if (!rawMaterial) {
    throw new ApiError(404, 'Raw material not found');
  }
  
  if (rawMaterial.currentQuantity < quantity) {
    throw new ApiError(400, 'Insufficient quantity available');
  }
  
  rawMaterial.currentQuantity -= parseFloat(quantity);
  rawMaterial.updatedAt = Date.now();
  
  await rawMaterial.save();
  
  res.status(200).json({
    success: true,
    data: rawMaterial
  });
};