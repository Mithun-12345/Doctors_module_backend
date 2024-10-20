const Allocation = require('../models/AllocationModel');
const Doctor = require('../models/doctorModel');

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

    // Remove all existing allocations
    await Allocation.deleteMany({});

    // Create new allocations and update doctors
    const updatedDoctors = new Map();
    const errors = [];

    for (const allocation of allocations) {
      let doctor;
      
      // Check if doctorId is a valid ObjectId
      if (mongoose.Types.ObjectId.isValid(allocation.doctorId)) {
        doctor = await Doctor.findById(allocation.doctorId);
      } else {
        // If not, try to find the doctor by name
        const doctorName = allocation.doctorId.split(' [')[0];  // Extract name from "Name [role]"
        doctor = await Doctor.findOne({ name: doctorName });
      }

      if (!doctor) {
        errors.push(`Doctor not found: ${allocation.doctorId}`);
        continue;
      }

      // Create new allocation
      await Allocation.create({
        role: allocation.role,
        doctorId: doctor._id,
        followUpType: allocation.followUpType
      });

      // Update doctor's follow
      let newFollow = updatedDoctors.get(doctor._id.toString()) || [];
      if (allocation.followUpType && !newFollow.includes(allocation.followUpType)) {
        newFollow.push(allocation.followUpType);
      }
      updatedDoctors.set(doctor._id.toString(), newFollow);
    }

    // Update doctors' follow fields
    for (const [doctorId, follows] of updatedDoctors.entries()) {
      await Doctor.findByIdAndUpdate(
        doctorId,
        { follow: follows.length > 0 ? follows.join(", ") : "No follows" }
      );
    }

    // Fetch and return the updated allocations
    const newAllocations = await Allocation.find().populate('doctorId', 'name follow');

    // If there were any errors, include them in the response
    if (errors.length > 0) {
      res.status(207).json({
        message: 'Allocations saved with some errors',
        allocations: newAllocations,
        errors: errors
      });
    } else {
      res.status(200).json({
        message: 'All allocations saved successfully',
        allocations: newAllocations
      });
    }

  } catch (error) {
    console.error("Error in saveAllocations:", error);
    res.status(500).json({ message: 'Error saving allocations', error: error.message });
  }
};

exports.resetAllocations = async (req, res) => {
  try {
    // Remove all allocations
    await Allocation.deleteMany({});

    // Reset all doctors' follow to default and permissions to no (except for admin doctors)
    await Doctor.updateMany(
      { role: { $ne: 'admin-doctor' } },
      { follow: "No follows", reAllocationPerm: false }
    );

    res.status(200).json({ message: 'All allocations have been reset successfully' });
  } catch (error) {
    console.error("Error in resetAllocations:", error);
    res.status(500).json({ message: 'Error resetting allocations', error: error.message });
  }
};

exports.getPermissions = async (req, res) => {
  try {
    const doctors = await Doctor.find().select('_id reAllocationPerm');
    const permissions = doctors.reduce((acc, doctor) => {
      acc[doctor._id] = { reAllocationPerm: doctor.reAllocationPerm };
      return acc;
    }, {});
    res.status(200).json(permissions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching permissions', error: error.message });
  }
};

exports.updatePermission = async (req, res) => {
  try {
    const { doctorId, permission, value } = req.body;
    const doctor = await Doctor.findByIdAndUpdate(
      doctorId,
      { [permission]: value },
      { new: true }
    );
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    res.status(200).json({ message: 'Permission updated successfully', doctor });
  } catch (error) {
    res.status(500).json({ message: 'Error updating permission', error: error.message });
  }
};