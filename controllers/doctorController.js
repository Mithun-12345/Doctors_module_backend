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

    // Check if the query parameter 'type' is set to 'all'
    const { type } = req.query;

    let appointments;

    if (type === 'all') {
      // Fetch all appointments
      appointments = await Appointment.find();
      
      if (appointments.length === 0) {
        return res.status(200).json({ message: "No appointments found", appointments: [] });
      }
    } else {
      // Fetch appointments for the current doctor
      appointments = await Appointment.find({ doctor: doctor._id });
      
      if (appointments.length === 0) {
        return res.status(200).json({ message: "No appointments found", appointments: [] });
      }
    }

    res.status(200).json({ appointments });

  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve appointments",
      error: error.message,
    });
  }
};

exports.redirectAppointment = async (req, res) => {
  const { assistantDoctorId, appointmentId } = req.body;

  try {
    const checkDoctor = await Doctor.findOne({ _id: assistantDoctorId });
    // Find the appointment by ID
    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }
    if (!checkDoctor) {
      return res.status(404).json({ message: "No such doctor found" });
    }
    // Update the appointment with the assistant doctor and set status to "redirected"
    appointment.doctor = assistantDoctorId;
    appointment.status = "redirected";

    await appointment.save();

    res
      .status(200)
      .json({ message: "Appointment redirected successfully", appointment });
  } catch (e) {
    res.status(500).json({
      message: "Failed to redirect appointment",
      error: e.message,
    });
  }
};
