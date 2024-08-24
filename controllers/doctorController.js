const mongoose = require("mongoose");
const Doctor = require("../models/doctorModel");
const Appointment = require("../models/appointmentModel.js");

exports.addDoctor = async (req, res) => {
  const { name, age, gender, photo, specialization, bio, phone, role } =
    req.body;

  try {
    // Check if the requesting doctor is an admin
    const requestingDoctor = await Doctor.findOne({ phone: req.user.phone });
    if (!requestingDoctor || requestingDoctor.role !== "admin-doctor") {
      return res
        .status(403)
        .json({ message: "Only admin doctors can add new doctors" });
    }

    // Check if a doctor with the same phone number already exists
    const checkDoctor = await Doctor.findOne({ phone });
    if (checkDoctor) {
      return res.status(400).json({ message: "Doctor already exists!" });
    }

    // Create and save the new doctor
    const newDoctor = new Doctor({
      name,
      age,
      gender,
      photo,
      specialization,
      bio,
      phone,
      role: role || "assistant-doctor", // Default to "assistant-doctor" if no role is provided
    });

    await newDoctor.save();
    res
      .status(201)
      .json({ message: `${role || "Assistant"} doctor added successfully` });
  } catch (error) {
    // Improved error handling for validation errors
    if (error.name === "ValidationError") {
      return res
        .status(400)
        .json({ message: "Validation failed", error: error.message });
    }
    res
      .status(500)
      .json({ message: "Failed to add doctor", error: error.message });
  }
};

exports.getAppointments = async (req, res) => {
  try {
    const phone = req.user.phone;
    const doctor = await Doctor.findOne({ phone });

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const appointments = await Appointment.find({ doctor: doctor._id });

    if (appointments.length === 0) {
      return res.status(404).json({ message: "No appointments found" });
    }

    res.status(200).json({ appointments });
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve appointments", error: error.message });
  }
};
