const asyncHandler = require("express-async-handler");
const chronicPatient = require("../models/chronicModel");
const regformPatient = require("../models/patientModel");

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
  const existingPatient = await regformPatient.findOne({ phone });

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
