const Medicine = require("../models/Medicine");
const RawMaterial = require("../models/RawMaterial");

// Get all medicines with populated raw materials
exports.getAllMedicines = async (req, res) => {
  try {
    const medicines = await Medicine.find();

    res.status(200).json(medicines);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching medicines", error: error.message });
  }
};

// Get a specific medicine
exports.getMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id).populate(
      "composition.rawMaterial"
    );

    if (!medicine) {
      return res.status(404).json({ message: "Medicine not found" });
    }
    res.status(200).json(medicine);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching medicine", error: error.message });
  }
};

// Create a new medicine
exports.createMedicine = async (req, res) => {
  console.log("Creating");
  try {
    const {
      name,
      description,
      category,
      stock,
      batchNumber,
      expiryDate,
      manufacturer,
      composition,
      additionalPrice,
      dosage,
    } = req.body;

    // Calculate pricePerUnit
    let totalCost = parseFloat(additionalPrice) || 0;

    for (const item of composition) {
      const rawMaterial = await RawMaterial.findById(item.rawMaterial);
      if (rawMaterial) {
        totalCost += item.quantity * rawMaterial.costPerUnit;
      }
    }

    const newMedicine = new Medicine({
      name,
      description,
      category,
      stock,
      batchNumber,
      expiryDate,
      manufacturer,
      dosage,
      pricePerUnit: totalCost, // This is required
    });

    const savedMedicine = await newMedicine.save(); // No session needed now

    res.status(201).json(savedMedicine);
  } catch (error) {
    console.error("Medicine creation failed:", error.message);
    res
      .status(400)
      .json({ message: "Error creating medicine", error: error.message });
  }
};

// Update a medicine
exports.updateMedicine = async (req, res) => {
  try {
    req.body.updatedAt = Date.now();

    const updatedMedicine = await Medicine.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate("composition.rawMaterial");

    if (!updatedMedicine) {
      return res.status(404).json({ message: "Medicine not found" });
    }

    res.status(200).json(updatedMedicine);
  } catch (error) {
    res
      .status(400)
      .json({ message: "Error updating medicine", error: error.message });
  }
};

// Delete a medicine
exports.deleteMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.findByIdAndDelete(req.params.id);
    if (!medicine) {
      return res.status(404).json({ message: "Medicine not found" });
    }
    res.status(200).json({ message: "Medicine deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting medicine", error: error.message });
  }
};

// Calculate price based on composition
exports.calculatePrice = async (req, res) => {
  try {
    const { composition, additionalPrice = 0 } = req.body;

    if (!composition || !Array.isArray(composition)) {
      return res
        .status(400)
        .json({ message: "Valid composition array is required" });
    }

    let totalCost = parseFloat(additionalPrice) || 0;

    for (const item of composition) {
      if (!item.rawMaterial || !item.quantity) {
        continue;
      }

      const rawMaterial = await RawMaterial.findById(item.rawMaterial);
      if (rawMaterial) {
        totalCost += item.quantity * rawMaterial.costPerUnit;
      }
    }

    res.status(200).json({ calculatedPrice: totalCost });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error calculating price", error: error.message });
  }
};
