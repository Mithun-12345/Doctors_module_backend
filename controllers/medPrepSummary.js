const mongoose = require('mongoose');
const MedicinePreparationSummary = require('../models/MedicinePreparationSummary');
const RawMaterial = require('../models/RawMaterial');
const Prescription = require("../models/Prescription");
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const streamifier = require('streamifier');
const { upload } = require('../middlewares/uploadMiddleware');
const fs = require('fs');
const Doctor = require('../models/doctorModel');
const Patient = require('../models/patientModel');
const Appointment = require("../models/appointmentModel");
const WastageLog = require('../models/wastageSchema');
const MasterInstructions = require('../models/medPrepSettings');


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
      preparationVideoUrl: null, // can be updated later,
      medPrepStartTime: new Date(),
      rawMaterialsUsed: formattedRawMaterials,
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

const updatePostWeight = async (req, res) => {
  try {
    const { prescriptionId, medicineName, rawMaterialId, postWeight } = req.body;

    if (!prescriptionId || !medicineName || !rawMaterialId || postWeight === undefined) {
      return res.status(400).json({ message: "Missing required fields" });
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

    const preWeight = parseFloat(rawMaterialUsed.preWeight || 0);
    const parsedPostWeight = parseFloat(postWeight);

    if (isNaN(parsedPostWeight)) {
      return res.status(400).json({ message: "Invalid postWeight. Must be a number." });
    }

    const { quantity, currentQuantity, category, isAlcohol, totalWeight } = rawMaterial;

    // Bottle cap or tare weight = full bottle weight - usable quantity
    const bottleCapWeight = parseFloat((totalWeight - quantity).toFixed(2));

    // Net liquid used = (pre - post - cap). Clamp to zero to avoid negative usage
    let netLiquidWeightUsed = parseFloat((preWeight - bottleCapWeight) - (parsedPostWeight - bottleCapWeight)).toFixed(2);
    netLiquidWeightUsed = Math.max(0, netLiquidWeightUsed); // ✅ Clamp negative values

    let quantityUsed = 0;

    if (category === "Liquid") {
      const density = isAlcohol ? 0.789 : 1;

      // ✅ Prevent division by 0 or invalid density
      if (density <= 0 || isNaN(density)) {
        return res.status(400).json({ message: "Invalid density value for liquid material." });
      }

      quantityUsed = parseFloat((netLiquidWeightUsed / density).toFixed(2));
    } else {
      // For solids, no bottle cap or density logic
      quantityUsed = parseFloat((preWeight - parsedPostWeight).toFixed(2));
      quantityUsed = Math.max(0, quantityUsed); // ✅ Clamp negative values
      netLiquidWeightUsed = quantityUsed;
    }

    // Validate result numbers
    if ([quantityUsed, netLiquidWeightUsed].some(val => isNaN(val))) {
      return res.status(400).json({ message: "Calculated quantity is invalid (NaN). Check weights and data." });
    }

    const updatedQuantity = parseFloat((currentQuantity - quantityUsed).toFixed(2));
    if (updatedQuantity < 0) {
      return res.status(400).json({ message: "Insufficient quantity in stock" });
    }

    // LEAKAGE DETECTION (UPDATED FOR LIQUID DROP → ML CONVERSION)
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
          let prescribedQuantity = parseFloat(prescribedRawMaterial.quantity || 0);

          if (!isNaN(prescribedQuantity)) {
            // ✅ If liquid, convert prescribed drops to ml (5 drops = 2ml)
            let prescribedQuantityInMl = prescribedQuantity;
            if (category === "Liquid") {
              prescribedQuantityInMl = (prescribedQuantity / 5) * 2;
            }

            if (quantityUsed > prescribedQuantityInMl) {
              leakageDetected = true;
              quantityLeaked = parseFloat((quantityUsed - prescribedQuantityInMl).toFixed(2));
            }
          }
        }
      }
    }

    // ✅ Save updates to embedded document
    rawMaterialUsed.postWeight = parsedPostWeight;
    rawMaterialUsed.quantityUsed = quantityUsed;
    rawMaterialUsed.netitemUsed = netLiquidWeightUsed;
    rawMaterialUsed.leakageDetected = leakageDetected;
    rawMaterialUsed.quantityLeaked = quantityLeaked;

    summary.markModified("medicinePreparations");
    await summary.save();

    // ✅ Update master stock
    rawMaterial.currentQuantity = updatedQuantity;
    if (!isNaN(quantityLeaked) && quantityLeaked > 0) {
      rawMaterial.totalLeakedQuantity = (rawMaterial.totalLeakedQuantity || 0) + quantityLeaked;
    }
    await rawMaterial.save();

    return res.status(200).json({
      message: "Post-weight and quantity updated successfully.",
      updatedMaterial: rawMaterialUsed,
      updatedRawMaterialQuantity: updatedQuantity,
      netitemUsed: netLiquidWeightUsed,
      TotalLeakage: rawMaterial.totalLeakedQuantity,
      leakageDetected,
      quantityLeaked,
      bottleCapWeight
    });

  } catch (error) {
    console.error("❌ Error updating post weight:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};
const updatePreWeight = async (req, res) => {
  try {
    const { prescriptionId, medicineName, rawMaterialId, preWeight } = req.body;

    if (!prescriptionId || !medicineName || !rawMaterialId || preWeight === undefined) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // ✅ Step 1: Find the summary and update preWeight in the correct nested location
    const summary = await MedicinePreparationSummary.findOne({ prescriptionId });
    if (!summary) {
      return res.status(404).json({ message: "Medicine preparation summary not found" });
    }

    let found = false;
    for (const prep of summary.medicinePreparations) {
      if (prep.medicineName === medicineName) {
        for (const raw of prep.rawMaterialsUsed) {
          if (raw.materialId.toString() === rawMaterialId.toString()) {
            raw.preWeight = preWeight; // ✅ update here
            found = true;
            break;
          }
        }
      }
    }

    if (!found) {
      return res.status(404).json({ message: "Raw material in preparation not found" });
    }

    await summary.save(); // save the updated preWeight

    // ✅ Step 2: Fetch the raw material for leakage calculation
    const rawMaterial = await RawMaterial.findById(rawMaterialId);
    if (!rawMaterial) {
      return res.status(404).json({ message: "Raw material not found" });
    }

    const { totalWeight, quantity, currentQuantity, storageLeakedQuantity } = rawMaterial;

    // ✅ Step 3: Do your existing calculation logic
    const bottlecapWeight = totalWeight - quantity;
    const expectedQuantity = preWeight - bottlecapWeight;

    if (expectedQuantity !== currentQuantity) {
      const leakageDiff = Math.abs(expectedQuantity - currentQuantity);
      rawMaterial.storageLeakedQuantity = leakageDiff;
      rawMaterial.totalLeakedQuantity=(rawMaterial.totalLeakedQuantity)+leakageDiff;
    }

    await rawMaterial.save();

    res.status(200).json({
      message: "Pre-weight updated successfully",
      updatedSummary: summary,
      updatedRawMaterial: rawMaterial,
      bottlecapWeight
    });

  } catch (error) {
    console.error("Error updating preWeight:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getAllLeakagesDetected = async (req, res) => {
  try {
    const summaries = await MedicinePreparationSummary.find({
      "medicinePreparations.rawMaterialsUsed.leakageDetected": true
    });

    const leakedRawMaterials = [];
    let totalLostCost = 0; // ✅ 1. Initialize total counter

    for (const summary of summaries) {
      for (const prep of summary.medicinePreparations) {
        for (const raw of prep.rawMaterialsUsed) {
          if (raw.leakageDetected) {
            let prescribedQuantity = null;
            let doctorId = null;
            let patientId = null;
            let doctorName = null;
            let patientName = null;
            let rawMat = null;
            let currentQuantity = null;
            let uom = null;

            try {
              const prescription = await Prescription.findById(summary.prescriptionId).populate('doctorId', 'name').populate('patientId', 'name');
              if (prescription) {
                doctorId = prescription.doctorId?._id;
                doctorName = prescription.doctorId?.name ?? null;
                patientId = prescription.patientId?._id;
                patientName = prescription.patientId?.name ?? null;

                const prescriptionItem = prescription.prescriptionItems.find(
                  (item) => item.medicineName === prep.medicineName
                );
                if (prescriptionItem) {
                  const rawMaterialDetail = prescriptionItem.rawMaterialDetails.find(
                    (rm) => rm._id.toString() === raw.materialId.toString()
                  );
                  prescribedQuantity = rawMaterialDetail?.quantity ?? null;
                }
              }
            } catch (err) {
              console.error('Error fetching prescription/doctor/patient info:', err);
            }

            try {
              rawMat = await RawMaterial.findById(raw.materialId);
              currentQuantity = rawMat?.currentQuantity ?? null;
              uom = rawMat?.uom ?? null;
            } catch (err) {
              console.error('Error fetching raw material info:', err);
            }

            let lostCost = 0;
            if (rawMat && rawMat.costPerUnit > 0) {
              if (rawMat.storageLeakedQuantity > 0) {
                lostCost += rawMat.storageLeakedQuantity * rawMat.costPerUnit;
              }
              if (rawMat.totalLeakedQuantity > 0) {
                lostCost += rawMat.totalLeakedQuantity * rawMat.costPerUnit;
              }
            }
            
            totalLostCost += lostCost; // ✅ 2. Add individual cost to the running total

            leakedRawMaterials.push({
              prescriptionId: summary.prescriptionId,
              doctorId,
              doctorName,
              patientId,
              patientName,
              medicineName: prep.medicineName,
              preparationVideoUrl: prep.preparationVideoUrl,
              materialId: raw.materialId,
              materialName: raw.materialName,
              quantityUsed: raw.quantityUsed,
              quantityLeaked: raw.quantityLeaked,
              netitemUsed: raw.netitemUsed,
              preWeight: raw.preWeight,
              postWeight: raw.postWeight,
              totalWeight: raw.totalWeight,
              barcode: raw.barcode,
              createdAt: summary.createdAt,
              prescribedQuantity,
              currentQuantity,
              LeakedByUsage: rawMat?.totalLeakedQuantity ?? null,
              LeakedByStorage: rawMat?.storageLeakedQuantity ?? null,
              uom,
              costPerUnit: rawMat?.costPerUnit ?? null,
              lostCost: parseFloat(lostCost.toFixed(2)),
            });
          }
        }
      }
    }
    
    // ✅ 3. Return the total sum along with the original array of leakages
    res.status(200).json({
      totalLostCost: parseFloat(totalLostCost.toFixed(2)),
      leakages: leakedRawMaterials
    });

  } catch (error) {
    console.error('Error in getAllLeakagesDetected:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const getLeakagesAboveThreshold = async (req, res) => {
  try {
    const thresholdPercentage = parseFloat(req.query.threshold) || 1;
    const summaries = await MedicinePreparationSummary.find({}).populate({
        path: 'prescriptionId',
        populate: [{ path: 'doctorId', select: 'name' }, { path: 'patientId', select: 'name' }]
    });

    const leakages = [];
    let totalLostCost = 0; // ✅ 1. Initialize total counter

    for (const summary of summaries) {
      for (const prep of summary.medicinePreparations) {
        for (const raw of prep.rawMaterialsUsed) {
          if (raw.quantityLeaked && raw.quantityLeaked > 0) {
            let prescribedQuantity = null;
            let currentRawMaterialQty = null;
            let rawMat = null; 

            const prescriptionItem = summary.prescriptionId?.prescriptionItems.find(
              (item) => item.medicineName === prep.medicineName
            );
            if (prescriptionItem) {
              const rawMaterialDetail = prescriptionItem.rawMaterialDetails.find(
                (rm) => rm._id.toString() === raw.materialId.toString()
              );
              prescribedQuantity = rawMaterialDetail?.quantity ?? null;
            }

            try {
              rawMat = await RawMaterial.findById(raw.materialId);
              currentRawMaterialQty = rawMat?.currentQuantity ?? null;
            } catch (err) {
              console.error('Error fetching raw material quantity:', err);
            }

            if (prescribedQuantity && prescribedQuantity > 0) {
              const leakagePercentage = (raw.quantityLeaked / prescribedQuantity) * 100;

              if (leakagePercentage >= thresholdPercentage) {
                let lostCost = 0;
                if (rawMat && rawMat.costPerUnit > 0) {
                  if (rawMat.storageLeakedQuantity > 0) {
                    lostCost += rawMat.storageLeakedQuantity * rawMat.costPerUnit;
                  }
                  if (rawMat.totalLeakedQuantity > 0) {
                    lostCost += rawMat.totalLeakedQuantity * rawMat.costPerUnit;
                  }
                }

                totalLostCost += lostCost; // ✅ 2. Add individual cost to total

                leakages.push({
                  prescriptionId: summary.prescriptionId._id,
                  doctorName: summary.prescriptionId?.doctorId?.name ?? null,
                  patientName: summary.prescriptionId?.patientId?.name ?? null,
                  medicineName: prep.medicineName,
                  preparationVideoUrl: prep.preparationVideoUrl,
                  materialId: raw.materialId,
                  materialName: raw.materialName,
                  quantityUsed: raw.quantityUsed,
                  quantityLeaked: raw.quantityLeaked,
                  leakagePercentage: parseFloat(leakagePercentage.toFixed(2)),
                  netitemUsed: raw.netitemUsed,
                  preWeight: raw.preWeight,
                  postWeight: raw.postWeight,
                  totalWeight: raw.totalWeight,
                  barcode: raw.barcode,
                  prescriptionQuantity: prescribedQuantity,
                  currentQuantity: currentRawMaterialQty,
                  LeakedByUsage: rawMat?.totalLeakedQuantity ?? null,
                  LeakedByStorage: rawMat?.storageLeakedQuantity ?? null,
                  costPerUnit: rawMat?.costPerUnit ?? null,
                  lostCost: parseFloat(lostCost.toFixed(2)),
                  createdAt: summary.createdAt
                });
              }
            }
          }
        }
      }
    }
    
    // ✅ 3. Return the total along with the array of leakages
    res.status(200).json({ 
      totalLostCost: parseFloat(totalLostCost.toFixed(2)),
      leakages: leakages 
    });

  } catch (error) {
    console.error('Error in getLeakagesAboveThreshold:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
const getAllMedPrepSummaryData= async (req, res) => {
  try {
    const { prescriptionId } = req.body;

    if (!prescriptionId) {
      return res.status(400).json({ error: 'prescriptionId is required in the request body' });
    }

    const summary = await MedicinePreparationSummary.findOne({ prescriptionId });

    if (!summary) {
      return res.status(404).json({ error: 'No summary found for the given prescriptionId' });
    }

    const formatted = [];

    for (const prep of summary.medicinePreparations) {
      const rawMaterialsWithPrescribedQty = [];

      for (const material of prep.rawMaterialsUsed) {
        let prescribedQuantity = null;

        try {
          const prescription = await Prescription.findById(summary.prescriptionId);
          if (prescription) {
            const prescriptionItem = prescription.prescriptionItems.find(
              (item) => item.medicineName === prep.medicineName
            );

            if (prescriptionItem) {
              const rawMaterialDetail = prescriptionItem.rawMaterialDetails.find(
                (rm) => rm._id.toString() === material.materialId.toString()
              );

              prescribedQuantity = rawMaterialDetail?.quantity ?? null;
            }
          }
        } catch (err) {
          console.error('Error fetching prescribed quantity:', err);
        }

        rawMaterialsWithPrescribedQty.push({
          materialName: material.materialName,
          expiryDate:material.expiryDate
        });
      }

      formatted.push({
        medicineName: prep.medicineName,
        rawMaterials: rawMaterialsWithPrescribedQty
      });
    }

    res.status(200).json(formatted);
  } catch (error) {
    console.error('Error fetching medicine preparation summary:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


// Stream upload to Cloudinary
const uploadToCloudinary = (filePath) => {
  return cloudinary.uploader.upload(filePath, {
    resource_type: 'video',
    folder: 'medicine_preparations'
  }).then(result => result.secure_url);
};


// API controller
const uploadPreparationVideo = async (req, res) => {
  try {
    const { prescriptionId, medicineName } = req.body;
    const videoFile = req.file;

    if (!prescriptionId || !medicineName || !videoFile) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    const videoUrl = await uploadToCloudinary(videoFile.path); // using .path
    fs.unlink(videoFile.path, (err) => {
    if (err) console.error('Failed to delete local video:', err);
             });

    let summary = await MedicinePreparationSummary.findOne({ prescriptionId });

    if (!summary) {
      // Create new summary if not found
      summary = new MedicinePreparationSummary({
        prescriptionId,
        medicinePreparations: [{
          medicineName,
          preparationVideoUrl: videoUrl
        }]
      });
    } else {
      // Try to find existing medicine entry
      const existing = summary.medicinePreparations.find(
        prep => prep.medicineName.toLowerCase() === medicineName.toLowerCase()
      );

      if (existing) {
        // Update the existing one
        existing.preparationVideoUrl = videoUrl;
      } else {
        // If medicine doesn't belong to this prescription, return error
        return res.status(400).json({
          message: 'Medicine does not belong to this prescription'
        });
      }
    }

    await summary.save();

    res.status(200).json({ message: 'Video uploaded and data saved', data: summary });
  } catch (err) {
    console.error('Error uploading video:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
const getPackagingMaterials = async (req, res) => {
  try {
    const packagingMaterials = await RawMaterial.find({ category: 'packaging' });

    if (!packagingMaterials.length) {
      return res.status(404).json({ message: 'No packaging materials found.' });
    }

    res.status(200).json(packagingMaterials);
  } catch (error) {
    console.error('Error fetching packaging materials:', error);
    res.status(500).json({ message: 'Server error while fetching packaging materials.' });
  }
};



const getRawMaterialByDispenseQuantity = async (req, res) => {
  try {
    const { quantity } = req.query; // e.g., "15ml"

    if (!quantity) {
      return res.status(400).json({ message: 'dispenseQuantity is required in query' });
    }

    // Find a matching material with category = Packaging and type = Bottle
    const matchedMaterial = await RawMaterial.findOne({
      type: 'Packaging',
      category: 'Bottle'
    });

    if (!matchedMaterial) {
      return res.status(404).json({ message: 'No matching packaging bottle found' });
    }

    // Extract trimmed name (first word like "15ml")
    const trimmedName = matchedMaterial.name.split(' ')[0].trim();

    if (trimmedName === quantity) {
      // Decrease currentQuantity by 1 (only if currentQuantity is at least 1)
      if (matchedMaterial.currentQuantity > 0) {
        matchedMaterial.currentQuantity -= 1;
        await matchedMaterial.save();

        return res.status(200).json({
          matched: true,
          rawMaterial: matchedMaterial,
          message: 'Quantity decremented by 1'
        });
      } else {
        return res.status(400).json({
          matched: true,
          rawMaterial: matchedMaterial,
          message: 'Insufficient quantity to decrement'
        });
      }
    } else {
      return res.status(404).json({
        matched: false,
        message: 'No raw material matches the given dispense quantity'
      });
    }

  } catch (error) {
    console.error('Error fetching raw material:', error);
    res.status(500).json({ message: 'Server error while fetching raw material' });
  }
};
const updateRawMaterialDispenseQuantity = async (req, res) => {
  try {
    const { rawMaterialId, dispenseAmount } = req.body;

    if (!rawMaterialId || typeof dispenseAmount !== 'number') {
      return res.status(400).json({ message: 'rawMaterialId and dispenseAmount (number) are required' });
    }

    const rawMaterial = await RawMaterial.findById(rawMaterialId);
    if (!rawMaterial) {
      return res.status(404).json({ message: 'Raw material not found' });
    }

    if (dispenseAmount > rawMaterial.currentQuantity) {
      return res.status(400).json({ message: 'Not enough quantity available to dispense' });
    }

    rawMaterial.currentQuantity -= dispenseAmount;
    rawMaterial.updatedAt = new Date();

    await rawMaterial.save();

    res.status(200).json({
      message: 'Raw material quantity updated successfully',
      updatedMaterial: rawMaterial
    });
  } catch (error) {
    console.error('Error updating quantity:', error);
    res.status(500).json({ message: 'Server error while updating quantity' });
  }
};
const getNonBottlePackagingMaterials = async (req, res) => {
  try {
    const materials = await RawMaterial.find({
      type: 'Packaging',
      category: { $ne: 'Bottle' } // Not equal to "Bottle"
    });

    if (!materials.length) {
      return res.status(404).json({ message: 'No non-bottle packaging materials found.' });
    }

    res.status(200).json(materials);
  } catch (error) {
    console.error('Error fetching non-bottle packaging materials:', error);
    res.status(500).json({ message: 'Server error while fetching data.' });
  }
};

// PATCH /api/rawmaterials/update-quantity
const updateRawMaterialQuantityByAmount = async (req, res) => {
  try {
    const { rawMaterialId, packageAmount } = req.body;

    if (!rawMaterialId || typeof packageAmount !== 'number') {
      return res.status(400).json({ message: 'rawMaterialId and packageAmount (number) are required' });
    }

    const rawMaterial = await RawMaterial.findById(rawMaterialId);
    if (!rawMaterial) {
      return res.status(404).json({ message: 'Raw material not found' });
    }

    if (packageAmount > rawMaterial.currentQuantity) {
      return res.status(400).json({ message: 'Insufficient quantity available to subtract' });
    }

    rawMaterial.currentQuantity -= packageAmount;
    rawMaterial.updatedAt = new Date();

    await rawMaterial.save();

    res.status(200).json({
      message: 'Raw material quantity updated successfully',
      updatedMaterial: rawMaterial
    });

  } catch (error) {
    console.error('Error updating raw material quantity:', error);
    res.status(500).json({ message: 'Server error while updating raw material' });
  }
};

const  getAllMedicinePreparationSummaries = async (req, res) => {
  try {
    // Fetch all preparation documents
    const allPreparations = await MedicinePreparationSummary.find();

    const enrichedPreparations = await Promise.all(
      allPreparations.map(async (preparation) => {
        const prescription = await Prescription.findById(preparation.prescriptionId);
        if (!prescription) {
          return {
            ...preparation.toObject(),
            doctorId: null,
            doctorName: null,
            patientId: null,
            patientName: null
          };
        }

        const doctor = await Doctor.findById(prescription.doctorId);
        const patient = await Patient.findById(prescription.patientId);

        return {
          ...preparation.toObject(),
          doctorId: prescription.doctorId || null,
          doctorName: doctor?.name || null,
          patientId: prescription.patientId || null,
          patientName: patient?.name || null
        };
      })
    );

    res.status(200).json(enrichedPreparations);
  } catch (error) {
    console.error("Error fetching medicine preparations:", error);
    res.status(500).json({ message: "Server error while fetching medicine preparations" });
  }
};
const updateMedicinePrepared = async (req, res) => {
  try {
    const { prescriptionId, medicinePrepared } = req.body;

    if (!prescriptionId || typeof medicinePrepared !== "boolean") {
      return res.status(400).json({
        message: "prescriptionId and medicinePrepared(boolean) are required",
      });
    }

    const appointment = await Appointment.findOneAndUpdate(
      { prescriptionID: prescriptionId }, // DB field name
      { medicinePrepared },
      { new: true }
    );

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    res.status(200).json({
      message: "medicinePrepared status updated successfully",
      appointment,
    });
  } catch (error) {
    console.error("❌ Error updating medicinePrepared:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const logWastage = async (req, res) => {
  try {
    const { prescriptionId, medicineName } = req.body;

    if (!prescriptionId || !medicineName) {
      return res.status(400).json({ message: 'prescriptionId and medicineName are required.' });
    }

    const preparationSummary = await MedicinePreparationSummary.findOne({
      prescriptionId: new mongoose.Types.ObjectId(prescriptionId),
    });

    if (!preparationSummary) {
      return res.status(404).json({ message: 'Preparation summary not found.' });
    }

    const medicinePreparation = preparationSummary.medicinePreparations.find(
      (prep) => prep.medicineName === medicineName
    );

    if (!medicinePreparation) {
      return res.status(404).json({ message: 'Medicine preparation not found.' });
    }

    // Create the wastage snapshot BEFORE modifying the original data
    const wastageLogData = {
      prescriptionId: preparationSummary.prescriptionId,
      medicinePreparations: [
        {
          medicineName: medicinePreparation.medicineName,
          preparationVideoUrl: medicinePreparation.preparationVideoUrl,
          medPrepStartTime: medicinePreparation.medPrepStartTime,
          rawMaterialsUsed: medicinePreparation.rawMaterialsUsed, // Logs the used amounts before reset
          attempt: Number(medicinePreparation.attempt) + 1,
          preparationPhoto: medicinePreparation.preparationPhoto
        },
      ],
      createdAt: new Date(),
    };

    const newWastageLog = new WastageLog(wastageLogData);
    await newWastageLog.save();

    // --- NEW LOGIC STARTS HERE ---

    // 1. Loop through each raw material from the failed attempt
    medicinePreparation.rawMaterialsUsed.forEach((material) => {
      if (material.quantityUsed && material.quantityUsed > 0) {
        // 2. Add the used quantity to the leaked quantity.
        // The '|| 0' handles cases where quantityLeaked might not exist yet.
        material.quantityLeaked = (material.quantityLeaked || 0) + material.quantityUsed;

        // 3. Reset the quantityUsed to 0 for the next attempt.
        material.quantityUsed = 0;
      }
    });

    // --- NEW LOGIC ENDS HERE ---

    // Increment the attempt counter for the next try
    medicinePreparation.attempt = String(Number(medicinePreparation.attempt) + 1);
    
    // Save the updated original summary document
    await preparationSummary.save();

    res.status(200).json({
      message: 'Wastage logged and attempt count incremented successfully.',
      wastageLog: newWastageLog,
      updatedPreparationSummary: preparationSummary,
    });
  } catch (error) {
    console.error('Error logging wastage:', error);
    res.status(500).json({ message: 'An error occurred while logging wastage.', error: error.message });
  }
};
const uploadPreparationPhoto = async (req, res) => {
  try {
    const { prescriptionId, medicineName } = req.body;

    if (!prescriptionId || !medicineName || !req.file) {
      return res.status(400).json({ message: "Prescription ID, medicine name, and photo are required" });
    }

    // Step 1: Upload file to Cloudinary
    const cloudinaryRes = await cloudinary.uploader.upload(req.file.path, {
      folder: "preparation_photos",
    });

    // Step 2: Remove local file
    fs.unlinkSync(req.file.path);

    // Step 3: Find the summary and update preparationPhoto
    const summary = await MedicinePreparationSummary.findOne({ prescriptionId });
    if (!summary) {
      return res.status(404).json({ message: "Medicine preparation summary not found" });
    }

    let found = false;
    for (const prep of summary.medicinePreparations) {
      if (prep.medicineName === medicineName) {
        prep.preparationPhoto = cloudinaryRes.secure_url;
        found = true;
        break;
      }
    }

    if (!found) {
      return res.status(404).json({ message: "Medicine preparation not found" });
    }
    summary.markModified('medicinePreparations');

    await summary.save();

    res.status(200).json({
      message: "Preparation photo uploaded successfully",
      preparationPhoto: cloudinaryRes.secure_url,
    });
  } catch (error) {
    console.error("Error uploading preparation photo:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const addInstructionsToMedicine = async (req, res) => {
  // 1. Get the payload from the request body
  const { prescriptionId, medicineName, instructionStrings } = req.body;

  // 2. Basic validation
  if (!prescriptionId || !medicineName || !Array.isArray(instructionStrings)) {
    return res.status(400).json({ 
      message: 'Missing required fields: prescriptionId, medicineName, and instructionStrings (must be an array).' 
    });
  }

  try {
    // 3. Transform the array of strings into the Map object for the schema
    const instructionsMap = instructionStrings.reduce((acc, instruction) => {
      acc[instruction] = false; // Initialize all as 'false' (a pending task)
      return acc;
    }, {});

    // 4. Find the summary and update the specific medicine's instructions
    const result = await MedicinePreparationSummary.updateOne(
      {
        prescriptionId: prescriptionId,
        'medicinePreparations.medicineName': medicineName,
      },
      {
        $set: { 'medicinePreparations.$.instructions': instructionsMap },
      }
    );

    // 5. Check if the document was found and updated
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'No matching prescription and medicine found.' });
    }

    if (result.modifiedCount === 0) {
      // This can happen if the instructions sent are identical to what's already in the DB
      return res.status(200).json({ message: 'Instructions are already set to the provided values.' });
    }
    
    // 6. Send a success response
    res.status(200).json({
      message: 'Instructions added successfully!',
      updatedInstructions: instructionsMap,
    });

  } catch (error) {
    console.error('Error adding instructions:', error);
    res.status(500).json({ message: 'Server error while adding instructions.' });
  }
};
const updateInstructionStatus = async (req, res) => {
  // 1. Get the payload from the request body
  const { prescriptionId, medicineName, instructions } = req.body;

  // 2. Basic validation
  if (!prescriptionId || !medicineName || typeof instructions !== 'object' || instructions === null) {
    return res.status(400).json({ 
      message: 'Missing required fields: prescriptionId, medicineName, and instructions (must be an object).' 
    });
  }

  try {
    // 3. Dynamically build the update object using dot notation for the nested map.
    // This allows us to update multiple key-value pairs in the 'instructions' map in one go.
    const updateFields = {};
    for (const key in instructions) {
      if (Object.prototype.hasOwnProperty.call(instructions, key)) {
        // The key here is the instruction string, e.g., "Wear gloves during preparation"
        // The value is the boolean, e.g., true
        updateFields[`medicinePreparations.$.instructions.${key}`] = instructions[key];
      }
    }

    // If the instructions object is empty, there's nothing to update.
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: 'Instructions object cannot be empty.' });
    }

    // 4. Find the document and apply the updates atomically.
    const result = await MedicinePreparationSummary.updateOne(
      {
        prescriptionId: prescriptionId,
        'medicinePreparations.medicineName': medicineName
      },
      {
        $set: updateFields 
      }
    );
    
    // 5. Check if the document was found and updated
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'No matching prescription and medicine found.' });
    }
    
    res.status(200).json({ message: 'Instruction status updated successfully.' });

  } catch (error) {
    console.error('Error updating instruction status:', error);
    res.status(500).json({ message: 'Server error while updating instructions.' });
  }
};

const getPatientAddressFromPrescription = async (req, res) => {
  try {
    // 1. Get the prescriptionId from the URL parameters
    const { prescriptionId } = req.params;

    // 2. Validate the ID format
    if (!mongoose.Types.ObjectId.isValid(prescriptionId)) {
      return res.status(400).json({ message: 'Invalid Prescription ID format.' });
    }

    // 3. Find the prescription and use .populate() to automatically fetch related patient data
    // The second argument to populate specifies which fields to include.
    const prescription = await Prescription.findById(prescriptionId)
      .populate('patientId', 'name address phone currentLocation');

    // 4. Handle cases where the prescription or patient is not found
    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found.' });
    }
    if (!prescription.patientId) {
        return res.status(404).json({ message: 'Patient not found for this prescription.' });
    }

    // 5. Send the populated patient data as the response
    res.status(200).json(prescription.patientId);

  } catch (error) {
    console.error('Error fetching patient details:', error);
    res.status(500).json({ message: 'Server error while fetching patient details.' });
  }
};
const addPackagingDetails = async (req, res) => {
  // 1. Get data from the multipart form
  const { prescriptionId, packagingData } = req.body;
  const packedImageFile = req.file;

  if (!prescriptionId || !packagingData) {
    return res.status(400).json({ message: 'prescriptionId and packagingData are required.' });
  }

  try {
    const packagingDetails = JSON.parse(packagingData);

    // --- NEW LOGIC STARTS HERE ---

    // Loop through each packaging item to fetch and update its stock
    for (const item of packagingDetails) {
      // 1. Find the corresponding raw material in your inventory
      const rawMaterial = await RawMaterial.findById(item.materialId);

      if (!rawMaterial) {
        // If any material is not found, stop the process immediately
        throw new Error(`Packaging material with ID ${item.materialId} not found.`);
      }

      // 2. Store its current quantity as 'presentQuantity' for the log
      item.presentQuantity = rawMaterial.currentQuantity;

      // 3. Decrement the stock in the RawMaterial collection
      rawMaterial.currentQuantity -= item.quantityUsed;
      
      // Ensure stock doesn't go below zero
      if (rawMaterial.currentQuantity < 0) {
        throw new Error(`Not enough stock for material: ${rawMaterial.name}.`);
      }

      // 4. Save the updated raw material document
      await rawMaterial.save();
    }

    // --- NEW LOGIC ENDS HERE ---

    // Upload the packed image to Cloudinary if it exists
    let packedImageUrl = '';
    if (packedImageFile) {
      const result = await cloudinary.uploader.upload(packedImageFile.path, {
        folder: 'packed_medicines'
      });
      packedImageUrl = result.secure_url;
      fs.unlinkSync(packedImageFile.path);
    }

    // Add the uploaded image URL to the first packaging item
    if (packedImageUrl && packagingDetails.length > 0) {
      packagingDetails[0].packedImageUrl = packedImageUrl;
    }

    // Find the summary and push the fully prepared packaging details into the array
    const result = await MedicinePreparationSummary.updateOne(
      { prescriptionId: prescriptionId },
      {
        $push: { packagingUsed: { $each: packagingDetails } }
      }
    );

    if (result.matchedCount === 0) {
      throw new Error('Preparation summary not found.');
    }

    res.status(200).json({ message: 'Packaging details added and stock updated successfully.' });

  } catch (error) {
    console.error("Error adding packaging details:", error);
    if (error instanceof SyntaxError) {
      return res.status(400).json({ message: 'Invalid format for packagingData. It must be a valid JSON string.' });
    }
    // Send a more specific error message back to the client
    res.status(500).json({ message: error.message || 'Server error while adding packaging details.' });
  }
};


const updateMasterInstructions = async (req, res) =>{
  const instructionsToAppend = req.body;

  if (Object.keys(instructionsToAppend).length === 0) {
    return res.status(400).json({ message: 'Request body cannot be empty.' });
  }

  try {
    // --- THIS IS THE KEY CHANGE ---
    // Dynamically build the update object with the $push operator.
    const updateFields = {};
    for (const key in instructionsToAppend) {
      // For each step (e.g., "step-2"), create a command to push
      // the new strings into its existing array.
      updateFields[`steps.${key}`] = { $each: instructionsToAppend[key] };
    }

    const updateOperation = { $push: updateFields };
    // The final command will look like:
    // { $push: { "steps.step-2": { $each: ["New string 1", "New string 2"] } } }
    
    const updatedInstructions = await MasterInstructions.findOneAndUpdate(
      { name: 'default_instructions' },
      updateOperation, // Use the new $push command
      { new: true, upsert: true }
    );

    res.status(200).json({
      message: 'Master instructions appended successfully.',
      data: updatedInstructions
    });

  } catch (error) {
    console.error("Error patching master instructions:", error);
    res.status(500).json({ message: 'An error occurred.', error: error.message });
  }
};
const getAllMasterInstructions = async (req, res) => {
  try {
    // Find the single document where all instructions are stored
    const instructionDoc = await MasterInstructions.findOne({ name: 'default_instructions' });

    // If no instructions have been saved yet, return an empty object
    if (!instructionDoc) {
      return res.status(200).json({});
    }

    // Return only the 'steps' object from the document
    res.status(200).json(instructionDoc.steps);

  } catch (error) {
    console.error("Error fetching master instructions:", error);
    res.status(500).json({ message: 'An error occurred while fetching instructions.' });
  }
};
const setMedicineExpiryDate = async (req, res) => {
  const { prescriptionId, medicineName, medicineExpiryDate } = req.body;

  // 1. Validate the input
  if (!prescriptionId || !medicineName || !medicineExpiryDate) {
    return res.status(400).json({ message: 'prescriptionId, medicineName, and medicineExpiryDate are required.' });
  }

  try {
    // 2. Find the summary and update the nested medicine preparation in one step
    // The positional operator '$' updates the specific element that was matched in the query.
    const result = await MedicinePreparationSummary.updateOne(
      { 
        "prescriptionId": prescriptionId, 
        "medicinePreparations.medicineName": medicineName 
      },
      { 
        $set: { "medicinePreparations.$.medicineExpiryDate": medicineExpiryDate }
      }
    );

    // 3. Check if a document was found and updated
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'No matching prescription and medicine found.' });
    }
    
    if (result.modifiedCount === 0) {
        return res.status(200).json({ message: 'Expiry date was already set to this value.' });
    }

    res.status(200).json({ message: 'Medicine expiry date updated successfully.' });

  } catch (error) {
    console.error("Error setting medicine expiry date:", error);
    res.status(500).json({ message: 'Server error while updating expiry date.' });
  }
};
module.exports = {
  initializeMedicinePreparation,
  updatePreWeight,
  logWastage,
  updatePostWeight,
  getAllLeakagesDetected,
  getLeakagesAboveThreshold,
  getAllMedPrepSummaryData,
  uploadToCloudinary,
  getPackagingMaterials,
  getAllMedicinePreparationSummaries,
  uploadPreparationVideo,
  getRawMaterialByDispenseQuantity,
  updateRawMaterialDispenseQuantity,
  getNonBottlePackagingMaterials,
  updateRawMaterialQuantityByAmount,
  updateMedicinePrepared,
  uploadPreparationPhoto,
  addInstructionsToMedicine,
  updateInstructionStatus,
  getPatientAddressFromPrescription,
  addPackagingDetails,
  updateMasterInstructions,
  getAllMasterInstructions,
  setMedicineExpiryDate
};

