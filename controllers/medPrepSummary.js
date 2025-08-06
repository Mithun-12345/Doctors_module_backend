const mongoose = require('mongoose');
const MedicinePreparationSummary = require('../models/MedicinePreparationSummary');

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

module.exports = {
  initializeMedicinePreparation
};

