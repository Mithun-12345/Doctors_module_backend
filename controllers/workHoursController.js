const WorkHours = require('../models/workHours');
const moment = require('moment-timezone');

// Helper: Convert UTC to IST
const convertToIST = (utcDate) => moment(utcDate).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

// Helper: Calculate Total Hours Worked
const calculateTotalHours = (checkIn, checkOut, breaks) => {
  const totalWorkedMilliseconds = new Date(checkOut) - new Date(checkIn);
  const totalBreakMilliseconds = breaks.reduce((total, breakEntry) => {
    return total + (breakEntry.endTime ? new Date(breakEntry.endTime) - new Date(breakEntry.startTime) : 0);
  }, 0);
  return parseFloat(((totalWorkedMilliseconds - totalBreakMilliseconds) / (1000 * 60 * 60)).toFixed(2));
};

// Check-in Function
// Check-in
exports.checkIn = async (req, res) => {
  try {
    const doctorId = req.user.id;

    const today = new Date().toISOString().split("T")[0]; // Current day (YYYY-MM-DD format)
    let existingRecord = await Attendance.findOne({
      doctor: doctorId,
      date: today,
    });

    if (existingRecord) {
      // Resume tracking
      if (existingRecord.lastCheckOut) {
        const breakDurationSeconds =
          (new Date() - new Date(existingRecord.lastCheckOut)) / 1000;
        const breakDurationHours = parseFloat(secondsToHours(breakDurationSeconds));

        existingRecord.breakTime += breakDurationHours;
        existingRecord.lastCheckOut = null; // Reset last check-out
      }

      existingRecord.lastCheckIn = new Date();
      await existingRecord.save();
    } else {
      // First check-in of the day
      await Attendance.create({
        doctor: doctorId,
        date: today,
        lastCheckIn: new Date(),
        totalElapsedTime: 0,
        breakTime: 0,
      });
    }

    res.status(200).json({ message: "Checked in successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to check in", error: error.message });
  }
};

// Check-out
exports.checkOut = async (req, res) => {
  try {
    const doctorId = req.user.id;

    const today = new Date().toISOString().split("T")[0];
    const existingRecord = await Attendance.findOne({
      doctor: doctorId,
      date: today,
    });

    if (existingRecord && existingRecord.lastCheckIn) {
      const sessionDurationSeconds =
        (new Date() - new Date(existingRecord.lastCheckIn)) / 1000;
      const sessionDurationHours = parseFloat(secondsToHours(sessionDurationSeconds));

      existingRecord.totalElapsedTime += sessionDurationHours;
      existingRecord.lastCheckOut = new Date();
      existingRecord.lastCheckIn = null; // Reset last check-in
      await existingRecord.save();

      res.status(200).json({
        message: "Checked out successfully",
        totalElapsedTime: existingRecord.totalElapsedTime,
        breakTime: existingRecord.breakTime,
      });
    } else {
      res.status(400).json({ message: "No active check-in found to check out" });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to check out", error: error.message });
  }
};

// Start Break
exports.startBreak = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const startTime = new Date();
    const workRecord = await WorkHours.findOne({ doctor: doctorId, date: new Date().toISOString().split('T')[0] });

    if (!workRecord) return res.status(400).json({ message: 'No active session found for today' });
    if (workRecord.breaks.some((b) => !b.endTime)) {
      return res.status(400).json({ message: 'An active break already exists' });
    }

    workRecord.breaks.push({ startTime, duration: 0 });
    await workRecord.save();

    res.status(200).json({ message: 'Break started successfully', startTime: convertToIST(startTime) });
  } catch (error) {
    console.error('Error during start break:', error);
    res.status(500).json({ message: 'Failed to start break' });
  }
};

// End Break
exports.endBreak = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const endTime = new Date();
    const workRecord = await WorkHours.findOne({ doctor: doctorId, date: new Date().toISOString().split('T')[0] });

    if (!workRecord) return res.status(400).json({ message: 'No active session found for today' });

    const activeBreak = workRecord.breaks.find((b) => !b.endTime);
    if (!activeBreak) return res.status(400).json({ message: 'No active break found' });

    activeBreak.endTime = endTime;
    activeBreak.actualDuration = (new Date(endTime) - new Date(activeBreak.startTime)) / 60000; // Minutes
    await workRecord.save();

    res.status(200).json({ message: 'Break ended successfully', endTime: convertToIST(endTime) });
  } catch (error) {
    console.error('Error during end break:', error);
    res.status(500).json({ message: 'Failed to end break' });
  }
};
