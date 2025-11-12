const mongoose = require('mongoose');
const crypto = require('crypto');
const RawMaterial = require('../models/RawMaterial');
const bwipjs = require('bwip-js');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const AmendmentHistory = require('../models/AmendmentHistory');

// Utility: Generate QR code buffer
// Utility: Generate QR code buffer
const generateQrCodeBuffer = async (text, qrSize) => {
  // Define the mapping from size string to cm dimensions
  const sizeMap = {
    "Very Small": { width: 0.5, height: 0.5 },
    "Small":      { width: 1.0, height: 1.0 },
    "Medium":     { width: 1.5, height: 1.5 },
    "Large":      { width: 2.0, height: 2.0 }
  };

  // 1 inch = 72 points
  // 1 inch = 2.54 cm
  // 1 cm = 72 / 2.54 points (approx 28.346)
  const cmToPoints = 72 / 2.54;

  const options = {
    bcid: 'qrcode',
    text: text,
  };

  // Check if the provided qrSize is in our map
  if (qrSize && sizeMap[qrSize]) {
    const dims = sizeMap[qrSize];
    // Use physical dimensions in points
    options.width = dims.width * cmToPoints;
    options.height = dims.height * cmToPoints;
  } else {
    // Fallback to original behavior if no valid size is provided
    options.scale = 3;
  }

  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(options, (err, png) => {
      if (err) reject(err);
      else resolve(png);
    });
  });
};

// Utility: Upload buffer to Cloudinary
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'qrcodes', // Changed folder for organization
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

// Utility: Generate unique ID for QR code (check collisions recursively)
const generateUniqueId = async () => {
  const shortId = generateShortId();
  const barcode = `RM-${shortId}`; // Keeping this format as the underlying ID
  const exists = await RawMaterial.findOne({ barcode });
  return exists ? generateUniqueId() : barcode;
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
      totalWeight,
      isAlcohol,
      vendorName,
      vendorPhone,
      vendorLocation,
      qrSize  // <-- CHANGED: Replaced width/height with this
    } = req.body;

    let productImageUrl = '';
    if (req.file && req.file.path) {
      // Assuming you have Cloudinary configured for product images as well
      const result = await cloudinary.uploader.upload(req.file.path, { folder: 'products' });
      productImageUrl = result.secure_url;
    }

    const uniqueIdForQr = await generateUniqueId();
    
    // Pass the new size string to the generator
    // The generator will handle the mapping or fallback
    const qrCodeBuffer = await generateQrCodeBuffer(uniqueIdForQr, qrSize);
    
    const qrCodeImageUrl = await uploadToCloudinary(qrCodeBuffer);

    let bottleWeight = 0;
    // This check already correctly handles an empty totalWeight
    if (type !== "Packaging" && totalWeight && quantity) {
      bottleWeight = Number(totalWeight) - Number(quantity);
    }

    const rawMaterialData = {
      name,
      type,
      category,
      packageSize,
      uom,
      quantity: Number(quantity),
      currentQuantity: Number(currentQuantity),
      thresholdQuantity: Number(thresholdQuantity),
      costPerUnit: Number(costPerUnit) / Number(quantity),
      barcode: uniqueIdForQr,
      isAlcohol,
      barcodeImageUrl: qrCodeImageUrl,
      bottleWeight,
      vendorName,
      vendorPhone,
      vendorLocation,
      productImage: productImageUrl
    };

// Only add totalWeight if it was provided AND it was a valid number
    if (totalWeightIsValid) {
      rawMaterialData.totalWeight = parsedTotalWeight; // Use the safe parsed value
    }

    // Only add expiryDate if it was provided
    if (expiryDate) {
      rawMaterialData.expiryDate = new Date(expiryDate);
    }

    const newRawMaterial = new RawMaterial(rawMaterialData);
    const savedRawMaterial = await newRawMaterial.save();
    res.status(201).json(savedRawMaterial);

  } catch (error) {
    console.error("Error creating raw material:", error);
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
// Threshold value calculator for all the medicines and alert those below threshold
exports.thresholdcalculator = async (req, res) => {
  try {
    const result = await RawMaterial.aggregate([
      {
        $group: {
          _id: { name: "$name", package: "$packageSize" },
          totalQuantity: { $sum: "$quantity" },
          currentQuantity: { $sum: "$currentQuantity" },
          threshold: { $first: "$thresholdQuantity" } // stored as % of consumption, e.g., 80
        }
      }
    ]);

    // Apply logic: alert when remaining < (100 - threshold)%
    const finalresult = result.filter(item => {
      const thresholdLimit = item.totalQuantity * (1 - item.threshold / 100);
      return item.currentQuantity < thresholdLimit;
    });

    if (finalresult.length === 0) {
      return res.status(200).json({ message: "No raw material has dropped below the threshold." });
    }

    res.status(200).json({ rawmaterial: finalresult });

  } catch (err) {
    console.error("Error in threshold calculator:", err);
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
exports.updateProductImageByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;

    // 1. Check if a file was uploaded.
    // Multer will add the `file` object to the request if a file is present.
    if (!req.file || !req.file.path) {
      return res.status(400).json({ 
        success: false, 
        message: 'No product image file was uploaded.' 
      });
    }

    // 2. Find the raw material document using the unique barcode from the URL.
    const rawMaterial = await RawMaterial.findOne({ barcode: barcode });

    if (!rawMaterial) {
      // If not found, make sure to clean up the uploaded temp file before responding.
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Failed to delete temp file for non-existent barcode:', err);
      });
      return res.status(404).json({ 
        success: false, 
        message: `Raw material with barcode '${barcode}' not found.` 
      });
    }

    // 3. Upload the new image to Cloudinary from the temporary path on disk.
    // This logic is identical to your create function's upload logic.
    const productImageUrl = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        req.file.path,
        { 
          folder: 'productImages', // Keep uploads organized in Cloudinary
          resource_type: 'image' 
        },
        (error, result) => {
          if (result) resolve(result.secure_url);
          else reject(error);
        }
      );
    });

    // 4. IMPORTANT: Clean up and delete the temporary file from the server's disk.
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Failed to delete temp file after Cloudinary upload:', err);
    });

    // 5. Update the productImage field and the updatedAt timestamp.
    rawMaterial.productImage = productImageUrl;
    rawMaterial.updatedAt = Date.now();

    // 6. Save the updated document to the database.
    const updatedRawMaterial = await rawMaterial.save();

    // 7. Send a success response with the updated document.
    res.status(200).json({
      success: true,
      message: 'Product image updated successfully.',
      data: updatedRawMaterial,
    });

  } catch (error) {
    console.error("Error updating product image:", error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while updating product image.', 
      error: error.message 
    });
  }
};
