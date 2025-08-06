const mongoose = require('mongoose');
const MedicinePreparationSummary = require('../models/MedicinePreparationSummary');
const RawMaterial = require('../models/RawMaterial');
const Prescription = require("../models/Prescription");
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
    const { prescriptionId, medicineName, rawMaterialId } = req.body;
    const { postWeight } = req.body;

    // 1. Fetch summary document
    const summary = await MedicinePreparationSummary.findOne({ prescriptionId });
    if (!summary) {
      return res.status(404).json({ message: "Prescription summary not found" });
    }

    // 2. Find the medicine
    const medicine = summary.medicinePreparations.find(
      (med) => med.medicineName === medicineName
    );
    if (!medicine) {
      return res.status(404).json({ message: "Medicine not found in preparation summary" });
    }

    // 3. Find the raw material
    const rawMaterialUsed = medicine.rawMaterialsUsed.find(
      (rm) => rm.materialId.toString() === rawMaterialId
    );
    if (!rawMaterialUsed) {
      return res.status(404).json({ message: "Raw material not found in this medicine" });
    }

    const rawMaterial = await RawMaterial.findById(rawMaterialId);
    if (!rawMaterial) {
      return res.status(404).json({ message: "Raw Material not found in master list" });
    }

    const { preWeight } = rawMaterialUsed;
    const { quantity, currentQuantity, category, isAlcohol, totalWeight } = rawMaterial;

    let quantityUsed = 0;

    // Calculate bottleCapWeight
    const bottleCapWeight = totalWeight - quantity;

    // Net liquid weight used
    const netLiquidWeightUsed = (preWeight - postWeight) - bottleCapWeight;

    // Convert grams to ml if liquid
    if (category === "Liquid") {
      const density = isAlcohol ? 0.789 : 1;
      quantityUsed = netLiquidWeightUsed / density;
    } else {
      quantityUsed = preWeight - postWeight;
    }

    // Round values
    quantityUsed = parseFloat(quantityUsed.toFixed(2));
    const netitemUsed = parseFloat(netLiquidWeightUsed.toFixed(2));

    // Update stock
    const updatedQuantity = currentQuantity - quantityUsed;
    if (updatedQuantity < 0) {
      return res.status(400).json({ message: "Insufficient quantity in stock" });
    }

    // LEAKAGE DETECTION LOGIC STARTS HERE
    let leakageDetected = false;
    let quantityLeaked = 0;

    const prescription = await Prescription.findById(prescriptionId);
    if (prescription) {
      const prescriptionItem = prescription.prescriptionItems.find(
        (item) => item.medicineName === medicineName
      );

      if (prescriptionItem) {
        const prescribedRawMaterial = prescriptionItem.rawMaterialDetails.find(
          (rm) => rm._id.toString() === rawMaterialId
        );

        if (prescribedRawMaterial) {
          const prescribedQuantity = prescribedRawMaterial.quantity;

          if (quantityUsed > prescribedQuantity) {
            leakageDetected = true;
            quantityLeaked = parseFloat((quantityUsed - prescribedQuantity).toFixed(2));
          }
        }
      }
    }
    // LEAKAGE DETECTION LOGIC ENDS HERE

    // Save updates in embedded document
    rawMaterialUsed.postWeight = postWeight;
    rawMaterialUsed.quantityUsed = quantityUsed;
    rawMaterialUsed.totalWeight = preWeight - postWeight;
    rawMaterialUsed.netitemUsed = netitemUsed;
    rawMaterialUsed.leakageDetected = leakageDetected;
    rawMaterialUsed.quantityLeaked = quantityLeaked;
    
    summary.markModified('medicinePreparations');
    await summary.save();

    rawMaterial.currentQuantity = updatedQuantity;
    await rawMaterial.save();

    res.status(200).json({
      message: "Post-weight and quantity updated successfully.",
      updatedMaterial: rawMaterialUsed,
      updatedRawMaterialQuantity: updatedQuantity,
      netitemUsed,
      leakageDetected,
      quantityLeaked,
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

