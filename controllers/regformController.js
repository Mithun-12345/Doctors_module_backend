const asyncHandler = require("express-async-handler");
const Patient = require("../models/patientModel");

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


exports.patientDetails = asyncHandler(async (req, res) => {
  // Extract phone number from route parameters
  const { phone } = req.params;

  // Basic validation: Ensure phone number is provided
  if (!phone) {
    return res.status(400).json({
      message: "Phone number is required",
    });
  }

  // Find the patient by phone number
  const patient = await Patient.findOne({ phone });

  if (!patient) {
    // If patient not found, return a 404 response
    return res.status(404).json({
      message: "Patient not found",
    });
  }

  // Return the patient details
  res.status(200).json({
    patient,
  });
});
