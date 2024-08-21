const asyncHandler = require("express-async-handler");
const Patient = require("../models/patientModel");
const chronicPatient = require("../models/chronicModel");
const Appointment = require("../models/appointmentModel");
const Doctor = require("../models/doctorModel");

//Initial Form

exports.sendForm = asyncHandler(async (req, res) => {
  const { name, age, phone, email, gender, diseaseName, diseaseType } =
    req.body;

  // Basic validation
  // if (
  //   !name ||
  //   !age ||
  //   !phone ||
  //   !email ||
  //   !gender ||
  //   !diseaseName ||
  //   !diseaseType
  // ) {
  //   return res.status(400).json({
  //     message: "All fields are required",
  //   });
  // }

  // Check if the patient with the given phone already exists
  const existingPatient = await Patient.findOne({ phone });

  if (existingPatient) {
    // If patient already exists, return an error response
    return res.status(400).json({
      message: "Patient with this mobile number already exists",
    });
  }

  // If patient does not exist, create a new patient document
  const patientDocument = new Patient({
    name,
    age,
    phone,
    email,
    gender,
    diseaseName,
    diseaseType,
  });

  await patientDocument.save();

  res.status(201).json({
    message: "Patient data saved successfully",
    patient: patientDocument,
  });
});

//Patient Profile

exports.patientDetails = asyncHandler(async (req, res) => {
  // Extract phone number from route parameters
  const phone = req.user.phone;

  if (!phone) {
    return res.status(400).json({ message: "Phone number not available" });
  }

  // Find the patient by phone number
  const patient = await Patient.find({ phone });

  if (!patient) {
    // If patient not found, return a 404 response
    return res.status(404).json({
      message: "Patient not found",
    });
  }

  // Return the patient details
  res.status(200).json({ patient });
});

//Chronic Form

exports.sendChronicForm = asyncHandler(async (req, res) => {
  const {
    phone,
    name,
    dob,
    age,
    weight,
    height,
    occupation,
    country,
    state,
    city,
    complaint,
    symptoms,
    associatedDisease,
    allopathy,
    diseaseHistory,
    surgeryHistory,
    allergies,
    bodyType,
    clinicReferral,
  } = req.body;

  // Check if the patient with the provided phone number exists
  const existingPatient = await Patient.findOne({ phone });

  if (existingPatient.diseaseType != "chronic") {
    return res.json({ message: "Patient isn't chronic!" });
  }

  if (existingPatient) {
    // Create a new chronic patient document
    const chronicPatientDocument = new chronicPatient({
      phone,
      name,
      dob,
      age,
      weight,
      height,
      occupation,
      country,
      state,
      city,
      complaint,
      symptoms,
      associatedDisease,
      allopathy,
      diseaseHistory,
      surgeryHistory,
      allergies,
      bodyType,
      clinicReferral,
    });

    // Save the chronic patient document to the database
    await chronicPatientDocument.save();

    // Send a success response
    res.status(201).json({
      message: "Patient data saved successfully",
      patient: chronicPatientDocument,
    });
  } else {
    // Send an error response if the initial form is not filled
    res.status(400).json({ message: "First fill in the initial form" });
  }
});

//Book Appointment

exports.bookAppointment = asyncHandler(async (req, res) => {
  const phone = req.user.phone;
  const { appointmentDate, timeSlot, doctorId } = req.body;

  // Find the patient by phone number
  const patient = await Patient.findOne({ phone });
  if (!patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  // Find the doctor by ID
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  const isChronic = patient.diseaseType === "chronic";

  // Define time slots
  const timeSlots = [
    "10:00", // Morning slot
    "11:00",
    "12:00",
    "13:00",
    "14:00", // Afternoon slot
    "15:00",
    "16:00",
    "17:00",
  ];

  // Check if the requested slot is valid
  const requestedSlotIndex = timeSlots.indexOf(timeSlot);
  if (requestedSlotIndex === -1) {
    return res.status(400).json({ message: "Invalid time slot" });
  }

  // Check if the appointment date is valid (within the next month and not in the past)
  const currentDate = new Date();
  const appointmentDateObj = new Date(appointmentDate);
  const oneMonthLater = new Date();
  oneMonthLater.setMonth(currentDate.getMonth() + 1);

  // Check if the appointment date is in the past
  if (appointmentDateObj < currentDate) {
    return res.status(400).json({ message: "Cannot book appointments in the past" });
  }

  // Check if the appointment date is beyond one month from the current date
  if (appointmentDateObj > oneMonthLater) {
    return res.status(400).json({ message: "Appointments can only be booked within a month" });
  }

  // Get existing appointments for the given date
  const appointments = await Appointment.find({ appointmentDate });

  if (isChronic) {
    // Check if the requested slot is a morning or afternoon slot
    const isMorningSlot = requestedSlotIndex < 4; // Morning slots are in the first half
    const isAfternoonSlot = requestedSlotIndex >= 4; // Afternoon slots are in the second half

    // Check if a chronic patient has already booked a morning or afternoon slot
    const chronicMorningBooked = appointments.some(
      (appt) => appt.isChronic && timeSlots.indexOf(appt.timeSlot) < 4
    );
    const chronicAfternoonBooked = appointments.some(
      (appt) => appt.isChronic && timeSlots.indexOf(appt.timeSlot) >= 4
    );

    if (
      (isMorningSlot && chronicMorningBooked) ||
      (isAfternoonSlot && chronicAfternoonBooked)
    ) {
      return res.status(400).json({
        message:
          "The selected time slot is already booked for a chronic patient",
      });
    }
  }

  // Check if the time slot is already booked by any patient
  const isSlotBooked = appointments.some((appt) => appt.timeSlot === timeSlot);

  if (isSlotBooked) {
    return res.status(400).json({ message: "Time slot is already booked" });
  }

  // Create and save the new appointment
  const newAppointment = new Appointment({
    patient: patient._id,
    doctor: doctor._id,
    appointmentDate,
    timeSlot,
    isChronic,
  });

  await newAppointment.save();

  res.status(201).json({
    message: "Appointment booked successfully",
    appointment: newAppointment,
  });
});
