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

    for (const summary of summaries) {
      for (const prep of summary.medicinePreparations) {
        for (const raw of prep.rawMaterialsUsed) {
          if (raw.leakageDetected) {
            // Fetch prescription + doctorId + patientId + doctorName + patientName
            let prescribedQuantity = null;
            let doctorId = null;
            let patientId = null;
            let doctorName = null;
            let patientName = null;
            let rawMat = null;

            try {
              const prescription = await Prescription.findById(summary.prescriptionId);
              if (prescription) {
                doctorId = prescription.doctorId;
                patientId = prescription.patientId;

                const prescriptionItem = prescription.prescriptionItems.find(
                  (item) => item.medicineName === prep.medicineName
                );
                if (prescriptionItem) {
                  const rawMaterialDetail = prescriptionItem.rawMaterialDetails.find(
                    (rm) => rm._id.toString() === raw.materialId.toString()
                  );
                  prescribedQuantity = rawMaterialDetail?.quantity ?? null;
                }

                // Fetch doctor name
                const doctor = await Doctor.findById(doctorId);
                doctorName = doctor?.name ?? null;

                // Fetch patient name
                const patient = await Patient.findById(patientId);
                patientName = patient?.name ?? null;
              }
            } catch (err) {
              console.error('Error fetching prescription/doctor/patient info:', err);
            }

            // Fetch current quantity & uom from RawMaterial
            let currentQuantity = null;
            let uom = null;
            try {
              rawMat = await RawMaterial.findById(raw.materialId);
              currentQuantity = rawMat?.currentQuantity ?? null;
              uom = rawMat?.uom ?? null;
            } catch (err) {
              console.error('Error fetching raw material info:', err);
            }

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
              uom
            });
          }
        }
      }
    }

    res.status(200).json(leakedRawMaterials);
  } catch (error) {
    console.error('Error in getAllLeakagesDetected:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const getLeakagesAboveThreshold = async (req, res) => {
  try {
    const thresholdPercentage = parseFloat(req.query.threshold) || 1;

    const summaries = await MedicinePreparationSummary.find({});

    const leakages = [];

    for (const summary of summaries) {
      for (const prep of summary.medicinePreparations) {
        for (const raw of prep.rawMaterialsUsed) {
          if (raw.quantityLeaked && raw.quantityLeaked > 0) {
            let prescribedQuantity = null;
            let currentRawMaterialQty = null;
            let doctorName = null;
            let patientName = null;
            let rawMat = null; // ✅ declared here

            try {
              const prescription = await Prescription.findById(summary.prescriptionId);
              if (prescription) {
                const prescriptionItem = prescription.prescriptionItems.find(
                  (item) => item.medicineName === prep.medicineName
                );
                if (prescriptionItem) {
                  const rawMaterialDetail = prescriptionItem.rawMaterialDetails.find(
                    (rm) => rm._id.toString() === raw.materialId.toString()
                  );
                  prescribedQuantity = rawMaterialDetail?.quantity ?? null;
                }

                // Fetch doctor name
                const doctor = await Doctor.findById(prescription.doctorId);
                doctorName = doctor?.name ?? null;

                // Fetch patient name
                const patient = await Patient.findById(prescription.patientId);
                patientName = patient?.name ?? null;
              }
            } catch (err) {
              console.error('Error fetching prescribed quantity or doctor/patient name:', err);
            }

            try {
              rawMat = await RawMaterial.findById(raw.materialId); // ✅ assigned here
              currentRawMaterialQty = rawMat?.currentQuantity ?? null;
            } catch (err) {
              console.error('Error fetching raw material quantity:', err);
            }

            if (prescribedQuantity && prescribedQuantity > 0) {
              const leakagePercentage = (raw.quantityLeaked / prescribedQuantity) * 100;

              if (leakagePercentage >= thresholdPercentage) {
                leakages.push({
                  prescriptionId: summary.prescriptionId,
                  doctorName,
                  patientName,
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
                  LeakedByUsage: rawMat?.totalLeakedQuantity ?? null,   // ✅ fixed access
                  LeakedByStorage: rawMat?.storageLeakedQuantity ?? null, // ✅ fixed access
                  createdAt: summary.createdAt
                });
              }
            }
          }
        }
      }
    }

    res.status(200).json({ leakages });
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
          materialId: material.materialId,
          materialName: material.materialName,
          quantityUsed: material.quantityUsed,
          prescribedQuantity,
          QuantityLeaked:material.quantityLeaked
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
      return res.status(404).json({ message: 'Preparation summary not found for the given prescription ID.' });
    }

    const medicinePreparation = preparationSummary.medicinePreparations.find(
      (prep) => prep.medicineName === medicineName
    );

    if (!medicinePreparation) {
      return res.status(404).json({ message: 'Medicine preparation not found with the given name.' });
    }

    const wastageLogData = {
      prescriptionId: preparationSummary.prescriptionId,
      medicinePreparations: [
        {
          medicineName: medicinePreparation.medicineName,
          preparationVideoUrl: medicinePreparation.preparationVideoUrl,
          medPrepStartTime: medicinePreparation.medPrepStartTime,
          rawMaterialsUsed: medicinePreparation.rawMaterialsUsed,
          attempt: Number(medicinePreparation.attempt) + 1,
        },
      ],
      createdAt: new Date(),
    };

    const newWastageLog = new WastageLog(wastageLogData);
    await newWastageLog.save();

    medicinePreparation.attempt = String(Number(medicinePreparation.attempt) + 1);
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
  updateMedicinePrepared ,
  uploadPreparationPhoto 
};

