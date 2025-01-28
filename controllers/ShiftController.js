const Shift = require("../models/Shift");
const ShiftSettings = require('../models/ShiftSettings');
const Doctor = require('../models/doctorModel');

// Save or update shift details
exports.saveShifts = async (req, res) => {
  try {
    const { shifts } = req.body;

    if (!shifts || !Array.isArray(shifts)) {
      return res.status(400).json({ message: "Invalid shift data provided." });
    }

    // Loop through the shifts and save/update them in the database
    for (const shift of shifts) {
      const { name, startTime, endTime } = shift;

      if (!name || !startTime || !endTime) {
        return res.status(400).json({ message: "Incomplete shift details provided." });
      }

      // Check if a shift with the same name exists
      const existingShift = await Shift.findOne({ name });

      if (existingShift) {
        // Update existing shift
        existingShift.startTime = startTime;
        existingShift.endTime = endTime;
        await existingShift.save();
      } else {
        // Create new shift
        const newShift = new Shift({ name, startTime, endTime });
        await newShift.save();
      }
    }

    res.status(200).json({ message: "Shifts saved successfully!" });
  } catch (error) {
    console.error("Error saving shifts:", error);
    res.status(500).json({ message: "Server error while saving shifts." });
  }
};

// Get all shifts
exports.getShifts = async (req, res) => {
  try {
    const shifts = await Shift.find();
    res.status(200).json(shifts);
  } catch (error) {
    console.error("Error fetching shifts:", error);
    res.status(500).json({ message: "Server error while fetching shifts." });
  }
};

exports.getShiftDetails = async (req, res) => {
  const calculateHalfDaySlots = (shift) => {
    const [startHour, startMinute] = shift.startTime.split(":").map(Number);
    const [endHour, endMinute] = shift.endTime.split(":").map(Number);

    const totalMinutes =
      (endHour * 60 + endMinute) - (startHour * 60 + startMinute);

    const halfDayMinutes = totalMinutes / 2;

    const firstHalfEndHour = Math.floor(startHour + halfDayMinutes / 60);
    const firstHalfEndMinute = (startMinute + (halfDayMinutes % 60)) % 60;

    const secondHalfStartHour = firstHalfEndHour;
    const secondHalfStartMinute = firstHalfEndMinute;

    return {
      fullDay: `${shift.startTime} - ${shift.endTime}`,
      firstHalf: `${shift.startTime} - ${String(firstHalfEndHour).padStart(2, "0")}:${String(firstHalfEndMinute).padStart(2, "0")}`,
      secondHalf: `${String(secondHalfStartHour).padStart(2, "0")}:${String(secondHalfStartMinute).padStart(2, "0")} - ${shift.endTime}`
    };
  };

  try {
    const shifts = await Shift.find();
    const shiftDetails = shifts.map((shift) => {
      const slots = calculateHalfDaySlots(shift);
      return {
        ...shift.toObject(),
        fullDay: slots.fullDay,
        firstHalf: slots.firstHalf,
        secondHalf: slots.secondHalf,
      };
    });

    res.status(200).json(shiftDetails);
  } catch (error) {
    res.status(500).json({ message: "Error fetching shift details", error });
  }
};

// Add Shift Settings
exports.addShiftSettings = async (req, res) => {
  try {
    const { name, employeeID, shift } = req.body;

    // Validate input
    if (!name || !employeeID || !shift) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const newShiftSetting = new ShiftSettings({
      name,
      employeeID,
      shift,
    });

    await newShiftSetting.save();

    res.status(201).json({
      success: true,
      message: 'Shift settings saved successfully!',
      data: newShiftSetting,
    });
  } catch (error) {
    console.error('Error saving shift settings:', error);
    res.status(500).json({ message: 'Failed to save shift settings.' });
  }
};

// Fetch all doctors (to populate the dropdown)
exports.getDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find(); // Get all doctors from the database
    res.status(200).json({
      success: true,
      doctors,
    });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ message: 'Failed to fetch doctors.' });
  }
};