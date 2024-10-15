const Allocation = require('../models/AllocationModel');
const Doctor = require('../models/doctorModel');

exports.getDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find().select('name _id follow');
    res.status(200).json(doctors);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching doctors', error: error.message });
  }
};

exports.getAllocations = async (req, res) => {
  try {
    const allocations = await Allocation.find().populate('doctorId', 'name follow');
    res.status(200).json(allocations);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching allocations', error: error.message });
  }
};

exports.saveAllocations = async (req, res) => {
  console.log("Endpoint reached: Save Allocations");
  try {
    const { allocations } = req.body;

    // First, reset all doctors' follow to default
    await Doctor.updateMany({}, { follow: "No follows" });

    // Remove all existing allocations
    await Allocation.deleteMany({});

    // Create new allocations and update doctors
    const updatedDoctors = new Map(); // To keep track of doctors we've updated

    for (const allocation of allocations) {
      // Create new allocation
      await Allocation.create({
        role: allocation.role,
        doctorId: allocation.doctorId,
        followUpType: allocation.followUpType
      });

      // Update doctor's follow
      if (!updatedDoctors.has(allocation.doctorId)) {
        const doctor = await Doctor.findById(allocation.doctorId);
        if (doctor) {
          let newFollow = allocation.followUpType;
          
          // If this doctor already has other follows, append this one
          if (updatedDoctors.has(allocation.doctorId)) {
            const existingFollow = updatedDoctors.get(allocation.doctorId);
            newFollow = existingFollow + ", " + allocation.followUpType;
          }
          
          await Doctor.findByIdAndUpdate(
            allocation.doctorId,
            { follow: newFollow }
          );
          
          updatedDoctors.set(allocation.doctorId, newFollow);
        }
      } else {
        // If we've already updated this doctor, append the new follow type
        const existingFollow = updatedDoctors.get(allocation.doctorId);
        const newFollow = existingFollow + ", " + allocation.followUpType;
        
        await Doctor.findByIdAndUpdate(
          allocation.doctorId,
          { follow: newFollow }
        );
        
        updatedDoctors.set(allocation.doctorId, newFollow);
      }
    }

    // Fetch and return the updated allocations
    const newAllocations = await Allocation.find().populate('doctorId', 'name follow');
    res.status(200).json(newAllocations);

  } catch (error) {
    console.error("Error in saveAllocations:", error);
    res.status(500).json({ message: 'Error saving allocations', error: error.message });
  }
};