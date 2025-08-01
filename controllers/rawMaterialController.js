const mongoose = require('mongoose');
const crypto = require('crypto');
const RawMaterial = require('../models/RawMaterial');
const bwipjs = require('bwip-js');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const AmendmentHistory = require('../models/AmendmentHistory');

// Utility: Generate barcode buffer
const generateBarcodeBuffer = async (text) => {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: 'code128',
        text: text,
        scale: 3,
        height: 10,
        includetext: true,
        textxalign: 'center',
      },
      (err, png) => {
        if (err) reject(err);
        else resolve(png);
      }
    );
  });
};

// Utility: Upload buffer to Cloudinary
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'barcodes',
        resource_type: 'image',
      },
      (error, result) => {
        if (result) resolve(result.secure_url);
        else reject(error);
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// Utility: Generate 6-character uppercase alphanumeric ID
const generateShortId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

// Utility: Generate unique barcode (check collisions recursively)
const generateUniqueBarcode = async () => {
  const shortId = generateShortId();
  const barcode = `RM-${shortId}`;
  const exists = await RawMaterial.findOne({ barcode });
  return exists ? generateUniqueBarcode() : barcode;
};

// Get all raw materials
exports.getAllRawMaterials = async (req, res) => {
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

const fs = require('fs');
const path = require('path');

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
      costPerUnit,
    } = req.body;

    // Step 1: Upload product image to Cloudinary if file exists
    let productImageUrl = '';
    if (req.file && req.file.path) {
      productImageUrl = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload(
          req.file.path,
          { folder: 'productImages', resource_type: 'image' },
          (error, result) => {
            if (result) resolve(result.secure_url);
            else reject(error);
          }
        );
      });

      // Optional: delete the file from local disk after upload
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Failed to delete temp file:', err);
      });
    }

    // Step 2: Generate unique barcode
    const barcode = await generateUniqueBarcode();

    // Step 3: Generate barcode image and upload to Cloudinary
    const barcodeBuffer = await generateBarcodeBuffer(barcode);
    const barcodeImageUrl = await uploadToCloudinary(barcodeBuffer);

    // Step 4: Create and save raw material
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
      productImage: productImageUrl,
      costPerUnit: Number(costPerUnit),
      barcode,
      barcodeImageUrl,
    });

    const savedRawMaterial = await newRawMaterial.save();
    res.status(201).json(savedRawMaterial);
  } catch (error) {
    console.error("Validation Error:", error);
    res.status(400).json({ message: 'Error creating raw material', error: error.message });
  }
};

exports.updateRawMaterial = async (req, res) => {
  try {
    const updatePayload = {
      ...req.body,
      updatedAt: new Date()
    };

    // Fetch original document before update
    const originalDoc = await RawMaterial.findById(req.params.id).lean();
    if (!originalDoc) {
      return res.status(404).json({ message: 'Raw material not found' });
    }

    // Perform the update
    const updatedDoc = await RawMaterial.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    );

    // Detect differences
    const changes = {};
    for (const key in updatePayload) {
      const oldVal = originalDoc[key];
      const newVal = updatePayload[key];

      // Skip undefined fields
      if (oldVal === undefined || newVal === undefined) continue;

      // Normalize ObjectId to string
      const normOld = mongoose.isValidObjectId(oldVal) ? oldVal.toString() : oldVal;
      const normNew = mongoose.isValidObjectId(newVal) ? newVal.toString() : newVal;

      // Normalize Date values
      const isOldDate = oldVal instanceof Date;
      const isNewDate = newVal instanceof Date;

      if (isOldDate && isNewDate) {
        if (oldVal.getTime() !== newVal.getTime()) {
          changes[key] = {
            from: oldVal.toISOString(),
            to: newVal.toISOString()
          };
        }
      } else if (normOld !== normNew) {
        changes[key] = `${normOld} → ${normNew}`;
      }
    }

    // Save amendment log if changes exist
    if (Object.keys(changes).length > 0) {
      await AmendmentHistory.create({
        rawMaterialId: req.params.id,
        rawMaterialName: originalDoc.name,
        updatedBy: req.user?.name || 'Admin',
        changes,
        amendedAt: new Date(),
        isPresent: updatedDoc.isPresent,
        isDamaged: updatedDoc.isDamaged,
        isSealed: updatedDoc.isSealed,
        usageStatus: updatedDoc.usageStatus
      });
    }

    res.status(200).json({
      message: 'Raw material updated successfully',
      original: originalDoc,
      updated: updatedDoc,
      changesLogged: changes
    });
  } catch (error) {
    res.status(400).json({
      message: 'Error updating raw material',
      error: error.message
    });
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

// Reduce quantity
exports.reduceQuantity = async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity <= 0) {
    return res.status(400).json({ message: 'Valid quantity required' });
  }

  const rawMaterial = await RawMaterial.findById(id);

  if (!rawMaterial) {
    return res.status(404).json({ message: 'Raw material not found' });
  }

  if (rawMaterial.currentQuantity < quantity) {
    return res.status(400).json({ message: 'Insufficient quantity available' });
  }

  rawMaterial.currentQuantity -= parseFloat(quantity);
  rawMaterial.updatedAt = Date.now();

  await rawMaterial.save();

  res.status(200).json({
    success: true,
    data: rawMaterial,
  });
};
exports.getRawMaterialByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;

    const rawMaterial = await RawMaterial.findOne({ barcode });

    if (!rawMaterial) {
      return res.status(404).json({ message: "Raw material not found for this barcode" });
    }

    res.status(200).json(rawMaterial);
  } catch (error) {
    console.error("Error retrieving raw material by barcode:", error);
    res.status(500).json({ message: "Server error" });
  }
};
// threshold value calculator for all the medicine and alert the meicine below the threshold value
exports.thresholdcalculator = async (req, res) => {
  try {
    const result = await RawMaterial.aggregate([
      {
        $group: {
          _id: { name: "$name", package: "$packageSize" },
          totalQuantity: { $sum: "$quantity" },
          currentQuantity: { $sum: "$currentQuantity" },
          threshold: { $first: "$thresholdQuantity" }  // stored as percentage, e.g., 80
        }
      }
    ]);

    const finalresult = result.filter(item => {
      const thresholdLimit = (item.totalQuantity * item.threshold) / 100;
      return item.currentQuantity < thresholdLimit;
    });

    if (finalresult.length === 0) {
      return res.status(200).json({ message: "No raw material has dropped below the threshold." });
    }

    res.status(200).json({ rawmaterial: finalresult });

  } catch (err) {
    console.log("Error in threshold part", err);
    res.status(500).json({ message: "Server error." });
  }
};

// particular log in rawmaterial collection

exports.particularRawmaterial = async (req,res)=>{
  try{
    const {_id} = req.body;

    if(!_id){
      return res.status(400).json({ message: 'Id field is required.' });
    }

    const output = await RawMaterial.find({name : name});

    if(output.length === 0){
      res.status(404).json({message : "No document was found"});
    }

    res.json(output);
  }
  catch (error) {
    console.error('Error fetching raw materials by name:', error);
    res.status(500).json({ message: 'Server error.' });
  }
}

// ammendment log updation 

exports.ammendmentlogupdation = async (req, res) => {
  try {
    const { _id, ...updateFields } = req.body;

    if (!_id) {
      return res.status(400).json({ message: 'Id field is required.' });
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: 'No fields to update were provided.' });
    }

    // Always set Ammendment to true
    updateFields.Ammendment = true;

    // Set updatedAt to current time
    updateFields.updatedAt = new Date();

    // Update all documents with matching name
    const result = await RawMaterial.updateMany(
      { name: name },        // Filter by name
      { $set: updateFields } // Set all provided fields including Ammendment & updatedAt
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: 'No matching documents found.' });
    }

    res.json({ message: `Successfully updated ${result.modifiedCount} documents.` });
  } catch (error) {
    console.error('Error updating documents:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// all the updated documents inside the rawmaterials collection 

exports.getAllUpdateddocument = async (req,res)=>{
  try {
    // Query all documents where Ammendment === true
    const amendedMaterials = await RawMaterial.find({ Ammendment: true });
    res.json(amendedMaterials);
  } catch (error) {
    console.error('Error fetching amended raw materials:', error);
    res.status(500).json({ message: 'Server error.' });
  }
}
exports.fetchAllAmendmentHistories = async (req, res) => {
  try {
    // Populate rawMaterial info (to get name/type/category etc.)
    const histories = await AmendmentHistory.find().lean();

    // Fetch raw material names in bulk
    const rawMaterialIds = histories.map(h => h.rawMaterialId);
    const rawMaterialsMap = await RawMaterial.find({ _id: { $in: rawMaterialIds } })
      .select('name')
      .lean()
      .then(results =>
        results.reduce((acc, item) => {
          acc[item._id.toString()] = item.name;
          return acc;
        }, {})
      );

    // Attach the name to each history record
    const enrichedHistories = histories.map(h => ({
      ...h,
      rawMaterialName: rawMaterialsMap[h.rawMaterialId.toString()] || 'Unknown',
    }));

    res.status(200).json(enrichedHistories);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch amendment histories', error: error.message });
  }
};
exports.getUsedAndUnusedRawMaterials = async (req, res) => {
  try {
    // Step 1: Find all amendment logs where currentQuantity was changed
    const logs = await AmendmentHistory.find({
      'changes.currentQuantity': { $exists: true }
    }).select('rawMaterialId');

    const usedIds = logs.map(log => String(log.rawMaterialId));

    // Step 2: Fetch all raw materials
    const allMaterials = await RawMaterial.find();

    // Step 3: Prepare updates and update DB
    const bulkOperations = allMaterials.map(material => {
      const isUsed = usedIds.includes(String(material._id));
      const newStatus = isUsed ? 'used' : 'unused';

      return {
        updateOne: {
          filter: { _id: material._id },
          update: { $set: { usageStatus: newStatus } }
        }
      };
    });

    // Step 4: Execute bulk update
    await RawMaterial.bulkWrite(bulkOperations);

    // Step 5: Fetch updated records
    const updatedMaterials = await RawMaterial.find();

    return res.status(200).json(updatedMaterials);
  } catch (error) {
    console.error('Error updating usage status:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
exports.getUnusedRawMaterialByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;

    const rawMaterial = await RawMaterial.findOne({ barcode });

    if (!rawMaterial) {
      return res.status(404).json({ message: "Raw material not found for this barcode" });
    }

    if (rawMaterial.usageStatus === "used") {
      return res.status(403).json({ message: "The item you scanned is frequently used" });
    }

    return res.status(200).json(rawMaterial);
  } catch (error) {
    console.error("Error retrieving unused raw material by barcode:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
exports.updateRawMaterialStatusFlags = async (req, res) => {
  try {
    const { barcode } = req.params;
    const { isPresent, isDamaged, isSealed } = req.body;

    if (!barcode) {
      return res.status(400).json({ message: "Barcode is required in the URL." });
    }

    const updateFields = {};
    if (typeof isPresent === 'boolean') updateFields.isPresent = isPresent;
    if (typeof isDamaged === 'boolean') updateFields.isDamaged = isDamaged;
    if (typeof isSealed === 'boolean') updateFields.isSealed = isSealed;

    const updatedMaterial = await RawMaterial.findOneAndUpdate(
      { barcode },
      { $set: updateFields },
      { new: true }
    );

    if (!updatedMaterial) {
      return res.status(404).json({ message: "Raw material not found for given barcode." });
    }

    return res.status(200).json({
      message: "Status flags updated successfully.",
      updatedMaterial
    });
  } catch (error) {
    console.error("Error updating raw material flags:", error);
    return res.status(500).json({ message: "Server error." });
  }
};

