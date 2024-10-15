const asyncHandler = require("express-async-handler");
const Patient = require("../models/patientModel");
const ChronicPatient = require("../models/chronicModel");
const Appointment = require("../models/appointmentModel");
const Doctor = require("../models/doctorModel");
const moment = require('moment');

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
  console.log("Patient Details endpoint reached");
  const phone = req.user.phone;
  if (!phone) {
    return res.status(400).json({ message: "Phone number not available" });
  }

  // Fetch the patient
  const patient = await Patient.findOne({ phone });

  if (!patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  let chronicPatient = false;

  if (patient.diseaseType.name.toLowerCase() === "chronic") {
    const chronicPatientRecord = await ChronicPatient.findOne({ phone });
    if (chronicPatientRecord) {
      chronicPatient = true;
    }
  }

  res.status(200).json({ patient, chronicPatient });
});

//Chronic Form
exports.sendChronicForm = asyncHandler(async (req, res) => {
  const {
    dob,
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
  } = req.body;

  console.log("Endpoint reached");

  const phone = req.user.phone;

  // Check if the patient with the provided phone number exists
  const existingPatient = await Patient.findOne({ phone });
  if (!existingPatient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  // Ensure the patient is classified as chronic
  if (existingPatient.diseaseType.name.toLowerCase() !== "chronic") {
    return res.json({ message: "Patient isn't chronic!" });
  }

  // Create a new chronic patient document
  const chronicPatientDocument = new ChronicPatient({
    phone,
    dob,
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
  });

  // Save the chronic patient document to the "chronics" collection in the database
  await chronicPatientDocument.save();

  // Send a success response
  res.status(201).json({
    success: true,
    message: "Data saved successfully",
    patient: chronicPatientDocument,
  });
});

// Check Available Slots
exports.checkAvailableSlots = asyncHandler(async (req, res) => {
  const { appointmentDate } = req.body;
  const phone = req.user.phone;

  const patient = await Patient.findOne({ phone });
  const diseaseType = patient.diseaseType.name.toLowerCase();

  const timeSlots = [
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
  ];
  const appointments = await Appointment.find({ appointmentDate });

  const isMorningSlot = (slot) => timeSlots.indexOf(slot) < 4;

  const availableSlots = timeSlots.filter((slot) => {
    const isBooked = appointments.some((appt) => appt.timeSlot === slot);

    if (isBooked) return false;

    if (diseaseType === "chronic") {
      // If chronic patient, check if there is a chronic booking in the morning or afternoon session
      const chronicBookingInMorning = appointments.some(
        (appt) => appt.isChronic && isMorningSlot(appt.timeSlot)
      );
      const chronicBookingInAfternoon = appointments.some(
        (appt) => appt.isChronic && !isMorningSlot(appt.timeSlot)
      );

      if (
        (chronicBookingInMorning && isMorningSlot(slot)) ||
        (chronicBookingInAfternoon && !isMorningSlot(slot))
      ) {
        return false;
      }
    }

    return true;
  });

  res.status(200).json({ availableSlots });
});

// Book appointment
exports.bookAppointment = asyncHandler(async (req, res) => {
  const phone = req.user.phone;
  const { appointmentDate, timeSlot } = req.body;
  const doctorId = "66c8312667b91b0b7730e725";
  const patient = await Patient.findOne({ phone });
  if (!patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  // Find the doctor by ID
  const doctor = await Doctor.findById(doctorId);
  if (!doctor || doctor.role != "admin-doctor") {
    return res.status(404).json({ message: "Doctor not found" });
  }

  const isChronic = patient.diseaseType.name.toLowerCase() === "chronic";

  const timeSlots = [
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
  ];
  const requestedSlotIndex = timeSlots.indexOf(timeSlot);

  if (requestedSlotIndex === -1) {
    return res.status(400).json({ message: "Invalid time slot" });
  }

  const currentDate = new Date();
  const appointmentDateObj = new Date(appointmentDate);
  const oneMonthLater = new Date();
  oneMonthLater.setMonth(currentDate.getMonth() + 1);

  if (appointmentDateObj < currentDate) {
    return res
      .status(400)
      .json({ message: "Cannot book appointments in the past" });
  }

  if (appointmentDateObj > oneMonthLater) {
    return res
      .status(400)
      .json({ message: "Appointments can only be booked within a month" });
  }

  const appointments = await Appointment.find({ appointmentDate });
  const isMorningSlot = (slot) => timeSlots.indexOf(slot) < 4;

  if (isChronic) {
    const chronicBookingInMorning = appointments.some(
      (appt) => appt.isChronic && isMorningSlot(appt.timeSlot)
    );
    const chronicBookingInAfternoon = appointments.some(
      (appt) => appt.isChronic && !isMorningSlot(appt.timeSlot)
    );

    // For chronic patients, block entire morning or afternoon session
    if (
      (isMorningSlot(timeSlot) && chronicBookingInMorning) ||
      (!isMorningSlot(timeSlot) && chronicBookingInAfternoon)
    ) {
      return res.status(400).json({
        message: "The selected time slot is not available for chronic patients",
      });
    }
  } else {
    const isSlotBooked = appointments.some(
      (appt) => appt.timeSlot === timeSlot
    );

    // For acute patients, only check if the specific slot is booked
    if (isSlotBooked) {
      return res.status(400).json({ message: "Time slot is not available" });
    }
  }

  const newAppointment = new Appointment({
    patient: patient._id,
    doctor: doctor._id,
    appointmentDate,
    timeSlot,
    isChronic,
  });

  await newAppointment.save();

  // Update the patient's follow status to "Follow up-C"
  patient.follow = "Follow up-C"; // Update follow status
  await patient.save(); // Save the updated patient

  res.status(201).json({
    message: "Appointment booked successfully",
    appointment: newAppointment,
  });
});

exports.getUserAppointments = async (req, res) => {
  console.log("User Appointments endpoint reached");
  try {
    const userId = req.user.id; // Assuming you have user authentication middleware
    const { filter } = req.query;
    
    let query = { patient: userId };
    const currentDate = moment().startOf('day');

    switch (filter) {
      case 'past':
        query.appointmentDate = { $lt: currentDate.toDate() };
        break;
      case 'today':
        query.appointmentDate = {
          $gte: currentDate.toDate(),
          $lt: moment(currentDate).endOf('day').toDate()
        };
        break;
      case 'thisWeek':
        query.appointmentDate = {
          $gte: currentDate.toDate(),
          $lt: moment(currentDate).endOf('week').toDate()
        };
        break;
      case 'thisMonth':
        query.appointmentDate = {
          $gte: currentDate.toDate(),
          $lt: moment(currentDate).endOf('month').toDate()
        };
        break;
      default:
        // If no filter or 'all', fetch all appointments
        break;
    }

    const appointments = await Appointment.find(query)
      .populate('doctor', 'name specialty') // Assuming doctor has name and specialty fields
      .sort({ appointmentDate: 1, timeSlot: 1 });
    
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching appointments', error: error.message });
  }
};


const momentIST = require('moment-timezone'); // Make sure to install moment-timezone

exports.updateFollowUpStatus = async (req, res) => {
  try {
    const { patientId } = req.params;    
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    const exDtTm = new Date();
    
    // Update follow-up status
    switch (patient.follow) {
      case 'Follow up-C':
        patient.follow = 'Follow up-P';
        break;
      case 'Follow up-P':
        patient.follow = 'Follow up-Mship';
        patient.followUpTimestamp = exDtTm; // Store timestamp when status changes to Mship
        break;
      case 'Follow up-Mship':
        patient.follow = 'Follow up-MP';
        break;
      case 'Follow up-MP':
        patient.follow = 'Follow up-ship';
        break;
      default:
        return res.status(400).json({ message: 'Invalid follow-up status' });
    }

    await patient.save();

    res.status(200).json({
      message: 'Follow-up status updated successfully',
      patient: {
        id: patient._id,
        follow: patient.follow,
        followUpTimestamp: patient.followUpTimestamp
      }
    });
  } catch (error) {
    console.error('Error updating follow-up status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// Update Call Status
exports.updateFollowPatientCall = async (req, res) => {
  const { patientId } = req.params;
  const { newCallStatus } = req.body;

  try {
    // Find the patient by ID
    const patient = await Patient.findById(patientId);

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Update the call status
    patient.enquiryStatus = newCallStatus;

    // If the new call status is 'Completed', update the follow-up status
    if (newCallStatus === 'Completed') {
      patient.follow = 'Follow up-C'; // Change this to the desired follow-up status
    }

    // Save the updated patient record
    await patient.save();

    res.status(200).json({ message: 'Call status updated successfully', patient });
  } catch (error) {
    console.error('Error updating call status:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

// // Update Appointment
// exports.updateAppointment = asyncHandler(async (req, res) => {
//   const { id } = req.params;
//   const { status } = req.body;

//   const appointment = await Appointment.findById(id);
//   if (!appointment) {
//     return res.status(404).json({ message: "Appointment not found" });
//   }

//   appointment.status = status || appointment.status;
//   await appointment.save();

//   res.status(200).json({
//     message: "Appointment updated successfully",
//     appointment,
//   });
// });

// // Get Appointments by Date
// exports.getAppointmentsByDate = asyncHandler(async (req, res) => {
//   const { date } = req.query;

//   const appointmentDate = new Date(date);
//   const appointments = await Appointment.find({ appointmentDate });

//   res.status(200).json(appointments);
// });

// // Get Appointment by ID
// exports.getAppointmentById = asyncHandler(async (req, res) => {
//   const { id } = req.params;

//   const appointment = await Appointment.findById(id);
//   if (!appointment) {
//     return res.status(404).json({ message: "Appointment not found" });
//   }

//   res.status(200).json(appointment);
// });

// // Cancel Appointment
// exports.cancelAppointment = asyncHandler(async (req, res) => {
//   const { id } = req.params;

//   const appointment = await Appointment.findByIdAndDelete(id);
//   if (!appointment) {
//     return res.status(404).json({ message: "Appointment not found" });
//   }

//   res.status(200).json({ message: "Appointment cancelled successfully" });
// });
