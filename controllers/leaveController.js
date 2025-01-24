// controllers/leaveController.js
const Leave = require('../models/Leave');
const Doctor = require('../models/doctorModel');
const LeaveSettings = require('../models/leaveSettingsModel.js');
const Leaveset=require('../models/LeavesetModel.js');

// Assistant doctor requests leave
exports.requestLeave = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason, totalDays } = req.body;
    const doctorId = req.user.id; // assuming req.user is populated after authentication
    
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const leaveRequest = new Leave({
      doctor: doctorId,
      name: doctor.name,
      leaveType,
      startDate,
      endDate,
      reason,
      totalDays,
    });
    await leaveRequest.save();
    res.status(201).json(leaveRequest);
  } catch (error) {
    console.error('Error in requestLeave:', error); // Log the error for debugging
    res.status(500).json({ error: error.message });
  }
};

// Get assistant doctor’s leave requests
exports.getMyLeaveRequests = async (req, res) => {
  try {
    const doctorId = req.user.id; // assuming req.user is populated after authentication
    const leaveRequests = await Leave.find({ doctor: doctorId });
    res.json(leaveRequests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all pending leave requests (for admin-doctor)
exports.getPendingLeaveRequests = async (req, res) => {
  try {
    const leaveRequests = await Leave.find({ status: 'pending' }).populate('doctor', 'name');
    res.json(leaveRequests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Approve a leave request (for admin-doctor)
exports.approveLeave = async (req, res) => {
  try {
    const leaveId = req.params.id;
    const leaveRequest = await Leave.findByIdAndUpdate(leaveId, { status: 'approved' }, { new: true });
    if (!leaveRequest) return res.status(404).json({ message: 'Leave request not found' });
    res.json(leaveRequest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Reject a leave request (for admin-doctor)
exports.rejectLeave = async (req, res) => {
  try {
    const leaveId = req.params.id;
    const leaveRequest = await Leave.findByIdAndUpdate(leaveId, { status: 'rejected' }, { new: true });
    if (!leaveRequest) return res.status(404).json({ message: 'Leave request not found' });
    res.json(leaveRequest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Set or Update Leave Settings
exports.setLeaveSettings = async (req, res) => {
  try {
    const { sickLeave, casualLeave, paidLeave, maternityLeave } = req.body;
    const doctorId = req.user.id; // Assuming req.user contains the authenticated admin-doctor

    // Validate if the user is an admin-doctor
    const adminDoctor = await Doctor.findById(doctorId);
    if (!adminDoctor || adminDoctor.role !== 'admin-doctor') {
      return res.status(403).json({ message: 'Unauthorized access' });
    }

    let leaveSettings = await LeaveSettings.findOne({ createdBy: doctorId });
    if (leaveSettings) {
      // Update existing settings
      leaveSettings.sickLeave = sickLeave;
      leaveSettings.casualLeave = casualLeave;
      leaveSettings.paidLeave = paidLeave;
      leaveSettings.maternityLeave = maternityLeave;
      leaveSettings.updatedAt = Date.now();
    } else {
      // Create new settings
      leaveSettings = new LeaveSettings({
        sickLeave,
        casualLeave,
        paidLeave,
        maternityLeave,
        createdBy: doctorId,
      });
    }

    await leaveSettings.save();
    res.status(200).json({ message: 'Leave settings updated successfully', leaveSettings });
  } catch (error) {
    console.error('Error updating leave settings:', error);
    res.status(500).json({ error: 'Failed to update leave settings' });
  }
};

// Get Leave Settings
exports.getLeaveSettings = async (req, res) => {
  try {
    const doctorId = req.user.id;

    // Find leave settings created by the admin-doctor
    const leaveSettings = await LeaveSettings.findOne({ createdBy: doctorId });
    if (!leaveSettings) {
      return res.status(404).json({ message: 'Leave settings not found.' });
    }

    res.status(200).json({ leaveSettings });
  } catch (error) {
    console.error('Error fetching leave settings:', error);
    res.status(500).json({ error: 'Failed to fetch leave settings.' });
  }
};


exports.getLeaveBalance = async (req, res) => {
  try {
    const doctorId = req.user.id; // Assistant doctor's ID from the authenticated request

    // Fetch leave settings set by the admin-doctor (global leave settings)
    const leaveSettings = await LeaveSettings.findOne();
    if (!leaveSettings) {
      return res.status(404).json({ message: 'Leave settings not found' });
    }

    // Fetch leaves taken by the assistant doctor
    const leavesTaken = await Leave.find({ doctor: doctorId, status: 'approved' });

    // Calculate total days taken for each leave type using the totalDays field
    const totalSickLeaveDays = leavesTaken
      .filter((leave) => leave.leaveType === 'Sick Leave')
      .reduce((total, leave) => total + leave.totalDays, 0);

    const totalCasualLeaveDays = leavesTaken
      .filter((leave) => leave.leaveType === 'Casual Leave')
      .reduce((total, leave) => total + leave.totalDays, 0);

    const totalPaidLeaveDays = leavesTaken
      .filter((leave) => leave.leaveType === 'Paid Leave')
      .reduce((total, leave) => total + leave.totalDays, 0);

    const totalMaternityLeaveDays = leavesTaken
      .filter((leave) => leave.leaveType === 'Maternity')
      .reduce((total, leave) => total + leave.totalDays, 0);

    // Calculate balance for each leave type
    const balance = {
      sickLeave: leaveSettings.sickLeave - totalSickLeaveDays,
      casualLeave: leaveSettings.casualLeave - totalCasualLeaveDays,
      paidLeave: leaveSettings.paidLeave - totalPaidLeaveDays,
      maternityLeave: leaveSettings.maternityLeave - totalMaternityLeaveDays,
    };

    // Return the calculated leave balance
    res.status(200).json(balance);
  } catch (error) {
    console.error('Error fetching leave balance:', error);
    res.status(500).json({ error: 'Failed to fetch leave balance' });
  }
};

exports.addLeave = async (req, res) => {
  try {
    // Destructure the request body to get leave details
    const { name, fromDate, toDate, description } = req.body;

    // Validate input fields to ensure no missing fields
    if (!name || !fromDate || !toDate || !description) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // Create a new leave entry with the provided details
    const leaveEntry = new Leaveset({
      name,
      fromDate,
      toDate,
      description,
    });

    // Save the leave entry to the database
    await leaveEntry.save();

    // Return a success response with the leave details
    res.status(201).json({
      message: 'Leave details saved successfully.',
      leave: leaveEntry,
    });
  } catch (error) {
    console.error('Error saving leave details:', error);
    res.status(500).json({ message: 'An error occurred while saving leave details.' });
  }
};

exports.getLeaves = async (req, res) => {
  try {
    // Retrieve all leave details from the database
    const leaves = await Leaveset.find();
    

    // If no leave data is found, send a 404 response
    if (!leaves || leaves.length === 0) {
      return res.status(404).json({ message: "No leave data found" });
    }

    // Send a response with the leave data
    res.status(200).json(leaves);
  } catch (error) {
    console.error("Error fetching leaves:", error);
    res.status(500).json({ message: "Server error. Could not fetch leaves." });
  }
};
