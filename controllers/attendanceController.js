const mongoose = require("mongoose");
const Attendance = require("../models/attendanceModel");
const Doctor = require("../models/doctorModel");

// Helper function to format seconds into HH:MM:SS
const formatTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

// Helper function to get today's attendance record
const getTodayRecord = async (doctorId) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    return await Attendance.findOne({ doctorId, date: today });
  } catch (error) {
    console.error("Error in getTodayRecord:", error);
    throw error;
  }
};

// Check-In Function
exports.checkIn = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const today = new Date().toISOString().split("T")[0];

    // Fetch doctor details
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const name = doctor.name;
    const employeeID = doctor.employeeID;

    // Get today's attendance record
    let attendanceRecord = await getTodayRecord(doctorId);

    if (attendanceRecord) {
      // Handle unfinished previous session
      if (attendanceRecord.lastCheckIn) {
        const elapsedSessionSeconds = (new Date() - new Date(attendanceRecord.lastCheckIn)) / 1000;
        attendanceRecord.totalElapsedTime += Math.max(elapsedSessionSeconds, 0);
      }

      // Update break time if there's a previous check-out
      if (attendanceRecord.lastCheckOut) {
        const breakDurationSeconds = (new Date() - new Date(attendanceRecord.lastCheckOut)) / 1000;
        attendanceRecord.breakTime += Math.max(breakDurationSeconds, 0);
      }

      // Update check-in time for the current session
      attendanceRecord.lastCheckIn = new Date();
      attendanceRecord.lastCheckOut = null; // Clear last check-out
    } else {
      // Create a new record for a new user or new day
      attendanceRecord = new Attendance({
        doctorId,
        employeeID,
        name,
        date: today,
        lastCheckIn: new Date(),
        totalElapsedTime: 0,
        breakTime: 0,
      });
    }

    // Save the record
    await attendanceRecord.save();

    res.status(200).json({
      message: "Checked in successfully",
      elapsedTime: formatTime(attendanceRecord.totalElapsedTime),
      breakTime: formatTime(attendanceRecord.breakTime),
    });
  } catch (error) {
    console.error("Error in checkIn:", error);
    res.status(500).json({ message: "Failed to check in", error: error.message });
  }
};

// Check-Out Function
exports.checkOut = async (req, res) => {
  try {
    const doctorId = req.user.id;

    // Get today's attendance record
    const attendanceRecord = await getTodayRecord(doctorId);

    if (attendanceRecord && attendanceRecord.lastCheckIn) {
      // Calculate the session duration
      const sessionDurationSeconds = (new Date() - new Date(attendanceRecord.lastCheckIn)) / 1000;

      if (sessionDurationSeconds <= 0 || isNaN(sessionDurationSeconds)) {
        return res.status(400).json({ message: "Invalid session duration" });
      }

      // Update total elapsed time and check-out time
      attendanceRecord.totalElapsedTime += Math.max(sessionDurationSeconds, 0);
      attendanceRecord.lastCheckOut = new Date();
      attendanceRecord.lastCheckIn = null; // Clear last check-in

      await attendanceRecord.save();

      return res.status(200).json({
        message: "Checked out successfully",
        totalElapsedTime: formatTime(attendanceRecord.totalElapsedTime),
        breakTime: formatTime(attendanceRecord.breakTime),
      });
    }

    res.status(400).json({ message: "No active check-in found to check out" });
  } catch (error) {
    console.error("Error in checkOut:", error);
    res.status(500).json({ message: "Failed to check out", error: error.message });
  }
};

exports.getAssistantDoctorDetails = async (req, res) => {
  try {
    // Fetch all attendance records from the Attendance collection
    const attendanceRecords = await Attendance.find();  // No restrictions to doctorId or date

    if (!attendanceRecords || attendanceRecords.length === 0) {
      return res.status(404).json({ message: "No attendance records found" });
    }

    // Map the attendance records to construct the response data
    const responseData = attendanceRecords.map(record => {
      // Calculate status based on lastCheckIn and lastCheckOut
      let status = "On Break";
      if (record.lastCheckIn && !record.lastCheckOut) {
        status = "At Work";
      }

      // Convert totalElapsedTime and breakTime to hours
      const totalElapsedTimeInHours = (record.totalElapsedTime / 3600).toFixed(2); // Total elapsed time in hours
      const breakTimeInHours = (record.breakTime / 3600).toFixed(2); // Break time in hours

      return {
        name: record.name,
        employeeID: record.employeeID,
        date: record.date,
        status: status,
        totalElapsedTime: totalElapsedTimeInHours,
        breakTime: breakTimeInHours,
      };
    });

    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching assistant doctor details:", error);
    return res.status(500).json({ message: "Error fetching assistant doctor details", error: error.message });
  }
};

exports.getAssistForOwnProfile = async (req, res) => {
  try {
    const doctorId = req.user.id; // Or get doctorId from params if provided

    // Fetch the attendance record for the assistant doctor
    const attendanceRecord = await Attendance.findOne({doctorId,date: new Date().toISOString().split("T")[0] }); // Assuming the date is stored in YYYY-MM-DD format.

    if (!attendanceRecord) {
      return res.status(404).json({ message: "No attendance record found for today" });
    }

    // Calculate status based on lastCheckIn and lastCheckOut
    let status = "On Break";
    if (attendanceRecord.lastCheckIn && !attendanceRecord.lastCheckOut) {
      status = "At Work";
    }

    // Convert totalElapsedTime and breakTime to hours
    const totalElapsedTimeInHours = (attendanceRecord.totalElapsedTime / 3600).toFixed(2); // Total elapsed time in hours
    const breakTimeInHours = (attendanceRecord.breakTime / 3600).toFixed(2); // Break time in hours

    // Construct the response data
    const responseData = {
      name: attendanceRecord.name,
      employeeID: attendanceRecord.employeeID,
      date: attendanceRecord.date,
      status: status,
      totalElapsedTime: totalElapsedTimeInHours,
      breakTime: breakTimeInHours,
    };

    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching assistant doctor details:", error);
    return res.status(500).json({ message: "Error fetching assistant doctor details", error: error.message });
  }
};