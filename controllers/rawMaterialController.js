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

// threshold value calculator for all the medicine and alert the meicine below the threshold value
exports.thresholdcalculator = async(req,res)=>{

    try{

      const result = await RawMaterial.aggregate([
          {
          $group: {
              _id: { name: "$name", package: "$packageSize" },
              totalQuantity: { $sum: "$quantity" },
              currentQuantity : {$sum : "$currentQuantity"},
              threshold: { $first: "$thresholdQuantity" }
          }
          }
      ]);

      const finalresult = result.filter(item => item.currentQuantity < item.threshold);
      if(!finalresult){
          res.send({"message" : "no rawmaterial reached the threshold"});
      }

      res.status(200).json({"rawmaterial": finalresult});

    }
    catch(err){
        console.log("error in threshold part",err);
    }
};

// particular log in rawmaterial collection

exports.particularRawmaterial = async (req,res)=>{
  try{
    const {name} = req.body;

    if(!name){
      return res.status(400).json({ message: 'Name field is required.' });
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
    const { name, ...updateFields } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Name field is required.' });
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