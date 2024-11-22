const WorkHours = require('../models/workHours'); // Adjust the path as per your project structure
//const { utcToZonedTime } = require('date-fns-tz');
const moment = require('moment-timezone');

// Function to convert UTC to IST
const convertToIST = (utcDate) => {
  return moment(utcDate).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
};

const utcDate = new Date();
console.log('IST:', convertToIST(utcDate));

// Record check-in time for the doctor
exports.checkIn = async (req, res) => {
  try {
    const doctorId = req.user.id; // Authenticated doctor's ID
    const currentDate = new Date();
    const dateOnly = currentDate.toISOString().split('T')[0]; // Keep only the date part (YYYY-MM-DD)

    let workRecord = await WorkHours.findOne({ doctor: doctorId, date: dateOnly });

    if (!workRecord) {
      workRecord = new WorkHours({
        doctor: doctorId,
        date: dateOnly, // Store date in UTC
        checkIn: currentDate, // Store UTC time
      });
      await workRecord.save();
    } else {
      return res.status(400).json({ message: 'Check-in already recorded for today' });
    }

    res.status(200).json({
      message: 'Check-in recorded successfully',
      checkIn: convertToIST(workRecord.checkIn), // Return IST time to the user
    });
  } catch (error) {
    console.error('Error during check-in:', error);
    res.status(500).json({ message: 'Failed to record check-in' });
  }
};

// Record check-out time and calculate total hours worked
exports.checkOut = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const currentDate = new Date();
    const dateOnly = currentDate.toISOString().split('T')[0];

    const workRecord = await WorkHours.findOne({ doctor: doctorId, date: dateOnly });

    if (!workRecord) {
      return res.status(400).json({ message: 'No check-in record found for today' });
    }

    workRecord.checkOut = currentDate; // Store UTC time

    const totalHours = ((workRecord.checkOut - workRecord.checkIn) / (1000 * 60 * 60)).toFixed(2);
    workRecord.totalHours = parseFloat(totalHours);

    await workRecord.save();

    res.status(200).json({
      message: 'Check-out recorded successfully',
      checkOut: convertToIST(workRecord.checkOut), // Return IST time to the user
      totalHours: workRecord.totalHours,
    });
  } catch (error) {
    console.error('Error during check-out:', error);
    res.status(500).json({ message: 'Failed to record check-out' });
  }
};

// Handle automatic logout (session timeout) for the doctor
exports.autoLogoutHandler = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const currentDate = new Date();
    const dateOnly = currentDate.toISOString().split('T')[0];

    const workRecord = await WorkHours.findOne({ doctor: doctorId, date: dateOnly });

    if (workRecord && !workRecord.checkOut) {
      workRecord.checkOut = currentDate; // Store UTC time

      const totalHours = ((workRecord.checkOut - workRecord.checkIn) / (1000 * 60 * 60)).toFixed(2);
      workRecord.totalHours = parseFloat(totalHours);

      await workRecord.save();
    }

    res.status(200).json({
      message: 'Session timeout handled',
      checkOut: workRecord ? convertToIST(workRecord.checkOut) : null,
      totalHours: workRecord ? workRecord.totalHours : 0,
    });
  } catch (error) {
    console.error('Error during auto logout handling:', error);
    res.status(500).json({ message: 'Failed to handle session timeout' });
  }
};

