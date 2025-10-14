const Patient = require("../models/patientModel");
const MedicalDetails = require("../models/patientDetails");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const { sendSetPasswordEmail } = require('../services/emailService');
const asyncHandler = require("express-async-handler");
const Doctor=require("../models/doctorModel")

// predictionController.js                                                                                                                                                                                                                                                                                                                                                                             const express = require('express');
const axios = require("axios");
// require('dotenv').config();
// const cors = require('cors');
// const app = express();

// // Enable CORS for all routes
// app.use(cors());

exports.predict = async (req, res) => {
  console.log("Endpoint reached");
  const { consultingReason, symptom } = req.body;

  try {
    const response = await axios.post("http://127.0.0.1:5000/predict", {
      consultingReason,
      symptom,
    });

    res.json(response.data);
  } catch (error) {
    console.error(
      "Error communicating with Python microservice:",
      error.message
    );
    if (error.response && error.response.data) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
};
// Make sure to import your models and the new email service at the top of your file
// const Patient = require("../models/patientModel");
// const MedicalDetails = require("../models/medicalDetailsModel");
// const { sendSetPasswordEmail } = require("../services/emailService"); // Ensure this is imported
// const asyncHandler = require("express-async-handler");

exports.createPatient = asyncHandler(async (req, res) => {
  // --- Start of Debug Statements ---
  console.log("--- Create Patient Request Start ---");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Request Body:", req.body);
  // --- End of Debug Statements ---

  console.log("Create patient endpoint reached");

  const {
    consultingFor, name, age, phone, whatsappNumber,
    email, gender, diseaseName, diseaseType,
    currentLocation, patientEntry, symptomNotKnown,
  } = req.body;

  // --- Validation (Unchanged) ---
  if (!email || !phone || !name) {
    // --- Debug Statement for Validation Failure ---
    console.error("Validation failed: Missing required fields (name, email, or phone).");
    return res.status(400).json({ success: false, message: "Name, email, and phone are required." });
  }

  const existingPatient = await Patient.findOne({ $or: [{ phone }, { email }] });
  const existingDoctor = await Doctor.findOne({ $or: [{ phone }, { email }] });

  if (existingPatient || existingDoctor) {
    console.warn("Attempted to create a duplicate user. Phone:", phone, "Email:", email);
    return res.status(400).json({
      success: false,
      message: "A user with this phone number or email already exists.",
    });
  }
  // --- Create Patient Record (Password logic is REMOVED) ---
  const newPatient = new Patient({
    name, age, phone, whatsappNumber, email, gender,
    patientEntry, currentLocation,
    // Note: We no longer create a password here.
    requiresPasswordReset: true,
  });

  // --- Generate and store the password set token ---
  const setPasswordToken = newPatient.createPasswordSetToken();
  // --- Debug Statement for Token Generation ---
  console.log("Generated password set token for new patient:", setPasswordToken ? "Success" : "Failed");

  // Save the patient record along with the new token fields
  await newPatient.save({ validateBeforeSave: false });
  // --- Debug Statement for Patient Save ---
  console.log("New patient record saved successfully. Patient ID:", newPatient._id);


  // --- Create Medical Details Record (Unchanged) ---
  let processedDiseaseType = { name: "", edit: false };
  if (diseaseType && typeof diseaseType === "object") {
    processedDiseaseType = {
      name: diseaseType.name || "",
      edit: diseaseType.edit || false,
    };
  }

  const medicalDetails = new MedicalDetails({
    patientId: newPatient._id,
    consultingFor,
    diseaseName,
    diseaseType: processedDiseaseType,
    symptomNotKnown,
  });

  await medicalDetails.save();
  // --- Debug Statement for Medical Details Save ---
  console.log("Medical details for patient saved successfully. Medical Details ID:", medicalDetails._id);

  // --- Send Welcome Email with Set Password Link ---
  try {
    const setPasswordUrl = `https://consult-homeopathy.vercel.app/set-password/${setPasswordToken}`;
    // --- Debug Statement for Email Sending ---
    console.log("Attempting to send set password email to:", newPatient.email);
    console.log("Using URL:", setPasswordUrl);
    
    await sendSetPasswordEmail(newPatient.email, setPasswordUrl);

    // --- Debug Statement for Email Success ---
    console.log("Email sent successfully to:", newPatient.email);

    // --- Success Response (Updated message) ---
    res.status(201).json({
      success: true,
      message: "Patient created successfully. An email has been sent to set their password.",
      patientId: newPatient._id,
    });
  } catch (error) {
    // --- Start of CRITICAL Debug Statements for Email Failure ---
    console.error("!!! CRITICAL: EMAIL SENDING FAILED !!!");
    console.error("Error occurred while sending email to:", newPatient.email);
    console.error("Full Error Object:", error); // This is the most important log
    // --- End of CRITICAL Debug Statements for Email Failure ---

    console.error("Error creating patient or sending email:", error);
    // This provides a more specific error if the email fails after the user is created
    res.status(500).json({
      success: false,
      error: "Patient created, but the email could not be sent. Please notify the patient manually.",
      message: error.message,
    });
  }
});







