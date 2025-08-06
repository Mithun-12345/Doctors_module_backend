const mongoose = require('mongoose');
const MedicinePreparationSummary = require('../models/MedicinePreparationSummary');
const RawMaterial = require('../models/RawMaterial');
const initializeMedicinePreparation = async (req, res) => {
  try {
    const { prescriptionId, medicineName, prescriptionItemId, rawMaterials } = req.body;

    if (!mongoose.Types.ObjectId.isValid(prescriptionId)) {
      return res.status(400).json({ message: 'Invalid prescription ID' });
    }

    if (!medicineName || !prescriptionItemId || !Array.isArray(rawMaterials)) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const formattedRawMaterials = rawMaterials.map((rm) => ({
      materialId: rm.rawMaterialId,
      materialName: rm.name,
      isAlcohol: rm.isAlcohol || false,
      quantityUsed: rm.quantity,
      costPerUnit: rm.pricePerUnit,
      totalCost: rm.totalPrice,
      expiryDate: rm.expiryDate,
      barcode: rm.barcode,
      packageSize: rm.packageSize,
      category: rm.category,
      totalWeight: rm.totalWeight || null
    }));

    const newMedicinePrep = {
      medicineName,
      preparationVideoUrl: null, // can be updated later
      rawMaterialsUsed: formattedRawMaterials
    };

    let summary = await MedicinePreparationSummary.findOne({ prescriptionId });

    if (summary) {
      // Prevent duplicate medicine entries
      const alreadyExists = summary.medicinePreparations.some(
        (prep) => prep.medicineName === medicineName
      );

      if (alreadyExists) {
        return res.status(409).json({ message: 'Medicine preparation already initialized' });
      }

      summary.medicinePreparations.push(newMedicinePrep);
      await summary.save();
    } else {
      // Create new summary
      summary = new MedicinePreparationSummary({
        prescriptionId,
        medicinePreparations: [newMedicinePrep]
      });
      await summary.save();
    }

    return res.status(201).json({
      message: 'Medicine preparation initialized successfully',
      data: summary
    });

  } catch (error) {
    console.error('Error initializing medicine preparation:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
const updatePreWeight = async (req, res) => {
  try {
    const { prescriptionId, medicineName, rawMaterialId, preWeight } = req.body;

    if (!mongoose.Types.ObjectId.isValid(prescriptionId)) {
      return res.status(400).json({ message: "Invalid prescription ID" });
    }

    const summary = await MedicinePreparationSummary.findOne({ prescriptionId });

    if (!summary) {
      return res.status(404).json({ message: "Prescription summary not found" });
    }

    const medicine = summary.medicinePreparations.find(
      (med) => med.medicineName === medicineName
    );

    if (!medicine) {
      return res.status(404).json({ message: "Medicine not found in preparation summary" });
    }

    const rawMaterial = medicine.rawMaterialsUsed.find(
      (rm) => rm.materialId.toString() === rawMaterialId
    );

    if (!rawMaterial) {
      return res.status(404).json({ message: "Raw material not found in this medicine" });
    }

    rawMaterial.preWeight = preWeight;

    await summary.save();

    return res.status(200).json({
      message: "preWeight updated successfully",
      updatedMaterial: rawMaterial
    });

  } catch (error) {
    console.error("Error updating preWeight:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
const updatePostWeight = async (req, res) => {
  try {
    const { preparationId } = req.params;
    const { postWeight } = req.body;

    // 1. Fetch the existing preparation entry
    const preparation = await Preparation.findById(preparationId);
    if (!preparation) {
      return res.status(404).json({ message: "Preparation not found" });
    }

    const rawMaterial = await RawMaterial.findById(preparation.materialId);
    if (!rawMaterial) {
      return res.status(404).json({ message: "Raw Material not found" });
    }

    const { preWeight } = preparation;
    const { quantity, currentQuantity,category, isAlcohol, totalWeight } = rawMaterial;

    let quantityUsed = 0;

    // 2. Calculate bottleCapWeight
    const bottleCapWeight = totalWeight - quantity;

    // 3. Net liquid weight used (in grams)
    const netLiquidWeightUsed = (preWeight - postWeight) - bottleCapWeight;

    // 4. Convert to volume in ml (if liquid), else use weight directly
    if (category === "Liquid") {
      const density = isAlcohol ? 0.789 : 1;
      quantityUsed = netLiquidWeightUsed / density;
    } else {
      quantityUsed = preWeight - postWeight;
    }

    // Round to 2 decimal places
    quantityUsed = parseFloat(quantityUsed.toFixed(2));

    // 5. Calculate updated raw material quantity
    const updatedQuantity = currentQuantity - quantityUsed;
    if (updatedQuantity < 0) {
      return res.status(400).json({ message: "Insufficient quantity in stock" });
    }

    // 6. Update preparation entry
    preparation.postWeight = postWeight;
    preparation.quantityUsed = quantityUsed;
    preparation.totalWeight = preWeight - postWeight;
    await preparation.save();

    // 7. Update raw material quantity
    rawMaterial.currentQuantity = updatedQuantity;
    await rawMaterial.save();

    res.status(200).json({
      message: "Post-weight and quantity updated successfully.",
      updatedPreparation: preparation,
      updatedRawMaterialQuantity: updatedQuantity,
    });

  } catch (error) {
    console.error("Error updating post weight:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

module.exports = {
  initializeMedicinePreparation,
  updatePreWeight,
  updatePostWeight
};

