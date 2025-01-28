const Allocation = require('../models/AllocationModel');
const Doctor = require('../models/doctorModel');
const Patient = require('../models/patientModel');
const SpecialAllocation = require('../models/IndividualAllocation');
exports.getDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find().select('name _id follow role');
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

const mongoose = require('mongoose');
exports.saveAllocations = async (req, res) => {
  console.log("Endpoint reached: Save Allocations");
  try {
    const { allocations } = req.body;
    console.log("Received allocations:", allocations);

    if (!Array.isArray(allocations) || allocations.length === 0) {
      return res.status(400).json({ message: 'Invalid or empty allocations array' });
    }

    // Clear existing allocations
    const deleteResult = await Allocation.deleteMany({});
    console.log("Deleted allocations:", deleteResult);

    // Save all allocations, including those with empty doctorId
    const savedAllocations = await Allocation.insertMany(allocations);
    console.log("Saved allocations:", savedAllocations);

    // Update patients' currentAllocDoc and doctor's follow field based on follow-up type
    for (const allocation of allocations) {
      if (allocation.followUpType) {
        if (allocation.doctorId) {
          console.log("Found doctorId:", allocation.doctorId);
          const doctor = await Doctor.findOne({ _id: allocation.doctorId });
          console.log("Found doctor:", doctor);
          if (doctor) {
            // Check if follow contains "No follows" and reset it
            let followList = doctor.follow === "No follows" ? [] : doctor.follow.split(", ");
            
            // Add followUpType to list only if it's not already present
            if (!followList.includes(allocation.followUpType)) {
              followList.push(allocation.followUpType);
            }

            // Join the followList array back into a comma-separated string
            const updatedFollow = followList.join(", "); // Ensure space after the comma

            // Update doctor's follow
            const doctorUpdateResult = await Doctor.updateOne(
              { _id: doctor._id },
              { $set: { follow: updatedFollow } }
            );
            console.log("Updated doctor's follow:", doctorUpdateResult);
          }
        } else {
          // Remove currentAllocDoc for unassigned roles
          const unsetResult = await Patient.updateMany(
            { follow: allocation.followUpType },
            { $unset: { currentAllocDoc: "" } }
          );
          console.log("Unset currentAllocDoc result:", unsetResult);
        }
      }
    }

    res.status(200).json({
      message: 'Allocations saved successfully',
      allocations: savedAllocations
    });
  } catch (error) {
    console.error('Error saving allocations:', error);
    res.status(500).json({ message: 'Error saving allocations', error: error.message });
  }
};

exports.resetAllocations = async (req, res) => {
  try {
    // Remove all allocations
    await Allocation.deleteMany({});

    // Reset all doctors' follow to default
    await Doctor.updateMany({}, { follow: "No follows" });

    res.status(200).json({ message: 'All allocations have been reset successfully' });
  } catch (error) {
    console.error("Error in resetAllocations:", error);
    res.status(500).json({ message: 'Error resetting allocations', error: error.message });
  }
};

exports.getAllocationsWithDoctors = async (req, res) => {
  try {
    const allocations = await Allocation.aggregate([
      {
        $lookup: {
          from: 'doctors',
          localField: 'doctorId',
          foreignField: '_id',
          as: 'doctor'
        }
      },
      {
        $unwind: '$doctor'
      },
      {
        $project: {
          followUpType: 1,
          role: 1,
          'doctor.name': 1,
          'doctor._id': 1
        }
      }
    ]);

    res.status(200).json(allocations);
  } catch (error) {
    console.error('Error fetching allocations:', error);
    res.status(500).json({ message: 'Error fetching allocations', error: error.message });
  }
};

exports.getDoctorSpecialAllocations = async (req, res) => { 
  console.log("Endpoint reached: getDoctorSpecialAllocations"); 
  try { 
      const { doctorId } = req.params; 
 
      console.log("Received doctorId:", doctorId); 
      // Validate doctorId 
      if (!mongoose.Types.ObjectId.isValid(doctorId)) { 
          return res.status(400).json({ message: 'Invalid doctor ID format' }); 
      } 
 
      // Find all special allocations for the doctor 
      const allocations = await SpecialAllocation.find({ doctorId: new mongoose.Types.ObjectId(doctorId) })
        .populate('patientId', 'name phone whatsappNumber email age gender currentLocation patientEntry newExisting consultingFor diseaseName diseaseTypeAvailable messageSent follow followComment patientProfile enquiryStatus appDownload appointmentFixed medicinePaymentConfirmation callCount comments')
        .populate('patientId.diseaseType', 'name');
 
      if (!allocations.length) { 
          return res.status(200).json([]); 
      } 
 
      // Transform the data to match the expected format 
      // const formattedAllocations = allocations.map(allocation => ({ 
      //     _id: allocation.patientId._id,
      //     specialAllocationId: allocation._id, 
      //     allocationCreatedAt: allocation.createdAt, 
      //     ...allocation.patientId.toObject() 
      // })); 

      const formattedAllocations = allocations
        .filter(allocation => allocation.patientId)
        .map(allocation => ({ 
          _id: allocation.patientId._id,
          specialAllocationId: allocation._id, 
          allocationCreatedAt: allocation.createdAt, 
          ...allocation.patientId.toObject(),
        })); 
 
      res.status(200).json(formattedAllocations); 
  } catch (error) { 
      console.error('Error in getDoctorSpecialAllocations:', error); 
      res.status(500).json({ message: 'Error fetching special allocations', error: error.message }); 
  } 
};
